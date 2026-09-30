/**
 * Reading the corpus's free-text costs.
 *
 * Costs arrive as whatever the paper wrote: "230", "<$1,500", "3000-7000", "677 EUR (~$730)",
 * "141 USD + 3D Printer", "$1,151.75 CAD (~$850)". This turns that into one shape the index
 * can show in a column without wrapping, sort by, and band into filters, while keeping the
 * verbatim string for the title attribute. Nothing here rewrites the source.
 *
 * Currencies were checked against the full texts rather than assumed. That mattered: four
 * records state a figure with no currency in the workbook but name one in the paper, and
 * three of those are not dollars -- the Nydus One extruder's specifications table reads
 * "Cost of Hardware 90 EUR". Where a paper genuinely names none, the display falls back to
 * USD and says so, rather than presenting an inference as a fact.
 */

/** Phrases meaning "this figure leaves something out", usually the host printer or robot. */
export const COST_PARTIAL =
  /(excl|exclud|\+|base\b|not includ|without the|add[- ]?on|host|on top of)/i;

const CURRENCY_WORD = /\b(USD|EUR|GBP|CAD|AUD|CHF|SEK|JPY)\b/i;

/**
 * Currency verified from the paper's own text, for records whose workbook entry omits it.
 * Keyed by the figure as recorded, since that is what identifies the row here.
 */
const VERIFIED_FROM_FULL_TEXT: Record<string, string> = {
  "90": "EUR", // Nydus One: "Cost of Hardware 90 EUR"
  "1150": "EUR", // hybrid bioprinter: bill of materials priced entirely in EUR
  "300": "USD", // bio-printer modification: "approximately 2900 SEK, or Approx. 300 USD"
  "830.19": "USD", // LusoBioMaker: "a total cost of $830.19"
  "230": "USD", // Custom Ultra-Low-Cost: "the cost of our bioprinter is extremely low (~$230)"
  "325": "USD", // Automated Liquid Handler: "at a cost of US $325"
  "500": "USD", // Melt Electrowriting: "the overall cost of the modifications is ~$500"
  "8000": "USD" // bIUreactor: "an all in cost of $8,000"
};

export interface ParsedCost {
  /** Figure to sort by: the low end of a range, the honest reading of "3000-7000". */
  value: number | null;
  /** ISO code, always populated when there is a figure at all. */
  currency: string;
  /** True when no source names the currency and USD is the fallback. */
  currencyInferred: boolean;
  /** "at most", from a leading "<". */
  atMost: boolean;
  /** Upper bound of a range, when the paper gave one. */
  high: number | null;
  /** The figure excludes host equipment. */
  partial: boolean;
  /** One line, no wrapping: "USD 1,200", "< GBP 300", "EUR 3,000–7,000". */
  display: string;
}

const NO_FIGURE: ParsedCost = {
  value: null,
  currency: "",
  currencyInferred: false,
  atMost: false,
  high: null,
  partial: false,
  display: ""
};

function detectCurrency(text: string, figure: string): { code: string; inferred: boolean } {
  // A named code wins over a bare symbol: "$1,151.75 CAD" is Canadian, not American.
  const word = text.match(CURRENCY_WORD);
  if (word) return { code: word[1].toUpperCase(), inferred: false };
  if (/€/.test(text)) return { code: "EUR", inferred: false };
  if (/£/.test(text)) return { code: "GBP", inferred: false };
  if (/\$/.test(text)) return { code: "USD", inferred: false };
  const verified = VERIFIED_FROM_FULL_TEXT[figure];
  if (verified) return { code: verified, inferred: false };
  return { code: "USD", inferred: true };
}

const round = (n: number) => (n >= 100 ? Math.round(n) : Math.round(n * 100) / 100);
const group = (n: number) => round(n).toLocaleString("en-GB");

export function parseCost(text: string): ParsedCost {
  const raw = (text || "").split("|")[0].trim();
  if (!raw || /^(n\/?a|\?+)/i.test(raw)) return NO_FIGURE;

  // Read figures from the part before any parenthetical, so "(~$730)" and "(base printer
  // EUR 350)" cannot be mistaken for the headline number.
  const head = raw.replace(/\([^)]*\)/g, " ");
  const numbers = (head.replace(/,/g, "").match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(Number.isFinite);
  if (numbers.length === 0) return NO_FIGURE;

  const value = numbers[0];
  const isRange = /\d\s*[-–—]\s*\d/.test(head.replace(/,/g, ""));
  const high = isRange && numbers.length > 1 ? numbers[1] : null;
  const atMost = /[<≤]/.test(head);
  const { code, inferred } = detectCurrency(raw, String(value));

  const amount = high !== null ? `${group(value)}–${group(high)}` : group(value);
  const display = `${atMost ? "< " : ""}${code} ${amount}`;

  return {
    value,
    currency: code,
    currencyInferred: inferred,
    atMost,
    high,
    partial: COST_PARTIAL.test(raw),
    display
  };
}

/** Kept for callers that only need the sortable figure. */
export function costFigure(text: string): number | null {
  return parseCost(text).value;
}

export const COST_BANDS = [
  { id: "u500", label: "Under 500", test: (v: number) => v < 500 },
  { id: "500-2k", label: "500 – 2,000", test: (v: number) => v >= 500 && v < 2000 },
  { id: "2k+", label: "2,000 and up", test: (v: number) => v >= 2000 }
] as const;

/**
 * Bands compare figures across currencies without converting them. USD, CAD, EUR and GBP
 * sit close enough together that no record lands in a different band for it; a rate-based
 * conversion would imply a precision these free-text figures do not have.
 */
export function costBand(value: number | null): string {
  if (value === null) return "";
  return COST_BANDS.find((band) => band.test(value))?.id ?? "";
}
