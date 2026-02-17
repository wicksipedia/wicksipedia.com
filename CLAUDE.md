# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow Preferences

For design/aesthetic tasks, implement changes immediately rather than spending the session exploring and planning. If a plan already exists, execute it. If no plan exists, produce a brief plan (max 10 lines) then start implementing.

## UI/CSS Changes

When making UI/CSS changes, always verify the result by checking for:

1. Mobile vs desktop layout consistency
2. No duplicate elements appearing at different breakpoints
3. CSS animations actually functioning (test with a quick browser check or review keyframe/animation properties)

List these checks after every UI change.

When making visual/design changes, go bold on the first pass. The user prefers distinctive, punchy aesthetics over minimal or subtle changes. If unsure, err on the side of more visual impact rather than less.

## Commands

```bash
bun run dev          # Dev server at localhost:4321
bun run build        # Type check (astro check) + build + pagefind index
bun run preview      # Build + preview with wrangler dev
bun run deploy       # Deploy to Cloudflare Workers via wrangler
bun run format:check # Prettier check
bun run format       # Prettier write
bun run lint         # ESLint (note: console.log is an error)
vale src/data/blog/  # Prose linting (banned words/phrases)
```

Search requires a build before it works locally (pagefind indexes `dist/`).

## Blog Post Writing

When writing or editing blog posts, always run Vale before considering the post done:

```bash
vale src/data/blog/path-to-post/index.mdx
```

Vale is configured (`.vale.ini` + `styles/Wicksipedia/`) to catch banned words and phrases that sound too "AI-generated" or corporate. All Vale errors must be resolved before a post is considered finished.

## Architecture

Astro 5 static site blog deployed to Cloudflare Workers. Uses TypeScript (strict), React (for interactive components only), and TailwindCSS 4.

**Path alias:** `@/` maps to `./src/`

### Content System

Blog posts live in `src/data/blog/` as MDX files in subdirectories (`post-slug/index.mdx`). Each post directory can contain its own images.

- Content collection defined in `src/content.config.ts` using glob loader (pattern: `**/[^_]*.mdx`)
- Directories prefixed with `_` are excluded from URL generation but not from builds (useful for drafts)
- Frontmatter requires: `title`, `description`, `pubDatetime`
- Posts filtered by `draft` flag and `pubDatetime` (future posts hidden with 15min margin) via `src/utils/postFilter.ts`
- OG images auto-generated per post using Satori SVG→PNG (`src/utils/generateOgImages.ts`)
- Slug/URL derived from file path via `src/utils/getPath.ts` (strips numeric prefixes and `_` prefixes from directory names)

### Key Config Files

- `src/config.ts` — Site metadata, pagination settings, edit post URLs, timezone
- `src/constants.ts` — Social links, share links, Giscus (GitHub Discussions comments) config
- `astro.config.ts` — Integrations, Shiki syntax highlighting (min-light/night-owl themes), code transformers (diff, highlight, word highlight, file names)

### Routing

File-based routing in `src/pages/`:
- `[...slug]/index.astro` — Individual blog posts
- `blog/[...page].astro` — Paginated blog listing
- `tags/[tag]/[...page].astro` — Tag-filtered listing
- `blog/[...slug]/index.png.ts` — Dynamic OG image per post
- `rss.xml.ts`, `robots.txt.ts` — Generated feeds

### Styling

TailwindCSS 4 with CSS custom properties for light/dark themes defined in `src/styles/global.css`. Theme toggle persists via localStorage with inline script to prevent FOUC (`src/scripts/theme.ts`).

### Components

- `.astro` files for most components (Header, Footer, Card, Pagination, Tag, Datetime, ShareLinks)
- `.tsx` for React components requiring interactivity (Comments via Giscus)

### Images

- Place in `src/assets/images/` or post subdirectory for Sharp optimization
- Place in `public/` for unoptimized static serving

## Design System

This site has a custom, opinionated design language. Follow these rules to keep things consistent.

### Color Palette

Defined in `src/styles/global.css` as CSS custom properties with light and dark variants:

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--background` | `#faf9f6` (warm off-white) | `#0f1117` (deep navy) | Page background |
| `--foreground` | `#1a1a1a` | `#e8e6e3` | Body text |
| `--accent` | `#d4550a` (burnt orange) | `#ff7a1a` (bright orange) | **Primary accent — links, buttons, tags, hover states, active indicators** |
| `--muted` | `#e8e5df` | `#1e2130` | Card backgrounds, subtle fills |
| `--border` | `#d6d3cc` | `#2a2d3a` | Borders, dividers |
| `--hero-*` | Various | Various | Hero section colors (theme-responsive) |

**Rules:**
- **Orange is the accent.** Use `var(--accent)` / Tailwind `text-accent`, `bg-accent`, `border-accent` etc. for all interactive elements, highlights, hover states, and decorative flourishes.
- `--accent-2` (green) exists in the variables but is **not used in the UI**. Do not introduce green accents.
- For muted/secondary text, use `text-foreground/60` or `text-foreground/50` (opacity modifiers), never grey hex values.
- For borders, prefer `border-border/50` or `border-border/60` for subtle lines.

### Typography

- **Font:** Google Sans Code (monospace), loaded via Astro `Font` component, set as `--font-app`.
- **Headings:** `font-extrabold` or `font-bold`, tight tracking (`tracking-tight`).
- **Body:** Default weight, `text-foreground` with opacity modifiers for hierarchy.
- **Small labels:** `text-xs font-semibold uppercase tracking-widest` (used in nav, metadata, section labels).

### Component Patterns

#### Header (`src/components/Header.astro`)
- Sticky, glass-morphism nav bar (`backdrop-blur-lg`, semi-transparent background via `color-mix`)
- Site title "Wicksipedia" with a **bouncing orange dot** after it (CSS-only animation, squishes on hover)
- Nav links: uppercase, `0.65` opacity at rest, full opacity + orange + tinted bg on hover
- Active page: orange text + 2px underline bar
- Utility icons (search, theme): contained in rounded squares with accent hover tint
- Divider between nav and utility icons

#### Footer (`src/components/Footer.astro`)
- Muted background band (`color-mix` of `--muted` and `--background`)
- Site title echo with accent dot (same motif as header)
- Copyright + commit hash (monospace, accent-colored) on left, social icons on right

#### Cards (`src/components/Card.astro`)
- Full card is clickable (stretched link via `after:absolute after:inset-0`)
- `rounded-xl`, `border-border/60`, `bg-muted/20` at rest
- Hover: lifts up 3px (`translateY(-3px)`), accent-tinted box-shadow, 3px orange left border fades in
- Tags at bottom: orange pill badges (`border-accent/30 bg-accent/5 text-accent`), independently clickable (`relative z-10`)
- Title highlights orange on hover (`group-hover:text-accent`)

#### Post Detail (`src/layouts/PostDetails.astro`)
- Full-bleed OG image hero banner (100vw, max-height 420px) with bottom gradient fade into background
- Post title below in `font-extrabold`, up to `text-4xl` on large screens
- Description shown as muted subtitle
- Tags displayed inline below metadata
- Progress bar at top of page (`z-50`, above sticky header)
- Prev/next navigation: rounded card-style links with subtle hover lift

### Animation Utilities

Defined as `@utility` in `global.css`:
- `animate-reveal` — fade-in-up on page load (0.5s, no delay)
- `animate-reveal-delay-1` through `animate-reveal-delay-3` — staggered variants (0.1s–0.3s delay)

Use these on homepage sections for orchestrated page-load reveals. Apply to the outermost section wrapper, not individual items.

### CSS Class Conventions

Custom classes are defined in `global.css` (not as Tailwind plugins):
- `.header-wrap`, `.header-nav-link`, `.header-nav-active`, `.header-icon-btn` — header system
- `.footer-band`, `.footer-dot`, `.footer-icon-btn` — footer system
- `.card-hover-lift`, `.card-border-left` — card interaction effects
- `.post-hero-banner`, `.post-header` — post detail page
- `.post-nav-link` — prev/next post navigation
- `.hero-section`, `.hero-avatar`, `.hero-avatar-wrap` — homepage hero
- `.btn-glow` — accent button with hover glow shadow
- `.section-heading` — heading with 3rem orange underline bar
- `.text-gradient` — solid accent color text

### Aesthetic Direction

The overall vibe is **editorial-meets-developer**: clean layouts with bold orange accents, generous whitespace, monospace typography for a technical feel, and thoughtful micro-interactions (bouncing dot, card lifts, staggered reveals). It should feel confident and polished, not flashy. Depth comes from subtle shadows, glass effects, and layered transparencies rather than gradients or complex backgrounds.

When adding new components or pages:
1. Use existing CSS custom properties — never introduce new hardcoded colors
2. Follow the orange accent convention — interactive = orange
3. Match existing border/background patterns: `rounded-xl`, `border-border/50`, `bg-muted/20`
4. Use `color-mix(in srgb, ...)` for nuanced transparency over Tailwind opacity modifiers where you need to mix with a specific color
5. Test in both light and dark themes
