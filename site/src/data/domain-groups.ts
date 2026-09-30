export const DOMAIN_GROUPS = [
  {
    name: "Bioprinting",
    topics: ["Bioprinting", "Bioreactors & Cell Culture"]
  },
  {
    name: "Microfluidics & Microfabrication",
    topics: ["Microfluidics", "Microfabrication", "Electrospinning", "Organ-on-chip"]
  },
  {
    name: "Liquid Handling",
    topics: ["Liquid Handling"]
  }
];

export function getDomainGroups(categories: string[]) {
  return DOMAIN_GROUPS
    .filter((group) => categories.some((category) => group.topics.includes(category)))
    .map((group) => group.name);
}
