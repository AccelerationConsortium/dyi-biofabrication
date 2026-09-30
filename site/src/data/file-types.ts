/**
 * The kinds of build file a record can carry, in the order they are shown.
 *
 * One list, read by the cards, the facet, the map's selection panel and the icon sprite,
 * so an icon cannot mean one thing on a card and another in the sidebar. Order runs from
 * the file you need first to rebuild (the CAD) to the ones that qualify it.
 */
export interface FileType {
  id: string;
  /** Short name, for the facet and for screen readers. */
  label: string;
  /** What the icon stands for, spelled out on hover. */
  title: string;
}

export const FILE_TYPES: FileType[] = [
  { id: "cad", label: "CAD", title: "CAD files: printable or machinable geometry" },
  { id: "bom", label: "Bill of materials", title: "Bill of materials: the parts to buy" },
  { id: "schematics", label: "Schematics", title: "Schematics: circuit diagrams" },
  { id: "pcb", label: "PCB", title: "PCB layout files" },
  { id: "firmware", label: "Firmware", title: "Firmware: code that runs on the device" },
  { id: "software", label: "Software", title: "Software: code that runs on a computer" },
  { id: "protocol", label: "Protocol", title: "Protocol: a step-by-step method" },
  { id: "documentation", label: "Documentation", title: "Documentation: build or user guide" }
];

const byId = new Map(FILE_TYPES.map((t) => [t.id, t]));

/** A record's types in canonical order, unknown ids kept at the end rather than dropped. */
export function orderFileTypes(ids: string[]): FileType[] {
  const known = FILE_TYPES.filter((t) => ids.includes(t.id));
  const unknown = ids.filter((id) => !byId.has(id)).map((id) => ({ id, label: id, title: id }));
  return [...known, ...unknown];
}
