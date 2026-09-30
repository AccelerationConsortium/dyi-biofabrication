# Open hardware for biofabrication needs better curation

*Marked-up copy. Every **bold** passage is a change from `DYI_comment_copy.docx`.
Figures verified against the corpus on 22 September 2026 (60 records, all keep = yes),
after repairing two publication-metadata lookups that had gone stale.*

---

## Standfirst

Open-source liquid handlers and bioprinters can approach commercial performance at
substantially lower cost, but many designs remain poorly documented, inconsistently validated
and difficult to maintain. We argue for standardized reporting of cost, components and
performance, supported by curated resources such as the DIY Biofabrication Atlas.

*(unchanged)*

---

## Opening

Biofabrication requires precise positioning and dispensing of cells and biomaterials in defined
spatial patterns at micrometer-scale resolution. This relies on automated high-precision liquid
handling in a controlled environment. Commercial liquid handlers can cost hundreds of thousands
of dollars,¹ and bioprinting platforms up to US$1 million.² These costs can limit access for
teaching laboratories, resource-constrained institutions and cross-disciplinary researchers
without engineering support. The consequence is a two-tiered system: well-resourced laboratories
can perform parallel experiments and standardize workflows across operators, whereas others rely
more heavily on manual workflows.

The community has responded by developing open-sourced hardware. For these tools to provide
practical alternatives to commercial platforms, they must combine affordability with sufficient
precision, reliability and reproducibility. Their performance should also be evaluated against
**community-agreed standards**, and their software should support unattended protocol execution.
Some published open designs meet these requirements (**Table 1**), and can be **judged and used
as reliably as commercial platforms**.

---

## What open hardware already delivers

Open designs already demonstrate several capabilities required for biofabrication, including
precise motion, volumetric accuracy, preservation of cell viability and unattended operation
(Table 1). In many cases, these systems cost hundreds to a few thousand dollars.

*Precise motion* can be achieved by adapting consumer 3D-printing hardware. A desktop printer
converted for under US$900 achieved travel accuracy better than 35 µm in X, Y and Z and produced
collagen lattices with an average dimensional error below 2%.² *Volumetric accuracy* can also
meet established performance criteria. A US$300 3D-printed digital pipette showed 0.2% random
error at a nominal volume of 10 mL, within the reported ISO 8655 range.³ Using a standard applied
to commercial pipettes provides **a common basis** for comparison.

Biofabrication systems must also maintain **cell viability**. An open printhead costing under
US$70 converts a desktop printer into an extrusion bioprinter and maintained viability above 90%
at 24 h,⁴ although only this single timepoint was reported. Automation requires both reproducible
positioning and *software* capable of executing protocols without continuous operator
intervention. A pipetting robot **from under US$600** reported positioning repeatability
**of ±50 µm in X and ±30 µm in Y** over 57 trials and can operate inside an incubator alongside a
microscope, enabling unattended live-cell experiments.⁵ Standardized, machine-readable
interfaces, **such as the Model Context Protocol** (MCP), could extend interoperability by
allowing software agents to interact with instruments without hardware-specific control code.

Open systems can also reduce dependence on proprietary consumables by using standard tips, plates
and pipettes,⁶ or syringes of different volumes.⁴ However, they do not reproduce every function
of commercial platforms. The US$710 Sidekick, a printed dispensing robot, delivers 10 µL
increments but cannot aspirate.¹ Commercial systems also typically provide integrated
calibration, **quality control and technical support**. Community training can partially address
the expertise required to build and operate open hardware. Since 2018, a bioprinting workshop at
Carnegie Mellon has sent trainees home with printers they built themselves.² Thus, the remaining
challenge extends beyond hardware performance to the infrastructure required to validate,
maintain and support these systems.

---

## Validation is the missing step

Validation remains inconsistent across open-hardware studies. Few benchmark performance against a
defined standard or against the commercial instrument that the open system is intended to
complement or substitute. One open bioprinter reports its travel accuracy alongside the stated
resolutions of three commercial platforms,² but most studies evaluate performance against their
own design targets. **Of the 59 entries whose full text we hold, only eight report a
measurement against a named written standard.** This makes comparisons between systems difficult.

Cost reporting is similarly inconsistent. A US$141 syringe extruder's stated cost excludes the
printer it mounts on,⁸ and the printed pipette **needs a robot arm** to perform.³ **Among the 60
tools included in the Atlas, 25 did not report a build cost at all, and a further six state a
figure that excludes the host printer or robot — leaving 29 with a complete number.** Reporting
required host equipment, components and build time would provide a more realistic estimate of
adoption cost.

Maintenance is another poorly documented component of reproducibility. **Among the 60 tools, 19
have a repository link that resolves, but only seven are recorded in the structured metadata; the
other twelve had to be recovered from the full text. Nine of the 19 are one-off deposits with no
commit history. Of the ten that are code repositories, four had been updated within the previous
year and three had received no commit for more than three years, the oldest in 2015.** A design
whose files or code are inaccessible cannot readily be reproduced, maintained or extended.

---

## Curating what already exists

A practical response is to systematically curate existing open hardware. **Literature searches
return** relevant papers rather than available toolkits. **They do not say** whether the design
files **remain** available, which license governs reuse, or how difficult a system is to build
and operate. The **DIY Biofabrication Atlas** indexes 60 tools across **nine application areas,
led by bioprinting (26 entries) and liquid handling (26), with smaller groups in microfluidics,
microfabrication, bioreactors and cell culture, electrospinning, custom printers, organ-on-chip
and microscopy**. The tools were published between 2010 and 2026, and **57 of the 60 publications
are open access; the remaining three are closed**.

Each entry summarizes information relevant to adoption: estimated cost, open components,
licensing, repository availability, build and operating complexity, and at least one reported
limitation. **Table 1** shows a subset of these fields. Entries are versioned and citable, and
developers can submit new tools **or report an attempt to rebuild one**. The Atlas is a reference
rather than a ranking. **We verified all 60 DOIs and the repository links, and
found no retractions among the 60 entries.**
These checks make the evidence traceable, but **do not constitute** independent validation of
**instrument performance** in the laboratory where it will ultimately be adopted.

---

## Make open tools reliable

The next priority is to make existing hardware easier to reproduce and evaluate. Many journals
already require detailed reporting for other research outputs, including reagent tables,
structured methods, data-deposition and public code repositories. Similar requirements could
strengthen open hardware. Authors should report the hardware license, software, complete bill of
materials with part numbers, total build cost, archived design files with persistent identifier,
and at least one performance measurement against a named standard or comparator.

Core facilities and teaching laboratories may be well positioned to support independent
validation. They operate shared equipment repeatedly and often have access to **a machine shop**,
technical staff and safety assessment. Repeated use can reveal calibration drift, maintenance
requirements and failure modes that may not emerge during initial development. Interoperability
should also be considered during design. Hardware that accepts standard laboratory consumables
and exposes a documented, machine-readable interface can integrate more readily into existing
workflows. Hardware-agnostic control frameworks and emerging interfaces such as MCP and the Model
Hardware Standard could provide a common software layer, although instrument-specific calibration
and safety controls remain necessary.

Finally, independent replication should be valued as a research output. Reporting an attempt to
reproduce another group's design, including failures and identified limitations, provides
evidence that the original prototype cannot provide alone. Short hardware reports, such as the
Commit format in *Digital Discovery*, provide one possible venue.³ **The Atlas accepts structured
rebuild reports directly, recording what a build actually cost, how long it took and what the
documentation omitted; at the time of writing none of the 60 entries has an independent rebuild
on record, and that figure is published on the index.** Until a design has been independently
rebuilt, its reproducibility across laboratories remains uncertain.

---

## Outlook

**Open-sourced biofabrication hardware can already deliver precise motion**, dispensing,
cell-compatible printing and automated operation at substantially lower cost than many commercial
systems. The next challenge is to make these capabilities reproducible across laboratories.
Standardized performance and cost reporting, persistent repositories, interoperable software and
independent replication would make existing designs easier to evaluate and adopt. An open tool
becomes broadly useful when another laboratory can find it, rebuild it and obtain comparable
performance. Curation should therefore become a central part of open-hardware development,
alongside the creation of new technologies.

---

## Table 1 | Representative open-source biofabrication and laboratory-automation tools

| Tool | Cost | Commercial comparator | Reported performance |
| --- | --- | --- | --- |
| Digital pipette (v2)³ | ~US$300 | Handlers costing tens of thousands | 0.2% random error at 10 mL; within ISO 8655 range |
| PHIL pipetting robot⁵ | <US$600 **(to ~US$800 for a 10-pump build)** | Cheapest commercial platform from US$5,000 | ±50 µm (X), ±30 µm (Y) over 57 trials; 3.5 s per well |
| Sidekick¹ | US$710 | Cheapest commercial platform from US$5,000 | 10 µL increments; dispense only |
| OTTO⁶ | ~US$1,500 | Handlers costing tens of thousands | Accuracy and prep time comparable to manual qPCR |
| Microextrusion printhead⁴ | <US$70 | US$10,000–40,000 desktop bioprinters | >90% viability at 24 h; 2–60 °C control |
| Replistruder 4⁸ | US$141 **plus the host printer** | US$5,000–120,000 extrusion bioprinters | 3.35 nL filaments; 300 µm unobstructed channels |
| Recycled-scrap bioprinter⁷ | ~US$260 (<US$120 with reused scrap) | US$13,000–300,000 FDM-derived systems | **10 µm Z-axis step resolution**; 2–10 mm s⁻¹ |
| mSLAb⁹ | **€380–480** | >€20,000 commercial DLP bioprinter | 35 µm pixel resolution, comparable to that system |
| Desktop-printer conversion² | <US$900 | US$5,000 to >US$1,000,000 | Travel accuracy better than 35 µm in X, Y and Z; <2% dimensional error on collagen lattices |

Costs are reported build costs from the cited studies and generally include parts only; they
exclude host equipment, labware, consumables and labour unless otherwise stated. Costs were not
adjusted for currency differences or inflation. The mSLAb figures are in euros. Commercial
comparator prices are those reported in the cited studies and were not independently verified.
Reported performance metrics differ among studies and were not measured using a common benchmark;
values therefore should not be compared directly across rows.
