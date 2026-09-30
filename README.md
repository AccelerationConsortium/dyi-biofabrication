# DIY Biofabrication

Initial organized import of spreadsheet lists and accessible PDFs for the SDL6 DIY biofabrication review.

## Layout

- `lists/source_spreadsheets/`: original Excel source files
- `lists/derived/`: normalized and enriched CSV exports
- `pdfs/`: downloaded PDFs where a direct PDF URL was available from Semantic Scholar or Crossref
- `pdfs/pdf_manifest.csv`: per-paper download log with source URL and local filename

## Notes

- The PDF pass used the derived `unified_papers_pdf_availability.csv`.
- Some papers do not have a direct PDF URL in Crossref/Semantic Scholar, so `pdfs/` is intentionally incomplete.
- A few API matches were unresolved or rate-limited during lookup, so missing PDFs are not always definitive absence.
