# How the Propose-a-paper form is wired

The Atlas is a static site with no backend. Every "send us something" path — **Propose a paper**, **Report a rebuild**, **Fill a gap in a record** — works the same way: the page builds a GitHub *new issue* URL whose query string pre-fills an issue form template, and opens it. Nothing is stored on the site; the issue is the submission.

```
browser form  ──►  URLSearchParams  ──►  https://github.com/<repo>/issues/new?template=<file>.yml&<field-id>=<value>…
                                                              │
                                        .github/ISSUE_TEMPLATE/<file>.yml declares the fields
```

GitHub's issue forms accept any declared `input`, `textarea` or `dropdown` field's `id` as a query parameter and pre-fill it (a dropdown only when the value matches an option exactly; checkboxes cannot be pre-filled). That is the whole contract: **the parameter names the script sends must be the `id`s in the YAML template.**

## The three paths

| Page | Script | Template | Labels |
|---|---|---|---|
| `/suggest` | `site/src/scripts/suggest-record.mjs` | `.github/ISSUE_TEMPLATE/suggest-record.yml` | `community-submission` |
| `/rebuild-report` | `site/src/scripts/rebuild-report.mjs` | `.github/ISSUE_TEMPLATE/rebuild-report.yml` | `rebuild-report` |
| Home page → "Fill a gap in a record" | none — a plain link | `.github/ISSUE_TEMPLATE/complete-record.yml` | `complete-record` |

The repository URL comes from one place, `site/src/config/site.ts`:

```ts
export const githubRepo = "AccelerationConsortium/dyi-biofabrication";
export const githubRepoUrl = `https://github.com/${githubRepo}`;
```

## Propose a paper, end to end

### 1. The six steps (`site/src/pages/suggest.astro`)

The form asks for everything the corpus records for a build, in the order a curator needs it. Each step is a `<fieldset data-step="n">`; only one is shown at a time, and the `<ol class="steps">` tabs jump between them.

| Step | What it collects | Control ids | Source of the options |
|---|---|---|---|
| 1 The paper | title *, DOI, journal + year, area *, instrument name, description *, why it belongs, submitter's role | `p-title` `p-doi` `p-venue` `p-area` `p-tool` `p-description` `p-why` `p-role` (radio) | areas from `papers[].category` |
| 2 What is open | repository or deposit, licence on the design files, skill needed, files provided, cost (amount · currency · what it covers) | `o-repo` `o-licence` `o-skill` `o-files` (checkboxes) `o-cost` `o-currency` `o-cost-note` | `FILE_TYPES` in `site/src/data/file-types.ts` |
| 3 Supplementary files | repeatable rows (what it holds · link · note) and an "I will attach files" tick | `#si-list .si-row` (`.si-kind` `.si-link` `.si-note`), `si-attach`; `#si-template` is cloned by **Add another item** | — |
| 4 Reported performance | value and location for each of the five standard measurements | `m-<metric>-value`, `m-<metric>-where` | `METRICS` in `site/src/data/metrics.ts` |
| 5 Your scores | a 1–5 radio, the anchor text for that score, and a justification, for each of the ten rubric criteria; a technique select chooses which anchor set is shown | `s-technique`, `s-<criterion>` (radio), `s-<criterion>-why` | `criteriaRubric` (from `lists/curated/criteria_rubric.csv`); each `.score-row` carries the anchors for all three techniques in `data-anchors` |
| 6 Review & send | preview, two confirmations, Copy details, Open GitHub issue, Clear the form | `suggest-preview` `c-links` `c-scores` `copy-details` `open-issue` `suggest-reset` | — |

Only step 1's three starred fields are required; the **Next** button and the step tabs refuse to move past step 1 until they are filled and say which are missing in `#suggest-status`.

Choosing an area in step 1 picks the matching rubric technique for step 5 (`data-technique` on each `<option>`: Bioprinting / Custom Printer / Electrospinning → Bioprinting; Liquid Handling / Bioreactors / Microscopy → Liquid Handling; Microfabrication / Microfluidics / Organ-on-chip → Microfabrication) unless the submitter has changed the technique select themselves.

### 2. The script (`suggest-record.mjs`)

On every `input`/`change` it rebuilds the draft, renders the preview, saves the draft to `sessionStorage` (key `atlas-propose-draft`, so a reload returns to the same step with the same values; cleared with the tab or by **Clear the form**), and sets the **Open GitHub issue** link's `href`. The link stays disabled until step 1 is complete *and* both confirmations in step 6 are ticked, because the template makes the same two checkboxes required and GitHub would otherwise reject the submission.

The multi-row and multi-line parts are folded into one text field each, one line per item, so the template has one `textarea` per step rather than one field per criterion:

```js
function issueUrl(d) {
  const params = new URLSearchParams({ template: "suggest-record.yml" });
  params.set("title", `Propose paper: ${d.title}`);
  set("paper", d.title);            set("doi", d.doi);          set("venue", d.venue);
  set("area", d.area);              set("instrument", d.tool);  set("role", ROLE_LABELS[d.role]);
  set("description", d.description); set("why", d.why);
  set("repo", d.repo);              set("licence", d.licence);  set("files", d.files.join(", "));
  set("cost", d.cost);              set("skill", d.skill);
  set("supplementary", supplementaryText(d));   // "- Bill of materials — <link> — Table 2"
  set("performance", performanceText(d));       // "Cell viability: 90 % (Fig. 6)"
  set("scores", scoresText(d));                 // "Resolution: 3 (100-500 um) — 300 µm strands, Fig. 4"
  return `${githubRepoUrl}/issues/new?${params.toString()}`;
}
```

Empty values are not sent. `files` is text rather than a checkbox field because checkboxes cannot be pre-filled from the URL. The `scores` block opens with the line `Anchors: <technique>. Proposed by the submitter; pending curator validation.` so the provenance travels with the numbers.

### 3. The template (`suggest-record.yml`)

Field `id`s, in order: `paper` · `doi` · `venue` · `area` (dropdown) · `instrument` · `role` (dropdown) · `description` · `why` · `repo` · `licence` · `files` · `cost` · `skill` (dropdown) · `supplementary` · `performance` · `scores` · `confirm` (two required checkboxes). Every key the script sends except `template` and `title` is one of these. The dropdown options in the template must stay identical to the site's option labels (`area` = the nine categories + Other; `role` = the three `ROLE_LABELS`; `skill` = Low / Medium / High), or the value silently fails to pre-fill.

### 4. Supplementary files

The site cannot receive files. Step 3 collects a list of items with links, and the template's `supplementary` textarea is where the submitter **drags the files** once the issue is open; GitHub stores them and inserts a link per file (25 MB each). The form says so and warns that attachments are public with the issue, so files that should carry a DOI go to a deposit and are linked instead. Curators find the list in the issue, read the files, and record what they hold in `lists/derived/supplementary_manifest.csv` when the record is built.

### 5. Proposed scores

Scores from step 5 are **proposals**. They arrive in the `scores` textarea, never in `lists/curated/criteria_assessment.csv`; a curator reads the paper against the cited evidence and enters validated values there, which is what the site shows. The technique line at the top of the block says which anchor set the submitter used.

### Worked example

Draft: title `The Enderstruder: an accessible open-source syringe extruder`, DOI `10.1016/j.ohx.2024.e00510`, area `Bioprinting`, role author, licence `CC-BY-SA-4.0`, files CAD + Bill of materials + Documentation, cost `150 USD (excluding the Ender-3 host printer)`, one supplementary row, two reported values, two scores.

URL the page opens (line-broken for reading; 1.4 kB in total):

```
https://github.com/AccelerationConsortium/dyi-biofabrication/issues/new
  ?template=suggest-record.yml
  &title=Propose+paper%3A+The+Enderstruder%3A+an+accessible+open-source+syringe+extruder
  &paper=The+Enderstruder%3A+an+accessible+open-source+syringe+extruder
  &doi=10.1016%2Fj.ohx.2024.e00510
  &venue=HardwareX%2C+2024
  &area=Bioprinting
  &instrument=Enderstruder
  &role=Author+of+the+paper
  &description=A+syringe+extruder+that+replaces+the+filament+head+of+an+Ender-3+printer.
  &repo=https%3A%2F%2Fgithub.com%2FCyberKea%2FEnderstruder
  &licence=CC-BY-SA-4.0
  &files=CAD%2C+Bill+of+materials%2C+Documentation
  &cost=150+USD+%28excluding+the+Ender-3+host+printer%29
  &skill=Low
  &supplementary=-+Bill+of+materials+%E2%80%94+https%3A%2F%2Fdoi.org%2F10.1016%2Fj.ohx.2024.e00510+%E2%80%94+Table+2%0A-+Files+attached+to+this+issue+%28dragged+in+below%29.
  &performance=Motion+accuracy%3A+50+%C2%B5m+%28Section+3.2%29%0ACell+viability%3A+90+%25+after+7+days+%28Fig.+6%29
  &scores=Anchors%3A+Bioprinting.+Proposed+by+the+submitter%3B+pending+curator+validation.%0AResolution%3A+3+%28100-500+um%29+%E2%80%94+300+%C2%B5m+strands%2C+Fig.+4%0ASkill+needed%3A+2+%28Requires+advanced+skills…%29
```

Browsers accept URLs of several kilobytes; a fully filled form with ten justified scores stays under 4 kB.

## Adding a field — example

Say step 2 should also capture the **firmware licence**.

1. **Form** (`suggest.astro`, inside the step-2 `.form-grid`):
   ```astro
   <label class="control-field">
     <span class="control-label">Firmware licence</span>
     <input id="o-firmware-licence" type="text" placeholder="e.g. GPL-3.0" />
   </label>
   ```
2. **Script** (`suggest-record.mjs`): read it in `readDraft` (`firmwareLicence: text("o-firmware-licence")`), print it in `previewText`, and send it in `issueUrl` with `set("firmware-licence", d.firmwareLicence)`.
3. **Template**: add an `input` with `id: firmware-licence`. Keep the two names identical; a mismatch does not error, the value silently does not pre-fill.

Adding a **step** means one more `<fieldset data-step="n">`, one more `<li class="step" data-step-tab="n">`, and `data-steps` on the form; the script reads the count from there.

## Fill a gap in a record (no form)

The home page's **Fill a gap in a record** button is a bare link to `/issues/new?template=complete-record.yml`. The template asks for the record, what is being supplied (cost · licence · design-file link), the value, and — required — where it comes from, because every value in the corpus carries a source.

Every record page that lacks a cost, a licence, a repository or a file inventory also carries **Fill a gap** (in the rail) and **Fill the gap** (a call-out under the criteria). Both open the same template pre-filled from the record, built in `site/src/pages/papers/[slug].astro`:

| Parameter | Value |
|---|---|
| `title` | `Complete record: <paper title>` |
| `record` | `<paper title> — https://biofabtoolkit.accelerationconsortium.ai/papers/<slug> — <DOI>` |
| `notes` | `Missing in the index today: cost; licence on the design files; link to the design files.` (only the fields this record lacks) |

The template's checkboxes (`fields`) cannot be pre-filled from a URL, so the gaps are spelled out in `notes` instead. The page address uses `siteUrl` from `site/src/config/site.ts`, not the request origin, so the link works when pasted anywhere.

## Rebuild report

Same pattern, with one addition: the page reads `?build=` from its own URL and pre-fills the **Which build** field, which is how a record page's *Report a rebuild* button arrives with the title and DOI already entered.

## Private repository

While `AccelerationConsortium/dyi-biofabrication` is private, `/issues/new` returns 404 to anyone outside the organisation. Both form pages say so and offer **Copy details** as the fallback. The forms need no change when the repository is made public.

## Checking it locally

1. `cd site && npm run dev`, open `/suggest`, fill step 1 and anything else, tick both confirmations in step 6.
2. In devtools: `new URL(document.getElementById("open-issue").href).searchParams` and confirm each key is an `id` in `suggest-record.yml`.
3. Reload the page: it should come back at the same step with the same values.
4. Opening the link in a browser signed in with repository access shows the form pre-filled; nothing is created until **Submit new issue** is clicked.
