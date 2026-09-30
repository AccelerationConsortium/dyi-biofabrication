# Paper gap audit

Generated 2026-09-29 from `lists/derived/unified_papers.csv` (the curated table), `site/src/data/generated/papers.json` (the built corpus), `lists/derived/fulltext_extraction.csv`, and a regex pass over the 60 full texts in `pdfs/markdown/`. The row-level data is in `paper_gap_audit.csv` beside this file. Third-party tools a paper merely cites (Prusa firmware, Cura, Slic3r, pyuarm) and bare host roots are filtered out of the leads.

## Where the corpus stands

| | count |
|---|---|
| Papers | 60 |
| Full text held (markdown) | 60 |
| No cost stated | 27 |
| Cost stated without a currency | 10 |
| No design-file licence | 40 (was 47 before the verified leads were added on 2026-09-29) |
| No reachable repository | 31 (was 41) |
| Repository present, files not inventoried | 20 (was 11; the ten new repositories are not inventoried yet) |

## Table versus corpus

Every cost (25) and repository (12) difference is the corpus filling a blank the table left, from the full text or the verified-links list. Three licences run the other way -- the table has one and the corpus does not:

- **013** Commit: Digital pipette: open hardware for liquid transfer in self-driving la… -- table says "CC BY 3.0 (per RSC page)"; corpus has none.
- **043** The Enderstruder: An accessible open-source syringe extruder compatible with … -- table says "CC-BY-SA 4.0 (per paper specs table)"; corpus has none.
- **045** Hydrogel Patterns in Microfluidic Devices by Do-It-Yourself UV-Photolithograp… -- table says "CC BY 4.0"; corpus has none.

`013` and `045` are the article's licence, which the pipeline excludes on purpose. `043` (Enderstruder) cites the paper's own specifications table -- a design-file licence -- and is missing from `fulltext_extraction.csv` altogether (46 rows for 60 papers), so the pipeline never sees it. It also flags `018` as having no full text in `reported_metrics.csv` although its markdown exists; the metrics extraction should be re-run for it.

## 1. Repository leads -- text names a URL the corpus does not hold

- **002** A 3D-Printed Plate Handler for Automated Handling of Well Plates on the Opent…<br>  `https://github.com/Robertbolt97/Claw-with-OT-2`, `https://doi.org/10.5281/zenodo.15394622`, `https://www.thingiverse.com/thing:2563118`
- **004** A high performance open-source syringe extruder optimized for extrusion and r…<br>  `https://doi.org/10.5281/zenodo.4119127`
- **028** Low-cost, versatile, and highly reproducible microfabrication pipeline to gen…<br>  `https://doi.org/10.17605/OSF.IO/39WSB`
- **028** Low-cost, versatile, and highly reproducible microfabricatio… — github.com/SerioLab/SOL3D (license=none pushed=2023-10-16 desc=A public resource and design repository from the Serio Lab for microfabrication ), named in the text. The audit's OSF lead (OSF.IO/39WSB) was BIO-SPEC's (049) and is dropped.
- **030** Nydus One Syringe Extruder (NOSE): A Prusa i3 3D printer conversion for biopr…<br>  `https://osf.io/8c9qr`, `https://github.com/NydusOne/gcode-`, `https://www.instructables.com/id/DIY-BioPrinter/`
- **031** Open-source cell culture automation system with integrated cell counting for …<br>  `https://github.com/czbiohub-sf/2024-accs-pub`
- **035** OpenLH: Open Liquid-Handling System for Creative Experimentation with Biology<br>  `https://www.instructables.com/id/OpenLH/`

## 2. Repository leads -- an availability statement to read

- **001** 3D bioprinting of collagen-based high-resolution internally perfusable scaffo…<br>  > materials availability: All data needed to evaluate the conclusions in the paper are present in
- **009** An open source extrusion bioprinter based on the E3D motion system and tool c…<br>  > Data availability
- **015** Design and Implementation of an Accessible 3D Bioprinter: Benchmarking the Pe…<br>  > Data Availability Statement: Not applicable.
- **016** Design and Validation of a Piston-Driven Syringe-Extrusion Bioprinter Using a…<br>  > Data Availability Statement: The raw data supporting the conclusions of this article will be made
- **019** Designing cost-effective open-source multihead 3D bioprinters<br>  > Data Availability ender-3-3d-printer[Lastaccessed:November11,2021].
- **021** Development of a high-performance open-source 3D bioprinter<br>  > Data availability
- **023** Extrusion-Based Bioprinting in a Cost-Effective Bioprinter<br>  > Data Availability Statement: Data are contained within the article.
- **041** Srishti: a custom-built laser-assisted 3D bioprinter for fabricating high-res…<br>  > Data availability
- **042** STARTER: a stand-alone reconfigurable and translational organ-on-chip platfor…<br>  > Data availability
- **048** LusoBioMaker: A low-cost 3D bioprinter with multi-extrusion and contour print…<br>  > Data availability
- **052** A Custom Ultra-Low-Cost 3D Bioprinter Supports Cell Growth and Differentiation<br>  > DATA AVAILABILITY STATEMENT
- **058** 3D Printing of Individualized Microfluidic Chips with DLP-Based Printer<br>  > Data Availability Statement: Data available upon request.
- **060** Modular microfluidic systems cast from 3D-printed molds for imaging leukocyte…<br>  > Data Availability

## 3. Repository -- nothing in the text; check the supplementary information

- **006** A robot-assisted acoustofluidic end effector (40 SI mentions)
- **007** A simple method of fabricating mask-free microfluidic devices for biological … (no SI mentioned)
- **011** Analytical Measurements and Efficient Process Generation Using a Dual–Arm Rob… (no SI mentioned)
- **014** Design and implementation of a low cost bio-printer modification, allowing fo… (no SI mentioned)
- **018** Design of an Open-Source, Low-Cost Bioink and Food Melt Extrusion 3D Printer (5 SI mentions)
- **020** Development and implementation of a significantly low-cost 3D bioprinter usin… (5 SI mentions)<br>  table "open_source_resources": GitHub, CAD files, assembly schematics
- **022** Development of a microfluidic-assisted open-source 3D bioprinting system (MOS… (2 SI mentions)
- **024** Fabrication and validation of an affordable DIY coaxial 3D extrusion bioprinter (1 SI mention)
- **026** Homebrew photolithography for the rapid and low-cost,“Do It Yourself” prototy… (1 SI mention)
- **027** Leveraging flexible pipette-based tool changes to transform liquid handling s… (3 SI mentions)
- **029** Mask-free laser lithography for rapid and low-cost microfluidic device fabric… (5 SI mentions)
- **034** Open-source, community-driven microfluidics with Metafluidics (8 SI mentions)
- **039** Real-time AI-driven quality control for laboratory automation: a novel comput… (no SI mentioned)
- **044** The ‘bIUreactor’: an open-source 3D tissue research platform (2 SI mentions)
- **045** Hydrogel Patterns in Microfluidic Devices by Do-It-Yourself UV-Photolithograp… (no SI mentioned)
- **046** Adapting a Low-Cost and Open-Source Commercial Pipetting Robot for Nanoliter … (4 SI mentions)
- **047** mSLAb–An open-source masked stereolithography (mSLA) bioprinter (4 SI mentions)
- **051** Enhanced Growth of Bacterial Cells in a Smart 3D Printed Bioreactor (no SI mentioned)
- **054** Automated Liquid Handler from a 3D Printer (2 SI mentions)
- **055** Establishment of low-cost laboratory automation processes using AutoIt and 4-… (2 SI mentions)
- **057** An open-source programmable smart pipette for portable cell separation and co… (1 SI mention)
- **059** Melt Electrowriting of Nylon‐12 Microfibers with an Open‐Source 3D Printer (5 SI mentions)

## 4. Licence leads

Strong: the text names a software or hardware licence, or the repository host reports one.

- **002** A 3D-Printed Plate Handler for Automated Handling of Well Plates on the Opent… --  text: CERN-OHL-S Strongly reciprocal
- **022** Development of a microfluidic-assisted open-source 3D bioprinting system (MOS… --  text: GNU General Public License | GPLv3
- **028** Low-cost, versatile, and highly reproducible microfabrication pipeline to gen… --  text: GPLv3
- **030** Nydus One Syringe Extruder (NOSE): A Prusa i3 3D printer conversion for biopr… --  text: GPLv3
- **034** Open-source, community-driven microfluidics with Metafluidics --  text: Apache

Possible: a Creative Commons licence stated near *design files*, *CAD*, *source code*. Read the sentence; it may still be the article licence.

- **014** Design and implementation of a low cost bio-printer modification, allowing fo… -- CC BY-SA 4.0 | CC BY-SA 4.0 | CC BY-SA 4.0
- **027** Leveraging flexible pipette-based tool changes to transform liquid handling s… -- CCBY4.0 | CCBY4.0 | CCBY4.0
- **042** STARTER: a stand-alone reconfigurable and translational organ-on-chip platfor… -- CC-BY 4.0
- **050** Technical upgrade of an open-source liquid handler to support bacterial colon… -- CCBY

Repository present, no licence anywhere in the text: check the repository's LICENSE file.

- **005** A Low-Cost, Open-Source 3D Printer for Multimaterial and High-Throughput Dire… -- `https://github.com/weiss-jonathan/Printess-Low-Cost-3D-Printer`
- **008** A Versatile Open-Source Printhead for Low-Cost 3D Microextrusion-Based Biopri… -- `https://3dprint.nih.gov/users/telab`
- **010** An Open-Source 3D Bioprinter Using Direct Light Processing for Tissue Enginee… -- `https://osf.io/nzfer`
- **013** Commit: Digital pipette: open hardware for liquid transfer in self-driving la… -- `https://github.com/ac-rad/digital-pipette-v2`
- **037** Principles of computer-controlled linear motion applied to an open-source aff… -- `https://openliquidhandler.com/`
- **040** Sidekick: A Low-Cost Open-Source 3D-printed liquid dispensing robot -- `https://github.com/rodolfokeesey/Liquid-Handler`
- **043** The Enderstruder: An accessible open-source syringe extruder compatible with … -- `https://doi.org/10.17605/OSF.IO/9ARYM`
- **056** EvoBot: An Open-Source, Modular, Liquid Handling Robot for Scientific Experim… -- `https://bitbucket.org/afaina/evobliss-hardware`

Only the article's own CC licence appears in the text for 23 papers; those are not leads.

## 5. Cost leads -- a figure in the text, none in the corpus

- **001** 3D bioprinting of collagen-based high-resolution internally perfusable scaffo… --  text: "$1500) desktop plastic"
- **006** A robot-assisted acoustofluidic end effector --  text: "$5,000.https://opentrons"
- **007** A simple method of fabricating mask-free microfluidic devices for biological … --  text: "$30.00"
- **019** Designing cost-effective open-source multihead 3D bioprinters --  text: "$400USD"
- **027** Leveraging flexible pipette-based tool changes to transform liquid handling s… --  text: "$10,000USD(OT-2)+$110USD(HardwareModule)"
- **028** Low-cost, versatile, and highly reproducible microfabrication pipeline to gen… --  text: "6000 EUR for four reactors (1600 EUR fixed cost, 1100 EUR"
- **029** Mask-free laser lithography for rapid and low-cost microfluidic device fabric… --  text: "$1.00perchipcouldsignificantlydemocratizedevicefabricat"
- **031** Open-source cell culture automation system with integrated cell counting for … --  text: "$18,250 (26)), but an automated liquid handler would have"
- **034** Open-source, community-driven microfluidics with Metafluidics --  text: "$0.10–0"
- **043** The Enderstruder: An accessible open-source syringe extruder compatible with … --  text: "$10,000,theopen-sourcerobotsareatleastoneorderofmagnitudec"
- **051** Enhanced Growth of Bacterial Cells in a Smart 3D Printed Bioreactor --  text: "7EUR) rial1 ("
- **053** Teach your microscope how to print: low-cost and rapid-iteration microfabrica… --  text: "$162"
- **057** An open-source programmable smart pipette for portable cell separation and co… --  text: "$0.8),"
- **060** Modular microfluidic systems cast from 3D-printed molds for imaging leukocyte… --  text: "360 CAD software are presented in Supplementary Fig"

## 6. Currency leads -- a figure without a currency, and the text names one

- **014** Design and implementation of a low cost bio-printer modification, allowing fo… -- corpus "300 (excluding the cost of the printer)"; text: "000 USD for the most basic system and going up to several"
- **018** Design of an Open-Source, Low-Cost Bioink and Food Melt Extrusion 3D Printer -- corpus "240"; text: "$13.000,00 and $300"
- **032** Open-source hybrid 3D-bioprinter for simultaneous printing of thermoplastics … -- corpus "1150"; text: "€ 769.00€ PrusaResearch PRI-MK3S-KIT-ORG-PEI Non-specific"
- **044** The ‘bIUreactor’: an open-source 3D tissue research platform -- corpus "8000"; text: "$8,000 including 3D printer, printing resin, and electro"
- **048** LusoBioMaker: A low-cost 3D bioprinter with multi-extrusion and contour print… -- corpus "830.19 (excluding the cost of the printer)"; text: "$900 of materi"
- **049** BIO-SPEC: An open-source bench-top parallel bioreactor system -- corpus "3000-7000"; text: "6000 EUR for four reactors (1600 EUR fixed cost, 1100 EUR"
- **052** A Custom Ultra-Low-Cost 3D Bioprinter Supports Cell Growth and Differentiation -- corpus "230"; text: "$1,370 and is too complicated to be replicated as it was"
- **054** Automated Liquid Handler from a 3D Printer -- corpus "325"; text: "$325. Arising from an iterative design"
- **059** Melt Electrowriting of Nylon‐12 Microfibers with an Open‐Source 3D Printer -- corpus "500"; text: "$500atthetime performedbetween25and250°Cataheatingandc"

## 7. Repository present, files not inventoried

- **008** A Versatile Open-Source Printhead for Low-Cost 3D Microextrusion-Based Biopri… -- `https://3dprint.nih.gov/users/telab`
- **010** An Open-Source 3D Bioprinter Using Direct Light Processing for Tissue Enginee… -- `https://osf.io/nzfer`
- **012** BioCloneBot: A versatile, low-cost, and open-source automated liquid handler -- `https://github.com/KoaCWells/BioCloneBot`
- **017** Design and Validation of an Open-Hardware Print-Head for Bioprinting Application -- `https://github.com/CentroEPiaggio/IPJ-Bio`
- **025** FINDUS: An Open-Source 3D Printable Liquid-Handling Workstation for Laborator… -- `https://github.com/FBarthels/FINDUS`
- **032** Open-source hybrid 3D-bioprinter for simultaneous printing of thermoplastics … -- `https://doi.org/10.17632/ywb5zdjk5x.1`
- **036** OpenWorkstation: A modular open-source technology for automated in vitro work… -- `https://github.com/SebastianEggert/OpenWorkstation`
- **038** PyLabRobot: An open-source, hardware-agnostic interface for liquid-handling r… -- `https://github.com/PyLabRobot/pylabrobot`
- **043** The Enderstruder: An accessible open-source syringe extruder compatible with … -- `https://doi.org/10.17605/OSF.IO/9ARYM`
- **050** Technical upgrade of an open-source liquid handler to support bacterial colon… -- `https://github.com/sysbio-cnb`
- **056** EvoBot: An Open-Source, Modular, Liquid Handling Robot for Scientific Experim… -- `https://bitbucket.org/afaina/evobliss-hardware`

## Leads verified (2026-09-29)

Every URL in sections 1 and 2 was resolved live (GitHub API, Zenodo API, OSF API, Mendeley, HTTP), and the thirteen availability statements were read in full.

**Repositories confirmed, to add to the corpus with their licence (ten records):**

- **001** 3D bioprinting of collagen-based high-resolution internally … — Zenodo 10.5281/zenodo.14975240 (CC-BY-4.0, 1 file, 2025) and 10.5281/zenodo.7135874 (Replistruder 5, CC-BY-4.0; the paper cites 7135873, which redirects); 3d.nih.gov/users/awfeinberg reachable. Paper text says CC-BY-SA, Zenodo records say CC-BY-4.0 -- record the deposit licence.
- **002** A 3D-Printed Plate Handler for Automated Handling of Well Pl… — github.com/Robertbolt97/Claw-with-OT-2 (MIT, pushed 2025-05-13) mirrored at Zenodo 10.5281/zenodo.15394622 (MIT). Thingiverse thing:2563118 is a third-party Petri-dish gripper (CC-BY-4.0) the design builds on, not the paper's files.
- **004** A high performance open-source syringe extruder optimized fo… — Zenodo 10.5281/zenodo.4119127 (Replistruder 4 CAD/STL, CC-BY-4.0, 2020).
- **019** Designing cost-effective open-source multihead 3D bioprinter… — Mendeley Data 10.17632/9rwbkf5p4g.1 (CC BY 4.0, published 2022-08-11): 'all the supporting 3D printer design and data files'.
- **021** Development of a high-performance open-source 3D bioprinter… — Zenodo 10.5281/zenodo.4119127 (Replistruder 4, CC-BY-4.0) and 10.5281/zenodo.7496012 (FlashForge Finder conversion, CC-BY-4.0, 2 files).
- **030** Nydus One Syringe Extruder (NOSE): A Prusa i3 3D printer con… — OSF registration osf.io/8c9qr 'Nydus One Syringe Extruder Bioprinter' (exists; paper states GPLv3 for design, firmware and software, cost ~90 EUR); software also at github.com/NydusOne/gcode-composer (MIT, pushed 2023-04-23). Instructables DIY-BioPrinter is a cited precursor, not the paper's files.
- **031** Open-source cell culture automation system with integrated c… — github.com/czbiohub-sf/2024-accs-pub (no licence file, pushed 2026-01-22).
- **035** OpenLH: Open Liquid-Handling System for Creative Experimenta… — instructables.com/OpenLH reachable (200); page states no licence that the scrape could read.
- **042** STARTER: a stand-alone reconfigurable and translational orga… — github.com/TOP-OoC/Starter-Kit (CC-BY-4.0, pushed 2026-05-06), named in the availability statement.

**Files live only in publisher supplementary information (not held):**

- **009** An open source extrusion bioprinter based on the E3D motion … — Availability statement: STL files, scripts and bill of materials are in the Supplementary Information of 10.1038/s41598-021-00931-1 (open access, nature.com); data on request. No repository.
- **048** LusoBioMaker: A low-cost 3D bioprinter with multi-extrusion … — Availability points to the Supporting Information of 10.1016/j.bprint.2025.e00425; no repository named.
- **052** A Custom Ultra-Low-Cost 3D Bioprinter Supports Cell Growth a… — Availability: 'repositories named in the article/Supplementary Material' of 10.3389/fbioe.2020.580889; the text names none, so the SI must be read.
- **060** Modular microfluidic systems cast from 3D-printed molds for … — CAD and STL files are the compressed SI file 'Barrier_Flow_Alignment CAD and STL files' of 10.1038/s41598-019-47475-z; data on request.

**Honest gaps, nothing further to fetch:** 015 (Data availability: not applicable. No files anywhere), 016 (Raw data on request; SI is one video. No files), 023 (Data contained within the article. No files), 041 (Data on request. No files), 058 (Data on request. No files).


## Supplementary files held (from ~/Downloads, 2026-09-29)

Copied into `pdfs/supplementary/` (gitignored, like the article PDFs); the manifest is `lists/derived/supplementary_manifest.csv`. 13 records now have supplementary material in the repo.

Of the 13 records where the SI was the remaining place to look, **6 are now covered**: 022, 046, 047, 055, 057, 059. **Still needed**: 006 (A robot-assisted acoustofluidic end effector…); 026 (Homebrew photolithography for the rapid and low-co…); 027 (Leveraging flexible pipette-based tool changes to …); 029 (Mask-free laser lithography for rapid and low-cost…); 034 (Open-source, community-driven microfluidics with M…); 044 (The ‘bIUreactor’: an open-source 3D tissue researc…); 054 (Automated Liquid Handler from a 3D Printer…).

What the supplementary files add:

- **005** A Low-Cost, Open-Source 3D Printer for Multimaterial and Hig… — SI names the Zenodo deposit 10.5281/zenodo.14579955 alongside the GitHub repository; cost breakdown $1370 total, $900/$169/$200 parts.
- **022** Development of a microfluidic-assisted open-source 3D biopri… — SI states GPLv3 for the design files and a Mendeley Data deposit, doi:10.17632/s8bpwp2ryb.1 -- a repository lead and a licence lead in one.
- **025** FINDUS: An Open-Source 3D Printable Liquid-Handling Workstat… — SI is build documentation; the repository is already in the corpus.
- **036** OpenWorkstation: A modular open-source technology for automa… — SI holds the full bill of materials (117 priced lines, AUD 26,918 ~ USD 14,413) and step-by-step build instructions -- files can be inventoried from it.
- **042** STARTER: a stand-alone reconfigurable and translational orga… — SI is figures; no repository link or licence.
- **046** Adapting a Low-Cost and Open-Source Commercial Pipetting Rob… — SI is 1.7k chars: figures only, no link or licence.
- **047** mSLAb–An open-source masked stereolithography (mSLA) bioprin… — SI is supporting figures/methods; no repository link or licence in it.
- **049** BIO-SPEC: An open-source bench-top parallel bioreactor syste… — SI restates the cost structure: 6000 EUR for four reactors, 1600 EUR fixed + 1100 EUR per reactor.
- **053** Teach your microscope how to print: low-cost and rapid-itera… — SI is calibration figures; no cost.
- **055** Establishment of low-cost laboratory automation processes us… — SI is one figure (AutoIt script); nothing on cost, licence or repository.
- **057** An open-source programmable smart pipette for portable cell … — SI is methods and figures; no link or licence.
- **059** Melt Electrowriting of Nylon‐12 Microfibers with an Open‐Sou… — SI lists component costs ($165, $100, $500) but no licence or link.

- **030** Nydus One Syringe Extruder (NOSE)… — STL set (probable attribution: the files are dated June 2019, NOSE is the 2019 paper and names the syringe holder): Adapter, Press, Servoholder, Syringeholder.

Note: 006's Nature Communications PDF is the article; its supplementary information is a separate "MOESM" download on the article page and is not held.

## Second batch of supplementary files (2026-09-29, evening)

Received for 006, 026, 027, 029, 034, 044 and 054. Every record originally flagged as needing SI is now covered; the four whose files live only in publisher SI (009, 048, 052, 060) arrived in the third batch below.

- **006** A robot-assisted acoustofluidic end effector… — SI holds the robot-control code (Python for the Dorna arm) and source data; no repository or licence. The article text prices the device at under $20 excluding the arm -- now the curated cost.
- **026** Homebrew photolithography for the rapid and low-cost,“Do It … — SI is the spincoater build guide; CAD only as figures, 3D files 'available upon reasonable request'. Repository and licence are honest gaps.
- **027** Leveraging flexible pipette-based tool changes to transform … — SI is an assembly video. The HardwareX specifications table (missed because the extraction ran its words together) states licence CC BY 4.0, cost $110 USD module + $10,000 OT-2, repository Mendeley 10.17632/xc5488grcv.3 -- all three now in the corpus.
- **029** Mask-free laser lithography for rapid and low-cost microflui… — SI is a chemical-compatibility table; nothing on files, licence or cost. Honest gap.
- **034** Open-source, community-driven microfluidics with Metafluidic… — SI is figures and methods. The repository is metafluidics.org itself, still online -- now the record's link. Article licence CC BY-NC-SA is not a design licence.
- **044** The ‘bIUreactor’: an open-source 3D tissue research platform… — SI holds the design requirements, drawings, parts list, Arduino firmware, user manual and an itemised cost sheet (kit $7,986 incl. the Form 3B+ printer). PreForm files at github.iu.edu/smitlej, which redirects to an Indiana University login: not public, so not a repository for the corpus.
- **054** Automated Liquid Handler from a 3D Printer… — SI holds the CAD (six SolidWorks .SLDPRT files) and a demo video. No repository or licence; cost $325 already in the corpus.

**Specification-table sweep.** Reading 027 showed the HardwareX specifications table had been missed because the PDF text ran its words together ("Sourcefilerepository"). A sweep of all 60 texts for that table found two more records whose printed values were absent from the corpus: **022** (Mendeley deposit, GPLv3) and **027** itself. The other HardwareX records (003, 012, 030, 032, 036, 043, 049) already agreed with their tables.

**New curated file.** `lists/curated/build_costs.csv` supplies a cost when both the workbook and the criteria sheet leave it blank; first entries 006 and 027.

## Third batch of supplementary files (2026-09-29, night)

Received for 009, 048, 052 and 060. **Every supplementary file the audit asked for is now held.**

- **009** An open source extrusion bioprinter based on the E3D motion … — SI is the whole build package: BOM (no prices), 28 STL/STEP files, Duet configuration, macros and firmware, slicer profiles -- now curated as CAD, BOM and firmware assets. No repository, no licence, no cost anywhere.
- **048** LusoBioMaker: A low-cost 3D bioprinter with multi-extrusion … — SI holds the BOM with costs: total 735.56 EUR including the Ender-3 V2 (324.39 EUR), i.e. about 411 EUR of added parts. The curated table said 830.19 excluding the printer, which matches no line of the SI table; the corpus now follows the SI (curated override). No link or licence. BOM curated as an asset.
- **052** A Custom Ultra-Low-Cost 3D Bioprinter Supports Cell Growth a… — SI is figures, a primer table and six videos; the availability statement's 'repositories named in the Supplementary Material' names none. Honest gap for repository and licence.
- **060** Modular microfluidic systems cast from 3D-printed molds for … — SI holds the CAD (STEP and STL for barrier module, flow module, alignment guide) -- now a curated asset -- plus figures and three videos. No repository, licence or cost.

**Files that travel with the article.** Ten asset rows were added to `lists/curated/asset_event_manifest.csv` for design files that exist only as publisher supplementary data (009 CAD/BOM/firmware, 006 software, 044 BOM/firmware/documentation, 048 BOM, 054 CAD, 060 CAD). Their URL is the publisher's supplementary file itself (Springer ESM, Elsevier mmc, or ACS's supporting-information page), and the note says which local file holds them. On the site each file icon opens its file, and cards without a repository carry a "Supplement" link. They count on the Files facet but do not make the record "has a repository": a supplementary zip is not a maintained deposit.

## Columns the curated layer lacks

`unified_papers.csv` is derived from the workbooks, so hand edits to it are overwritten. The audit CSV carries these as working columns; the durable place for them is a curated file (as `verified_text_repo_links.csv` already is):

- `currency` -- ten costs have a figure and no currency; the site infers USD and marks it "?".
- `licence_scope` -- article versus design files; the table's `license` column mixes both, which is why the pipeline cannot use it.
- `licence_source` -- paper text, repository LICENSE, host metadata.
- `files_inventoried` -- whether someone has listed what the repository holds (11 repositories, none inventoried).
- `si_checked` -- whether the supplementary information was read for links.
