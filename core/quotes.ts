import { z } from "zod";
import Decimal from "decimal.js";

const amount = z.string().regex(/^[0-9]{1,9}(?:\.[0-9]{1,6})?$/);
export const sourceLineSchema = z.object({
  id: z.string().regex(/^L[0-9]{1,5}$/),
  locator: z.string().max(120),
  text: z.string().min(1).max(1600),
});
export const itemSchema = z.object({
  description: z.string().min(1).max(200),
  sku: z.string().max(80).nullable(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable(),
  unit_price: amount.nullable(),
  price_unit: z.enum(["each", "pack"]).nullable(),
  pack_size: z.number().int().min(1).max(100000).nullable(),
  moq: z.number().int().min(1).max(10000000).nullable(),
  moq_unit: z.enum(["each", "pack"]).nullable().default(null),
  lead_days: z.number().int().min(0).max(730).nullable(),
  source_ids: z
    .array(z.string().regex(/^L[0-9]{1,5}$/))
    .min(1)
    .max(8),
});
export const extractionSchema = z.object({
  supplier: z.string().max(160).nullable(),
  shipping_note: z.string().max(600).nullable(),
  items: z.array(itemSchema).min(1).max(40),
});
export type QuoteItem = z.infer<typeof itemSchema>;
export type SourceLine = z.infer<typeof sourceLineSchema>;
export type Extraction = z.infer<typeof extractionSchema>;
export const reviewItemSchema = itemSchema
  .omit({ source_ids: true })
  .extend({
    group_key: z.string().trim().min(1).max(100),
    reviewed: z.boolean(),
  });
export const reviewSchema = z.object({
  revision: z.number().int().min(1),
  note: z.string().trim().min(1).max(500),
  items: z.array(reviewItemSchema).min(1).max(40),
  supplier: z.string().max(160).nullable().optional(),
  shipping_note: z.string().max(600).nullable().optional(),
});
export type ReviewItem = z.infer<typeof reviewItemSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type ExtractionResult = {
  extraction: Extraction;
  lines: SourceLine[];
  model: string;
  duration_ms: number;
  warnings: string[];
  checks: { item: number; code: string }[];
};

function hasNumber(text: string, value: string | number): boolean {
  const target = new Decimal(value);
  return (text.match(/[0-9]+(?:[.,][0-9]+)*/g) ?? []).some((token) => {
    // Comma decimals or thousands are ambiguous; leave them for explicit review.
    try {
      return !token.includes(",") && new Decimal(token).eq(target);
    } catch {
      return false;
    }
  });
}
export function validateExtraction(
  value: unknown,
  source: unknown,
): {
  extraction: Extraction;
  lines: SourceLine[];
  checks: ExtractionResult["checks"];
} {
  const extraction = extractionSchema.parse(value);
  const lines = z.array(sourceLineSchema).min(1).max(240).parse(source);
  if (new Set(lines.map((line) => line.id)).size !== lines.length)
    throw new Error("duplicate_source_ids");
  const lookup = new Map(lines.map((line) => [line.id, line.text]));
  const checks: ExtractionResult["checks"] = [];
  for (const [index, item] of extraction.items.entries()) {
    if (item.source_ids.some((id) => !lookup.has(id)))
      throw new Error("unknown_source_id");
    const text = item.source_ids.map((id) => lookup.get(id)).join("\n");
    for (const key of [
      "unit_price",
      "pack_size",
      "moq",
      "lead_days",
    ] as const) {
      if (item[key] !== null && !hasNumber(text, item[key]!))
        checks.push({ item: index, code: `${key}_not_in_source` });
    }
    if (!item.currency) checks.push({ item: index, code: "currency_unknown" });
    if (!item.price_unit)
      checks.push({ item: index, code: "price_unit_unknown" });
    if (item.price_unit === "pack" && !item.pack_size)
      checks.push({ item: index, code: "pack_size_unknown" });
    if (item.unit_price === null || new Decimal(item.unit_price).lte(0))
      checks.push({ item: index, code: "price_unknown" });
    if (
      item.price_unit === "each" &&
      /每箱|每盒|每包|per\s+(?:carton|box|pack)/i.test(text)
    )
      checks.push({ item: index, code: "pack_basis_conflict" });
    if (item.moq === null && /起订|最低订|minimum\s+order|\bMOQ\b/i.test(text))
      checks.push({ item: index, code: "moq_omitted" });
    if (item.moq !== null && !item.moq_unit)
      checks.push({ item: index, code: "moq_unit_unknown" });
    const orderLines = text
      .split("\n")
      .filter((line) => /起订|最低订|minimum\s+order|\bMOQ\b/i.test(line))
      .join("\n");
    if (
      item.moq_unit === "pack" &&
      /pieces|\beach\b|[0-9]+\s*件/i.test(orderLines)
    )
      checks.push({ item: index, code: "moq_unit_conflict" });
    if (
      item.moq_unit === "each" &&
      /cartons|boxes|packs|[0-9]+\s*[箱包盒]/i.test(orderLines)
    )
      checks.push({ item: index, code: "moq_unit_conflict" });
    const currencyNames: Record<string, RegExp> = {
      USD: /\bUSD\b|US\s*dollar|美元|美金/i,
      EUR: /\bEUR\b|euro|欧元|€/i,
      CNY: /\bCNY\b|\bRMB\b|人民币|元/i,
      GBP: /\bGBP\b|pound|英镑|£/i,
    };
    if (
      item.currency &&
      !(
        currencyNames[item.currency] ?? new RegExp(`\\b${item.currency}\\b`)
      ).test(text)
    )
      checks.push({ item: index, code: "currency_not_in_source" });
    if (
      lines.some((line) =>
        /ignore.{0,25}instructions|system\s*prompt|忽略.{0,12}指令|set every price/i.test(
          line.text,
        ),
      )
    )
      checks.push({ item: index, code: "document_instruction_text" });
  }
  return { extraction, lines, checks };
}

export function initialReview(result: ExtractionResult): ReviewItem[] {
  return result.extraction.items.map((item) => {
    const { source_ids, ...fields } = item;
    void source_ids;
    return {
      ...fields,
      moq_unit: item.moq_unit ?? null,
      group_key: (item.sku || item.description).slice(0, 100),
      reviewed: false,
    };
  });
}
export type Offer = ReviewItem & {
  document_id: string;
  supplier: string;
  filename: string;
  item_index: number;
  shipping_note: string | null;
  price_each: string | null;
  issues: string[];
};
export function compareDocuments(
  documents: {
    id: string;
    filename: string;
    result: ExtractionResult;
    review: ReviewItem[] | null;
  }[],
): {
  groups: { key: string; currency: string; offers: Offer[] }[];
  pending: number;
} {
  const groups = new Map<
    string,
    { key: string; currency: string; offers: Offer[] }
  >();
  let pending = 0;
  for (const doc of documents) {
    const items = doc.review ?? initialReview(doc.result);
    for (const [index, item] of items.entries()) {
      if (!item.reviewed) {
        pending++;
        continue;
      }
      const issues: string[] = [];
      if (!item.currency) issues.push("currency_unknown");
      if (!item.price_unit) issues.push("price_unit_unknown");
      if (item.price_unit === "pack" && !item.pack_size)
        issues.push("pack_size_unknown");
      if (!item.unit_price || new Decimal(item.unit_price).lte(0))
        issues.push("price_unknown");
      const priceEach = issues.length
        ? null
        : new Decimal(item.unit_price!)
            .div(item.price_unit === "pack" ? item.pack_size! : 1)
            .toFixed(8);
      const key = JSON.stringify([item.group_key.trim(), item.currency ?? "?"]);
      if (!groups.has(key))
        groups.set(key, {
          key: item.group_key.trim(),
          currency: item.currency ?? "?",
          offers: [],
        });
      groups
        .get(key)!
        .offers.push({
          ...item,
          document_id: doc.id,
          supplier: doc.result.extraction.supplier ?? doc.filename,
          filename: doc.filename,
          item_index: index,
          shipping_note: doc.result.extraction.shipping_note,
          price_each: priceEach,
          issues,
        });
    }
  }
  return {
    groups: [...groups.values()].map((group) => ({
      ...group,
      offers: group.offers.sort((a, b) =>
        a.price_each === null
          ? 1
          : b.price_each === null
            ? -1
            : new Decimal(a.price_each).comparedTo(b.price_each),
      ),
    })),
    pending,
  };
}

/** Prevent spreadsheet formula execution while retaining values as data. */
export function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
