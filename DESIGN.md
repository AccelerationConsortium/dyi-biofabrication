# Design System — DIY Biofabrication Atlas

## Register

Product UI serving a scholarly research map ([PRODUCT.md](PRODUCT.md)). North star: help authors write a DIY biofabrication perspective; help the public find **tools**, **assets**, and **skills** first — papers as evidence.

## Color strategy

Restrained: cool off-white surfaces, teal/rust/blue accents used semantically. Flat borders over heavy shadows.

| Token | Use |
|-------|-----|
| `--bg` | Page background |
| `--surface` | Cards, panels |
| `--ink` / `--muted` | Body text (≥4.5:1 contrast) |
| `--accent` | Primary actions, selection, paper nodes |
| `--accent-2` | Rust — tools, repo signals |
| `--accent-3` | Blue — topics, links |

## Typography

- **All text:** D-DIN (self-hosted, OFL) — strict single-family UI
- **Headings:** weight 700, letter-spacing 0.01em
- **Body:** weight 400, line-height 1.5
- Scale: 0.875 / 1 / 1.125 / 1.25 / 1.5 / 2 / 2.5 rem

## Radius

| Token | Value |
|-------|-------|
| `--radius-sm` / `--radius-md` | 2px |
| `--radius-lg` | 4px (panels only) |

Chips, buttons, and nav use rectangular corners — no pill radii.

## Breakpoints

| Token | Width | Use |
|-------|-------|-----|
| `--bp-phone-sm` | 375px | iPhone SE |
| `--bp-phone` | 390px | iPhone 14/15 |
| `--bp-tablet` | 640px | 2-column filters |
| `--bp-desktop` | 900px | Full nav, open filter sections |

## Touch & mobile

- Minimum control height: **44px** (`--control-height: 2.75rem`)
- Input font-size: **16px** (`--control-font-size: 1rem`) to prevent iOS focus zoom
- Safe-area insets on header, main, footer via `env(safe-area-inset-*)`

## Page scan zones

1. **Orient** — title + stat
2. **Act** — primary CTA or search
3. **Signals** — evidence, filters, at-a-glance strip
4. **Content** — cards / graph
5. **Deep** — metadata in `CollapsibleBlock` (collapsed on mobile)

## Components

| Component | Role |
|-----------|------|
| `Select.astro` | Themed dropdown (replaces native `<select>`) |
| `ScanHeader.astro` | Compact page header |
| `AtAGlance.astro` | 4-cell key-fact strip |
| `StickyFilterDock.astro` | Sticky explorer filters |
| `CollapsibleBlock.astro` | Progressive disclosure |
| `ExplorerSubnav.astro` | Tools · Skills · Assets · Papers … tabs |
| `DiscoveryEntry.astro` | Balanced homepage entry chips |
| `.panel` | Bordered card surface |
| `.paper-card` / `.entity-card` | Equal-height cards with expandable details |

## Navigation

Desktop: **Home · Explore ▾ · Collections · Graph · About**

Explore menu: Tools, Skills, Assets, Papers, Topics, Repos, Events.

Mobile hamburger: grouped EXPLORE / VIEWS / ABOUT sections.

## Discovery paths

| Path | Route |
|------|-------|
| Tools | `/tools` |
| Skills | `/skills` |
| Assets | `/assets` |
| Viewpoint lenses | `/collections` |

## Motion

180ms ease-out default. No card lift on hover. Disabled under `prefers-reduced-motion`.

## Accessibility

WCAG 2.2 AA target. Custom Select supports keyboard (↑↓ Enter Esc) and syncs hidden native `<select>`. Graph views paired with list alternative.

## Config

Set `PERSPECTIVE_PREPRINT_URL` at build time to show preprint link on About and footer.
