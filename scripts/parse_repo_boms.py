#!/usr/bin/env python3
"""Parse the BOM spreadsheets fetched from paper repositories into one table.

Every project lays its BOM out differently -- different sheet names, header rows that
are not row 1, different column wording, prices in different currencies. This finds the
header row by looking for known column words, maps the columns it recognises, and
writes lists/derived/repo_bom_items.csv.
"""
import csv
import os
import re

import openpyxl

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(REPO, "pdfs", "repo_boms")
OUT = os.path.join(REPO, "lists", "derived", "repo_bom_items.csv")

FIELDS = ["paper", "source_file", "sheet", "item", "designator", "quantity",
          "unit_cost", "line_price", "currency", "supplier", "part_number"]

COLUMN_HINTS = {
    "item": ("component", "item", "description", "part name", "name", "product"),
    "designator": ("designator", "hierarchy", "module", "function", "ref"),
    # "units purchased" first: it is the count that pairs with a purchase price.
    "quantity": ("units purchased", "number of item", "quantity", "qty", "number", "items needed"),
    "unit_cost": ("cost per unit", "cost per item", "unit cost", "price per", "unit price"),
    "line_price": ("total cost", "total price", "price in", "line price", "subtotal", "total"),
    "supplier": ("manufacturer", "supplier", "vendor", "source", "purchase"),
    "part_number": ("part-number", "part number", "partnumber", "sku", "catalog"),
}

CURRENCY = [("USD", r"\bUSD\b|\$"), ("EUR", r"\bEUR\b|€"), ("GBP", r"\bGBP\b|£"), ("AUD", r"\bAUD\b")]

# Rows that are notes or subtotals rather than parts. They frequently sit in the item
# column with the sheet's grand total beside them.
FOOTER_ROW = re.compile(
    r"(prices?\s+and\s+links|valid\s+as\s+of|^total\b|\btotal\s*(cost|price|sum)|"
    r"^sum\b|^subtotal|grand\s+total|^notes?$|^see\b|^\*)", re.I)


def clean(v):
    return re.sub(r"\s+", " ", str(v)).strip() if v is not None else ""


def find_header(rows, limit=12):
    """The header is the earliest row that names at least two columns we understand."""
    best, best_score = None, 0
    for i, row in enumerate(rows[:limit]):
        cells = [clean(c).lower() for c in row]
        if not any(cells):
            continue
        score = sum(1 for key, hints in COLUMN_HINTS.items()
                    if any(any(h in c for h in hints) for c in cells))
        if score > best_score:
            best, best_score = i, score
    return best if best_score >= 2 else None


def map_columns(header_cells):
    """Map columns by hint priority, not by column position.

    A BOM may carry both "Items needed" (how many the build consumes) and "Units
    Purchased" (how many packs you buy). Costing must use the purchased count against
    the purchase price -- pairing "items needed" with a per-pack price inflates the
    total, e.g. 22 jumper cables x the price of a 40-pack.
    """
    mapping = {}
    for key, hints in COLUMN_HINTS.items():
        for hint in hints:                       # hints are in priority order
            for i, cell in enumerate(header_cells):
                if hint in cell.lower():
                    if key == "line_price" and mapping.get("unit_cost") == i:
                        continue
                    if i in mapping.values() and key != "item":
                        continue                 # don't claim a column twice
                    mapping.setdefault(key, i)
                    break
            if key in mapping:
                break
    return mapping


def currency_for(header_cells, sheet_text, filename=""):
    # Header wording is the most reliable ("Cost per unit (USD)"), then the sheet body,
    # then the workbook name.
    for blob in (" ".join(header_cells), sheet_text[:3000], filename):
        for code, pattern in CURRENCY:
            if re.search(pattern, blob, re.I):
                return code
    return ""


def parse_file(path, paper):
    wb = openpyxl.load_workbook(path, data_only=True)
    out = []
    for sheet in wb.sheetnames:
        ws = wb[sheet]
        rows = list(ws.iter_rows(values_only=True))
        if len(rows) < 3:
            continue
        h = find_header(rows)
        if h is None:
            continue
        header_cells = [clean(c) for c in rows[h]]
        cols = map_columns(header_cells)
        # Some BOMs name the part column "Designator" and have no separate item column.
        if "item" not in cols and "designator" in cols:
            cols["item"] = cols.pop("designator")
        if "item" not in cols:
            continue
        sheet_text = " ".join(clean(c) for r in rows[h:h + 30] for c in r if c is not None)
        cur = currency_for(header_cells, sheet_text, os.path.basename(path))

        for row in rows[h + 1:]:
            def cell(key):
                i = cols.get(key)
                return clean(row[i]) if i is not None and i < len(row) else ""

            item = cell("item")
            if not item or item.lower() in ("component", "item", "total", "sum", "description"):
                continue
            # Footer and note rows often carry the sheet's grand total in a price column.
            # Counting them as parts double-counts the whole BOM.
            if FOOTER_ROW.search(item):
                continue
            rec = {
                "paper": paper,
                "source_file": os.path.basename(path),
                "sheet": sheet,
                "item": item[:110],
                "designator": cell("designator")[:40],
                "quantity": cell("quantity")[:16],
                "unit_cost": cell("unit_cost")[:20],
                "line_price": cell("line_price")[:20],
                "currency": cur,
                "supplier": cell("supplier")[:48],
                "part_number": cell("part_number")[:40],
            }
            if rec["unit_cost"] or rec["line_price"] or rec["part_number"] or rec["supplier"]:
                out.append(rec)
    return out


def paper_from_filename(name):
    return re.sub(r"__.*$", "", name).replace("_", " ").strip()


def to_number(v):
    v = re.sub(r"[^\d.,-]", "", str(v)).replace(",", "")
    try:
        return float(v)
    except ValueError:
        return None


def main():
    rows = []
    for f in sorted(os.listdir(SRC)):
        if not f.lower().endswith((".xlsx", ".xls")):
            continue
        rows.extend(parse_file(os.path.join(SRC, f), paper_from_filename(f)))

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)

    print(f"parsed {len(rows)} line items -> {OUT}\n")
    by_paper = {}
    for r in rows:
        by_paper.setdefault(r["paper"], []).append(r)
    for paper, items in sorted(by_paper.items()):
        priced = [i for i in items if i["line_price"] or i["unit_cost"]]
        total = 0.0
        for i in items:
            line = to_number(i["line_price"])
            if line is None:
                unit, qty = to_number(i["unit_cost"]), to_number(i["quantity"])
                line = unit * qty if unit is not None and qty is not None else None
            if line:
                total += line
        cur = next((i["currency"] for i in items if i["currency"]), "")
        print(f"  {paper[:44]:46s} {len(items):4d} items, {len(priced):4d} priced, "
              f"total ~{total:,.0f} {cur}")


if __name__ == "__main__":
    main()
