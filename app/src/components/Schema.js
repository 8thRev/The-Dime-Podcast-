// src/components/Schema.js
// Component for rendering JSON-LD schema markup

// JSON.stringify does not escape `<`, and the contents of a <script> element
// are raw text: a literal `</script>` anywhere in the serialized schema closes
// the element early and everything after it is parsed as HTML. The schema is
// built from AI-generated transcript fields (summaries, FAQ answers, quotes,
// entity names — see lib/schema.ts + content/transcripts/*.json), which nobody
// reviews line by line, so that string can reach here.
//
// A unicode escape is valid inside a JSON string and parses back to `<`, so
// consumers (Google, LLM crawlers, schema validators) see identical data.
// Escaping `<` alone is sufficient — it also neutralizes `<!--`, the other
// sequence that changes the HTML tokenizer's state inside a script element.
export function serializeSchema(schema) {
  return JSON.stringify(schema).replace(/</g, '\\u003c');
}

export default function Schema({ schema }) {
  if (!schema) return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeSchema(schema) }}
    />
  );
}
