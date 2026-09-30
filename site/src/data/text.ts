/**
 * First sentence of a block of prose, for the one line a card or panel has room for.
 *
 * Breaks at the first full stop that follows at least 40 characters, so "e.g." and "3D."
 * inside a clause do not cut the sentence short, and caps the result so a run-on abstract
 * still fits.
 */
export function firstSentence(text: string, max = 220): string {
  const flat = (text || "").replace(/\s+/g, " ").trim();
  const m = flat.match(/^.{40,}?[.!?](?=\s|$)/);
  const out = m ? m[0] : flat;
  return out.length > max ? `${out.slice(0, max - 3).trimEnd()}…` : out;
}
