/** Site-wide config. Set PERSPECTIVE_PREPRINT_URL at build time to show preprint link. */
export const perspectivePreprintUrl =
  (typeof import.meta.env.PERSPECTIVE_PREPRINT_URL === "string" &&
    import.meta.env.PERSPECTIVE_PREPRINT_URL.trim()) ||
  "";

/** Where the site is published; used for links that must work from outside the site, such as GitHub issue prefills. */
export const siteUrl = "https://biofabtoolkit.accelerationconsortium.ai";

/** GitHub repo backing the atlas corpus, used for "suggest a tool" issue links. */
export const githubRepo = "AccelerationConsortium/dyi-biofabrication";
export const githubRepoUrl = `https://github.com/${githubRepo}`;
