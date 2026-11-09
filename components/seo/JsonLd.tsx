/**
 * Script JSON-LD rendu côté serveur. `<` est échappé pour qu'aucune donnée
 * ne puisse fermer la balise script.
 */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\u003c') }}
    />
  );
}
