/**
 * The people behind the Atlas.
 *
 * Names and the funding statement are transcribed from the manuscript "Open hardware for
 * biofabrication needs better curation". Five headshots come from the Acceleration
 * Consortium's own team page at acceleration.utoronto.ca/team; the rest were supplied by
 * the team.
 *
 * Nothing here is inferred. Job titles are deliberately absent: the page says who did the
 * work, not where each person sits. The only role recorded is the contribution the
 * manuscript's acknowledgements name. The initials fallback stays in the page for anyone
 * added later without a photo, though all ten currently have one.
 */

/**
 * Where this work lives. Each URL was followed and confirmed rather than guessed: the
 * Radisic Lab address is the one U of T's own Biomedical Engineering faculty page links to,
 * and SDL6 is the Consortium's own page for the self-driving lab this Atlas comes out of.
 */
export const homes = [
  {
    name: "Human Organ Mimicry Self-Driving Lab",
    detail: "SDL6, Acceleration Consortium",
    url: "https://acceleration.utoronto.ca/sdls/sdl6-human-organ-mimicry"
  },
  {
    name: "Acceleration Consortium",
    detail: "University of Toronto",
    url: "https://acceleration.utoronto.ca/"
  },
  {
    name: "The Radisic Lab",
    detail: "Tissue engineering and organ-on-a-chip",
    url: "https://radisiclab.com/"
  },
  {
    name: "University of Toronto",
    detail: "",
    url: "https://www.utoronto.ca/"
  }
];

export interface Member {
  name: string;
  /**
   * What the manuscript states about authorship. Not shown on the page -- the key
   * explaining the # and † marks was removed, and an unexplained symbol beside a name is
   * noise. Kept because it is a fact about the paper, and re-deriving it means going back
   * to the manuscript.
   */
  equalContribution?: boolean;
  corresponding?: boolean;
  /** Headshot; the card falls back to initials when there is none. */
  photo?: string;
}

export const authors: Member[] = [
  {
    name: "Ilya Yakavets",
    corresponding: true,
    photo: "/team/ilya-yakavets.jpg"
  },
  {
    name: "Yimu Zhao",
    corresponding: true,
    photo: "/team/yimu-zhao.jpg"
  },
  { name: "Daniel Hocevar", equalContribution: true, photo: "/team/daniel-hocevar.jpg" },
  { name: "Caner Dikyol", equalContribution: true, photo: "/team/caner-dikyol.jpg" },
  {
    name: "Milica Radisic",
    corresponding: true,
    photo: "/team/milica-radisic.jpg"
  }
];

export interface Contributor {
  name: string;
  contribution: string;
  photo?: string;
}

export const contributors: Contributor[] = [
  { name: "Karen Shen", contribution: "Literature survey", photo: "/team/karen-shen.jpg" },
  { name: "Edison Lin", contribution: "Literature survey", photo: "/team/edison-lin.jpg" },
  { name: "Kevin Perera", contribution: "Literature survey", photo: "/team/kevin-perera.jpg" },
  {
    name: "Rosanna Jiang",
    contribution: "Literature survey",
    photo: "/team/rosanna-jiang.jpg"
  },
  {
    name: "Maunica Toleti",
    contribution: "Deployment of the Atlas website",
    photo: "/team/maunica-toleti.jpg"
  }
];

export const funding = [
  "This research was undertaken thanks in part to funding provided to the University of Toronto's Acceleration Consortium from the Canada First Research Excellence Fund (CFREF-2022-00042).",
  "Milica Radisic is supported by a Tier I Canada Research Chair."
];
