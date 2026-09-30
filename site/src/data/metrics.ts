/**
 * The five performance measurements a laboratory needs before it can judge a build, in the
 * order they are always shown. A record's `reportedMetrics` scores each yes / no / na:
 * yes only when the paper states a number, na when the full text is not held.
 *
 * One list, read by the card, the table, the map's selection panel and the sprite, so the
 * third icon means "cell viability" everywhere.
 */
export type MetricStatus = "yes" | "no" | "na";

export interface Metric {
  id: string;
  /** Short name for tooltips and screen readers. */
  label: string;
}

export const METRICS: Metric[] = [
  { id: "motion-accuracy", label: "Motion accuracy" },
  { id: "volumetric-accuracy", label: "Volumetric accuracy" },
  { id: "cell-viability", label: "Cell viability" },
  { id: "unattended-operation", label: "Unattended operation" },
  { id: "standard-compliance", label: "Standard compliance" }
];

export const STATUS_TEXT: Record<MetricStatus, string> = {
  yes: "reported",
  no: "not reported",
  na: "not assessed, full text not held"
};

/** The five statuses in canonical order, `na` for anything the record does not carry. */
export function orderMetrics(
  metrics: { id: string; status: string; value?: string | null }[]
): { id: string; label: string; status: MetricStatus; value: string }[] {
  return METRICS.map((m) => {
    const found = metrics.find((x) => x.id === m.id);
    const status = (found?.status === "yes" || found?.status === "no" ? found.status : "na") as MetricStatus;
    return { ...m, status, value: found?.value ? String(found.value) : "" };
  });
}
