import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NOTIFICATION_CATALOG, templateName } from '../customer-notification-catalog';

type Draft = {
  schemaVersion: number;
  approvalState: string;
  metaCategory: string;
  languageCodes: string[];
  templates: Array<{
    eventType: string;
    name: string;
    category: string;
    variableKeys: string[];
    languages: Record<string, { body: string; exampleValues: string[] }>;
    urlButton?: {
      index: number;
      text: Record<string, string>;
      url: string;
      exampleSuffix: string;
    };
  }>;
};

const manifest = JSON.parse(
  readFileSync(join(process.cwd(), 'docs/whatsapp-utility-templates.json'), 'utf8'),
) as Draft;

describe('Meta WhatsApp Utility templates FR/EN — proposition non approuvée', () => {
  it('reste désactivé et ne présume jamais de la validation par Meta', () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.approvalState).toBe('DRAFT_NOT_SUBMITTED');
    expect(manifest.metaCategory).toBe('UTILITY');
    expect(manifest.languageCodes).toEqual(['fr', 'en']);
    expect(manifest.templates).toHaveLength(8);
  });

  it('couvre exactement le catalogue métier Atelier Maître sans dérive de nom ni de variables', () => {
    const catalogEvents = Object.keys(NOTIFICATION_CATALOG).sort();
    const draftEvents = manifest.templates.map((t) => t.eventType).sort();
    expect(draftEvents).toEqual(catalogEvents);

    for (const draft of manifest.templates) {
      const eventType = draft.eventType as keyof typeof NOTIFICATION_CATALOG;
      const canonical = NOTIFICATION_CATALOG[eventType];
      expect(draft.name).toBe(templateName(eventType));
      expect(draft.variableKeys).toEqual(canonical.variables);
      expect(draft.category).toBe('UTILITY');
      expect(Object.keys(draft.languages).sort()).toEqual(['en', 'fr']);

      for (const lang of ['fr', 'en'] as const) {
        const localized = draft.languages[lang];
        expect(localized.body).toBeTruthy();
        expect(localized.body.length).toBeLessThanOrEqual(1024);
        expect(localized.body).not.toMatch(/[\r\n\t]| {5}/);
        expect(localized.body).not.toMatch(/^\s*\{\{\d+\}\}|\{\{\d+\}\}\s*$/);
        const placeholders = [...localized.body.matchAll(/\{\{(\d+)\}\}/g)]
          .map((match) => Number(match[1]));
        expect(placeholders).toEqual(canonical.variables.map((_, i) => i + 1));
        expect(localized.exampleValues).toHaveLength(canonical.variables.length);
        for (const sample of localized.exampleValues) {
          expect(sample.trim().length).toBeGreaterThan(1);
          expect(sample).not.toMatch(/\{\{|\}\}/);
        }
      }
      if (canonical.urlButton) {
        expect(draft.urlButton).toBeDefined();
        expect(draft.urlButton?.index).toBe(canonical.urlButton.index);
        expect(draft.urlButton?.url).toBe('https://atelier.trigenys.com/devis/{{1}}');
        expect(draft.urlButton?.exampleSuffix).toMatch(/^[A-Za-z0-9_-]{16,256}$/);
        expect(draft.urlButton?.text.fr).toBeTruthy();
        expect(draft.urlButton?.text.en).toBeTruthy();
      } else {
        expect(draft.urlButton).toBeUndefined();
      }
    }
  });
});
