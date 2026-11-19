import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { APP_PATH_PREFIXES, MARKETING_PAGES, NOINDEX_PUBLIC_PATHS, SITE_URL } from '../lib/seo/site';

/**
 * Garde-fous SEO/GEO : ce que voit un robot SANS JavaScript (HTML serveur brut).
 * Échoue si `/` perd son H1, son JSON-LD ou son canonical, si une page publique
 * n'est plus rendue côté serveur, ou si une route applicative devient indexable.
 * Indépendant du viewport : un seul projet suffit.
 */
test.skip(({ isMobile }) => isMobile, 'Contrôles HTTP, indépendants du viewport');

async function rawHtml(request: APIRequestContext, path: string): Promise<string> {
  const response = await request.get(path);
  expect(response.status(), `${path} doit répondre 200`).toBe(200);
  return response.text();
}

function jsonLdBlocks(html: string): Array<Record<string, unknown>> {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    (match) => JSON.parse(match[1]) as Record<string, unknown>,
  );
}

function canonicalOf(html: string): string | undefined {
  return html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
}

/** Next normalise le canonical de la racine sans slash final : les deux formes désignent la même URL. */
function expectedCanonical(path: string): string {
  return path === '/' ? SITE_URL : `${SITE_URL}${path}`;
}

/** Contenu sorti du flux principal par React (bloc `<div hidden id="S:n">`) : invisible sans JavaScript. */
function hasOutOfOrderSegment(html: string): boolean {
  return /<div hidden id="S:\d+"/.test(html);
}

test('/ sert un H1, du texte, le JSON-LD SoftwareApplication et le canonical sans JavaScript', async ({ request }) => {
  const html = await rawHtml(request, '/');

  expect(html).toMatch(/<h1[^>]*>[\s\S]*?Logiciel de gestion de garage au Cameroun[\s\S]*?<\/h1>/);
  expect(html).toContain('Réserver une démo');
  expect(html).not.toContain('Chargement en cours');

  expect(hasOutOfOrderSegment(html), 'contenu de / servi dans un bloc caché').toBe(false);
  expect(canonicalOf(html)).toBe(expectedCanonical('/'));
  expect(html).toMatch(/<meta property="og:title"/);
  expect(html).toMatch(/<meta name="twitter:card" content="summary_large_image"/);

  const software = jsonLdBlocks(html).find((block) => block['@type'] === 'SoftwareApplication');
  expect(software, 'JSON-LD SoftwareApplication absent de /').toBeDefined();
  expect(software).toMatchObject({
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    publisher: { '@id': 'https://www.trigenys.com/#org' },
  });
  const offers = software?.offers as Array<{ priceCurrency: string; price: number }>;
  expect(offers.length).toBeGreaterThan(0);
  expect(offers.every((offer) => offer.priceCurrency === 'XAF' && offer.price > 0)).toBe(true);
  expect((software?.featureList as string[]).length).toBeGreaterThan(0);
});

test('chaque page publique est rendue côté serveur avec un seul H1 et son canonical', async ({ request }) => {
  for (const page of MARKETING_PAGES) {
    const html = await rawHtml(request, page.path);
    expect(html.match(/<h1[\s>]/g)?.length, `${page.path} : un seul H1`).toBe(1);
    expect(canonicalOf(html), `${page.path} : canonical`).toBe(expectedCanonical(page.path));
    expect(hasOutOfOrderSegment(html), `${page.path} : contenu servi dans un bloc caché`).toBe(false);
  }
});

test('/faq expose un FAQPage dont les questions sont affichées', async ({ request }) => {
  const html = await rawHtml(request, '/faq');
  const faq = jsonLdBlocks(html).find((block) => block['@type'] === 'FAQPage');
  const questions = (faq?.mainEntity as Array<{ name: string }>) ?? [];
  expect(questions.length).toBeGreaterThan(0);
  for (const question of questions) {
    expect(html).toContain(question.name.replace(/'/g, '&#x27;'));
  }
});

test('une URL inconnue répond 404', async ({ request }) => {
  const response = await request.get('/cette-page-n-existe-pas-seo');
  expect(response.status()).toBe(404);
});

test('/accueil redirige en 301 vers /', async ({ request }) => {
  const response = await request.get('/accueil', { maxRedirects: 0 });
  expect(response.status()).toBe(301);
  expect(new URL(response.headers().location, 'http://x').pathname).toBe('/');
});

test('robots.txt, sitemap.xml et llms.txt sont servis', async ({ request }) => {
  const robots = await rawHtml(request, '/robots.txt');
  expect(robots).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
  expect(robots).toContain('Disallow: /dashboard/');
  expect(robots).not.toMatch(/^Disallow: \/planning-atelier/m);

  const sitemap = await rawHtml(request, '/sitemap.xml');
  for (const page of MARKETING_PAGES) {
    expect(sitemap).toContain(page.path === '/' ? `<loc>${SITE_URL}/</loc>` : `<loc>${SITE_URL}${page.path}</loc>`);
  }
  expect(sitemap).not.toContain('/dashboard');

  const llms = await rawHtml(request, '/llms.txt');
  expect(llms).toMatch(/^# Atelier Maître/);
  expect(llms).toContain('XAF');
  expect(llms).toContain('/demo');
  expect(llms).toContain('Trigenys');
});

test('formulaires de compte et espace applicatif portent noindex', async ({ request }) => {
  for (const path of ['/login', '/inscription', '/forgot-password', '/invitation/jeton-test', '/dashboard', '/workshop']) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.headers()['x-robots-tag'], `${path} : X-Robots-Tag`).toContain('noindex');
  }
  for (const page of MARKETING_PAGES) {
    const response = await request.get(page.path);
    expect(response.headers()['x-robots-tag'], `${page.path} doit rester indexable`).toBeUndefined();
  }
});

test('chaque route de premier niveau de app/ est classée (publique, noindex ou applicative)', () => {
  const appDir = join(__dirname, '..', 'app');
  const routeDirs = readdirSync(appDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('(') && !entry.name.startsWith('_'))
    .map((entry) => `/${entry.name}`)
    .filter((path) => !path.includes('.')); // fichiers de métadonnées (llms.txt…)
  const marketingRoots = MARKETING_PAGES.map((page) => page.path);
  const classified = new Set([...marketingRoots, ...NOINDEX_PUBLIC_PATHS, ...APP_PATH_PREFIXES]);
  const unclassified = routeDirs.filter((path) => !classified.has(path));
  expect(unclassified, 'Ajouter ces routes à lib/seo/site.ts').toEqual([]);
});

test('aucun loading.tsx n’enveloppe les pages publiques', () => {
  const appDir = join(__dirname, '..', 'app');
  // À la racine, il envelopperait toutes les pages dans un Suspense (voir LESSON-2026-017).
  expect(existsSync(join(appDir, 'loading.tsx')), 'app/loading.tsx enveloppe aussi la landing').toBe(false);
  for (const page of MARKETING_PAGES.filter((entry) => entry.path !== '/')) {
    expect(existsSync(join(appDir, '(marketing)', page.path, 'loading.tsx')), `${page.path} : loading.tsx`).toBe(false);
    expect(existsSync(join(appDir, page.path, 'loading.tsx')), `${page.path} : loading.tsx`).toBe(false);
  }
});
