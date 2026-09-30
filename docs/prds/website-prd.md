# PRD: DIY Biofabrication Knowledge Website

## 1. Product Summary

Build a lightweight, static public website for the DIY biofabrication corpus in `dyi-biofabrication` that helps researchers, labs, workshop organizers, and community builders discover, compare, and reuse open-source biofabrication tools.

The website should do three jobs well:

1. Present papers as browsable, searchable cards.
2. Connect papers to repos, PDFs, tools, skills, events, and 3D/CAD assets.
3. Support perspective-paper writing by making patterns in democratization, reproducibility, and knowledge transfer legible.

The site must be static-first so it can deploy on Cloudflare Pages with low cost and low operational overhead.

## 2. Goals

- Make the corpus easy to browse and share publicly.
- Surface relationships between papers, tools, repos, assets, and topics.
- Help users identify reproducible and teachable open-source systems.
- Support future LLM-assisted ingestion of new works through a stable ontology-backed schema.
- Keep the site fast, lightweight, and maintainable.

## 3. Non-Goals

- No user accounts or collaboration backend in v1.
- No runtime database in v1.
- No live ingestion pipeline from publisher APIs in v1.
- No full CAD hosting platform in v1.
- No generalized literature review product outside this corpus in v1.

## 4. Users

### Primary users

- Researchers writing reviews or perspective papers on open-source biofabrication.
- Experimental labs looking for tools they can build or adapt.
- Workshop and conference organizers curating demos and training materials.
- Open-source hardware developers who want comparable prior art.

### Secondary users

- Students entering biofabrication, automation, or open hardware.
- Community maintainers mapping gaps in reproducibility and documentation.

## 5. Problem Statement

The current corpus exists as spreadsheets, PDFs, manifests, and PageIndex outputs. It is valuable, but difficult to share and reason over as a community artifact. Users need a structured interface that makes the ecosystem legible, not just a folder of PDFs and tables.

The key problem is not only "find papers." It is:

- understand which tools exist,
- what is actually open,
- what skills are required,
- what assets are available,
- how papers connect to repos and learning pathways,
- and which systems are realistic for adoption, replication, or teaching.

## 6. Product Principles

- Static-first: all core browsing and search must work from a static build.
- Evidence-backed: every card should resolve to source artifacts.
- Graph-aware: papers are not standalone records; they are nodes in a connected knowledge graph.
- Lightweight: minimal runtime JS, fast first load, Cloudflare-friendly.
- Community-usable: filters and fields must support real discovery, not just academic metadata.
- Ontology-driven: new data should integrate cleanly through controlled schemas and relations.

## 7. Current Inputs Available

From the repo today:

- `lists/derived/unified_papers.csv`
- `lists/derived/unified_papers_pdf_availability.csv`
- OpenAlex-enriched paper availability CSV in local workspace
- `pdfs/pdf_manifest.csv`
- downloaded PDFs in `pdfs/`
- PageIndex JSON outputs in `pageindex/results/`
- PageIndex manifest in `pageindex/pageindex_manifest.csv`

Current corpus status at PRD time:

- ~71 unique paper records
- 26 downloaded PDFs in repo
- 22 PageIndex JSON outputs

## 8. Product Scope

### V1 scope

- Static website with card-based paper explorer
- Search by title, tool, repo, topic, and metadata
- Filtering by category, modality, PDF availability, repo availability, skill level, and event/demo readiness
- Detail pages for papers, tools, repos, topics
- Links to PDFs, PageIndex outputs, GitHub repos, and source metadata
- Basic ontology-backed data model and generated content pipeline

### V1.5 scope

- Event/workshop/conference pages
- Skill/lab-readiness views
- 3D/CAD asset pages and previews where real files exist
- Derived comparison pages and curated landing pages

### V2 scope

- LLM-assisted ingestion pipeline for new works
- Editorial review workflow for proposed new nodes/edges
- Structured evidence snippets from PageIndex outputs

## 9. Information Architecture

### Top-level routes

- `/`
- `/papers`
- `/tools`
- `/repos`
- `/topics`
- `/skills`
- `/events`
- `/assets`
- `/about`

### Detail routes

- `/papers/[slug]`
- `/tools/[slug]`
- `/repos/[slug]`
- `/topics/[slug]`
- `/skills/[slug]`
- `/events/[slug]`
- `/assets/[slug]`

### Supporting routes

- `/collections/workshop-ready`
- `/collections/with-cad`
- `/collections/with-pdf`
- `/collections/replicable`
- `/collections/liquid-handling`
- `/collections/bioprinting`

## 10. Core Data Model

### Entities

- `Paper`
- `Tool`
- `Repo`
- `Topic`
- `Skill`
- `Event`
- `Asset`
- `Organization`

### Required relations

- `Paper DESCRIBES Tool`
- `Repo IMPLEMENTS Tool`
- `Paper LINKS_TO Repo`
- `Tool BELONGS_TO Topic`
- `Tool REQUIRES Skill`
- `Paper PRESENTED_AT Event`
- `Tool HAS_ASSET Asset`
- `Organization MAINTAINS Repo`
- `Paper PRODUCED_BY Organization`

### Important controlled fields

- `topic`
- `category`
- `modality`
- `tool_type`
- `asset_type`
- `event_type`
- `skill_level`
- `replication_status`
- `documentation_quality`
- `license_type`
- `democratizing_features`

## 11. Functional Requirements

### 11.1 Paper Explorer

- Show all papers as cards.
- Support search by title, DOI, tool, topic, repo, skill, and asset terms.
- Support filters:
  - category
  - modality
  - year
  - has PDF
  - has repo
  - has CAD
  - has BOM
  - has protocol
  - has PageIndex output
  - workshop-ready
  - open-source confirmed
  - skill level

### 11.2 Paper Detail Page

Must show:

- title
- DOI
- year
- abstract or summary
- category and modality
- linked tool(s)
- linked repo(s)
- linked PDF
- PageIndex availability
- key democratizing feature(s)
- limitations
- skill requirements
- event/workshop/demo links if available
- related papers

### 11.3 Tool Pages

Must aggregate:

- all linked papers
- linked repos
- CAD/BOM/protocol assets
- skill requirements
- build complexity
- documentation quality
- topic membership
- replication/readiness status

### 11.4 Repo Pages

Must show:

- GitHub link
- linked papers
- linked tools
- asset links
- local corpus status if relevant
- maintenance/owner metadata where known

### 11.5 Search

- Full-site search must be static and local to the built site.
- Search should support metadata weighting and filtering.
- Search should work without a server backend.

### 11.6 Community Knowledge Views

Need curated views for:

- tools suitable for workshops
- tools with the strongest open documentation
- tools with CAD + BOM + protocol
- tools suitable for biology labs with low engineering capacity
- tools requiring advanced robotics/electronics skills

### 11.7 3D/CAD Layer

- Only show 3D model availability when real assets exist.
- Distinguish real CAD assets from conceptual renders.
- Support fields for STL/STEP/Fusion/SolidWorks where known.

## 12. Content and Metadata Requirements

### Paper fields

- id
- slug
- title
- doi
- year
- category
- modality
- venue
- summary
- pdf_available
- pdf_path
- pageindex_available
- repo_ids
- tool_ids
- topic_ids
- skill_ids
- asset_ids
- event_ids
- organization_ids
- democratizing_features
- limitations
- evidence_sources

### Tool fields

- id
- slug
- name
- tool_type
- category
- modality
- description
- paper_ids
- repo_ids
- asset_ids
- topic_ids
- skill_ids
- build_complexity
- ease_of_use
- documentation_quality
- replication_status

### Repo fields

- id
- slug
- name
- github_url
- local_path
- tool_ids
- paper_ids
- asset_ids
- organization_ids
- language
- hardware_software_type

### Event fields

- id
- slug
- name
- type
- year
- url
- associated_paper_ids
- associated_tool_ids
- notes

### Asset fields

- id
- slug
- type
- url_or_path
- tool_ids
- paper_ids
- format
- license
- preview_available

## 13. UX Requirements

- Homepage must explain why this corpus matters.
- Card layout must be fast to scan and visually distinct by category.
- Filters must be visible and usable on desktop and mobile.
- Search results must be meaningful without opening each card.
- Detail pages must have obvious links to PDF, repo, and related nodes.
- The site should feel like a research map, not a generic blog.

## 14. Technical Requirements

### Architecture

- Static generation only for core site
- Cloudflare Pages deployment target
- No required runtime server in v1
- Build from local structured data files

### Recommended stack

- Astro
- Pagefind
- generated JSON/YAML/Markdown content files
- minimal client-side JS for filters

### Build pipeline

1. Normalize corpus data
2. Generate ontology-conformant entity files
3. Generate routes/pages
4. Build static site
5. Build Pagefind search index
6. Deploy to Cloudflare Pages

## 15. Non-Functional Requirements

- Fast first load on mobile and desktop
- Low JS payload
- Search index should remain performant for low hundreds to low thousands of records
- Static deploy must not depend on private services
- Public pages should remain useful even when some PDFs or repos are missing

## 16. Success Metrics

### Product metrics

- User can find a paper in under 3 interactions
- User can identify whether a tool has PDF + repo + CAD in one screen
- User can filter to workshop-ready tools in under 10 seconds
- User can open related papers from a tool page without dead ends

### Project metrics

- 100% of current papers rendered as cards
- 100% of current downloaded PDFs linked correctly
- 100% of PageIndex outputs linked where available
- stable schema for future LLM-assisted ingestion

## 17. Risks

- Metadata quality is uneven across papers and repos.
- Some PDFs are blocked by publisher delivery constraints.
- PageIndex currently fails on a subset of PDFs.
- Repo links and CAD assets are incomplete for some works.
- Overcomplicated ontology too early could slow initial delivery.

## 18. Open Questions

- Should the canonical dataset live as JSON files or generated Astro collections?
- Do we want local PDF links only, or public-download-safe links only?
- Should failed PageIndex documents be hidden or shown with status?
- How far should event/workshop metadata be manually curated in v1?
- Should 3D previews be embedded in v1 or only linked as assets?

## 19. Milestones

### Milestone 1: Schema and generators

- define ontology-backed schema
- generate canonical entity files from current CSV/manifests

### Milestone 2: Static site MVP

- homepage
- paper cards
- paper detail pages
- repo/tool linking
- Pagefind search

### Milestone 3: Knowledge views

- topic pages
- tool pages
- workshop/skill filters
- curated collection pages

### Milestone 4: Extended knowledge graph

- events
- 3D/CAD assets
- replication and documentation scoring

### Milestone 5: LLM-assisted ingestion

- constrained ingestion schema
- reviewable proposed nodes/edges
- update pipeline for new papers

## 20. Recommended First Build Order

1. Create ontology and canonical entity schema.
2. Generate `papers`, `tools`, `repos`, and `topics` records from current files.
3. Build static paper explorer in Astro.
4. Add Pagefind search and metadata filters.
5. Add detail pages with graph links.
6. Add skills/events/assets once core navigation is stable.
