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
bun run dev          # Dev server at http://localhost:4321 (TinaCMS admin: /admin/index.html)
bun run build:local  # The build that works TODAY — no Tina Cloud credentials needed
bun run build        # --content=local: local content, TinaCloud-pointing client. NEEDS creds.
bun run build:cloud  # Content fetched from Tina Cloud. NEEDS creds.
bun run preview      # build:local + preview with wrangler dev
bun run deploy       # Deploy to Cloudflare Workers via wrangler
bun run format:check # Biome format check
bun run format       # Biome format write
bun run lint         # Biome check: lint + assist (organize imports) + format (note: console.log is an error)
bun run check        # The six content-parse suites (also runs inside build)
bun run check:dev-smoke  # Starts a dev server, loads real pages, shuts it down
vale src/data/blog/  # Prose linting (banned words/phrases)
```

`check:dev-smoke` is deliberately NOT part of `bun run check`: `check` runs inside
`bun run build`, and starting a dev server from within a build would be circular.
It is the only gate that exercises `command === "dev"` — see the note below on why
that matters.

Search requires a build before it works locally (pagefind indexes `dist/`).

### The `dev` script looks odd on purpose

```
tinacms dev --datalayer-port 9007 -c "trap 'astro dev stop' EXIT INT TERM; astro dev && astro dev logs --follow"
```

Astro 7 **daemonises** `astro dev` — it starts the server in the background and
exits 0 immediately. Plain `tinacms dev -c "astro dev"` therefore sees its child
exit, tears down the GraphQL server on 4001, and leaves a detached Astro daemon
serving `TypeError: fetch failed` on every page. Each piece here earns its place:

- `astro dev logs --follow` blocks, which keeps `tinacms dev` alive holding the
  GraphQL server, and streams Astro's output so the terminal behaves normally.
- The `trap` stops the daemon on Ctrl-C. Without it the daemon **survives** the
  interrupt, keeps port 4321, and serves 500s once Tina is gone — and the next
  `bun run dev` silently attaches to that poisoned server. `EXIT` alone is
  enough on this machine's `/bin/sh` (bash 3.2 does run an `EXIT` trap when an
  untrapped `INT` kills it — measured); `INT TERM` are listed as portability
  belt-and-braces, not because `EXIT` is insufficient here.
- `--datalayer-port 9007` matches the build scripts. Tina's datalayer defaults
  to 9000, which another tool on this machine holds; that has broken a build.

Notes: the dev server is **plain http** — `http://localhost:4321`, no `curl -k`.

It used to be https via `@vitejs/plugin-basic-ssl`, which was removed because it
made the CMS unusable: TinaCMS's dev server is http on :4001, and the admin SPA
loads `@vite/client`, `src/main.tsx` and `@react-refresh` from it. An https admin
page pulling those is active mixed content, so the browser blocked every script
and the admin never booted — while `/admin/index.html` went on returning a
healthy 200, which is why no gate noticed.

Nothing here needs TLS in dev. `navigator.clipboard.writeText` (the copy-code
button) is the only secure-context API in `src/`, and `http://localhost` is a
"potentially trustworthy origin" per W3C Secure Contexts — measured in Chrome on
`http://localhost:4321`: `isSecureContext === true`, `navigator.clipboard` is an
object and `writeText` a function. Do not re-add `basicSsl()`.

The admin SPA is served out of `public/admin`, and in dev the three URLs
behave differently — measured, not assumed:

| URL | dev |
|---|---|
| `/admin` | 302 → `/admin/index.html` (`tinaAdminDevRedirect()`, `astro.config.ts`) |
| `/admin/` | **404** |
| `/admin/index.html` | 200 — the URL TinaCMS's own startup banner prints |

The trailing-slash 404 is `trailingSlash: "never"` (`astro.config.ts`): Astro
answers `/admin/` itself before Tina's redirect middleware runs, even though
that middleware explicitly tries to catch `/admin/`. Use `/admin` or the full
`/admin/index.html`.

Images in dev are served at their **source size**, unoptimised — the Cloudflare
adapter swaps in a passthrough image service, and only the build puts Sharp back.
`imagePipelineFixups()` in `astro.config.ts` also has to replace the `/_image`
endpoint in dev, because `imageService: "compile"` points it at a module whose
first line imports `cloudflare:workers`; under `astro dev` that is a Node process,
so any page with an `<Image>` died outright. The build is unaffected.

That endpoint re-fetches each image from the dev server over HTTP, which is sound
only while dev is plain http — under the old https server it silently 404'd every
image. One more reason not to re-add `basicSsl()`.

`bun run check:dev-smoke` is the gate that keeps all of this honest; it is the
only one that runs the site instead of building it. It is not a browser, though:
it would not have caught the mixed-content block on `/admin`, so it now also
asserts the admin's script URLs are same-scheme as the page.

If a dev server is ever stranded — a hard kill, a crashed terminal — clear it
with `bunx astro dev stop`; `bunx astro dev status` reports what is running.

The one caveat the trap introduces: `astro dev stop` is scoped to this project
(it reads `.astro/dev.json` under the project root, so it cannot touch another
repo's or another worktree's server), but two `bun run dev` sessions on *this*
repo share the one daemon — so quitting the second one stops the server the
first is still using. Run one at a time.

## Blog Post Writing

When writing or editing blog posts, always run Vale before considering the post done:

```bash
vale src/data/blog/path-to-post/index.md
```

Vale is configured (`.vale.ini` + `styles/Wicksipedia/`) to catch banned words and phrases that sound too "AI-generated" or corporate. All Vale errors must be resolved before a post is considered finished.

Vale reads **Markdown bodies only**. Prose stored in YAML frontmatter — which is where the CMS page collection keeps every `prose` block body — is invisible to it. `scripts/check-page-prose.mjs` extracts those bodies and lints them separately; it runs as part of `bun run check`. Vale has silently linted zero files twice on this repo, so if you change where prose lives, check the trailing "in N files" count, not the exit code.

## Architecture

Astro 7 static site blog, content managed by **TinaCMS**, deployed to Cloudflare Workers. TypeScript (strict) and TailwindCSS 4. No React in the site bundle — React is a devDependency only, used to build the Tina admin SPA.

**Path alias:** `@/` maps to `./src/`

### Content System

All content is TinaCMS collections, defined in `tina/collections/` and assembled in `tina/config.ts`. Nothing uses Astro content collections; `src/content.config.ts` no longer exists.

| Collection | On disk | What it is |
|---|---|---|
| `blog` | `src/data/blog/<slug>/index.md` | 17 posts, images colocated in the same folder |
| `settings` | `content/settings/index.json` | Singleton: header nav, footer socials |
| `page` | `content/pages/*.mdx` | CMS pages assembled from blocks (`home`, `about`) |

- Post bodies are **Markdown (`.md`)**, parsed by Tina and rendered by `src/components/RichText.astro` — not by Astro's Markdown pipeline, which this site no longer uses at all.
- Tina's parser rejects some valid CommonMark. See `docs/` and the comments in `src/lib/tina/blockquote.ts`; the short version is no code fences inside list items, and no nested lists.
- Frontmatter requires `title`, `description`, `pubDatetime`.
- `draft` and future `pubDatetime` (15 min margin) are filtered by `src/utils/postFilter.ts`. It intentionally lets both through when `import.meta.env.DEV`, so drafts are previewable — which is why the build scripts set `NODE_ENV=production` explicitly.
- Directories prefixed with `_` are **not** excluded — the glob guards the filename, and every post is named `index`. Tina matches exactly what the old Astro glob matched.
- Slug/URL comes from `src/utils/getPath.ts`.

Data reaches pages through adapters in `src/lib/tina/`, never through direct client calls: `posts.ts`, `pages.ts`, `settings.ts`. Each **throws on an empty result** rather than returning `[]`, because Tina reports success on an empty collection and a silent zero would build the whole site with no content and exit 0.

### Visual editing

Static pages, plus one on-demand route. `src/lib/islands.ts` is the registry of editable regions; `src/pages/tina-island/[name].ts` re-renders one region on demand for the admin preview. It is an **unauthenticated public POST endpoint** — every island must declare a gate in `islandGates`, and slugs off the URL must pass the allowlists in `src/lib/tina/island-guard.ts`. Read that file's header before adding a region.

### Key Config Files

- `src/config.ts` — Site metadata, pagination, edit-post URLs, timezone
- `content/settings/index.json` — Nav and socials (**CMS-managed**; `src/constants.ts` holds share links and Giscus config only)
- `tina/config.ts` — Collections, media root (`src/assets/uploads`)
- `astro.config.ts` — Integrations, the Cloudflare adapter, and `sharpAtBuildTime()`. Syntax highlighting lives in `src/shiki.ts`, imported by `RichText.astro` — **not** configured here.

### Routing

File-based routing in `src/pages/`:
- `index.astro` — Homepage, renders the `home` page document
- `[...slug].astro` — **Catch-all for CMS pages**, routes built from the page collection, so creating a page in the admin publishes it with no code change. Do not add per-page `.astro` routes.
- `[...slug]/index.astro` — Individual blog posts
- `blog/[...page].astro`, `tags/[tag]/[...page].astro` — Paginated listings
- `blog/[...slug]/index.png.ts` — Per-post OG image (only fires for posts with no `ogImage`; currently none)
- `tina-island/[name].ts` — The one on-demand route (`prerender = false`)
- `rss.xml.ts`, `robots.txt.ts` — Generated feeds

### Styling

TailwindCSS 4 with CSS custom properties for light/dark themes in `src/styles/global.css`. Theme toggle persists via localStorage with an inline script to prevent FOUC (`src/scripts/theme.ts`).

### Components

All components are `.astro` — there are no `.tsx` files. Comments are `Comments.astro` (Giscus via a script tag).

### Images

- **Post images:** colocate in the post's own folder. `src/lib/tina/images.ts` globs them eagerly so `<Image>` can optimise them. That glob means **any image in a post folder ships whether referenced or not** — `bun run check` fails on orphans.
- **CMS uploads:** `src/assets/uploads/` (Tina's media root), resolved by `resolveUploadImage`.
- **`public/`** is copied verbatim and never optimised. Do not put content images there.
- `imageService: "compile"` alone does **not** give you Sharp — see the long comment on `sharpAtBuildTime()` in `astro.config.ts`. Without it every derivative is an unresized copy of its source, and the build still exits 0.

## Design System

This site has a custom, opinionated design language. Follow these rules to keep things consistent.

### Color Palette

Defined in `src/styles/global.css` as CSS custom properties with light and dark variants:

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--background` | `#faf9f6` (warm off-white) | `#0f1117` (deep navy) | Page background |
| `--foreground` | `#1a1a1a` | `#e8e6e3` | Body text |
| `--accent` | `#ae4508` (burnt orange) | `#ff7a1a` (bright orange) | **Primary accent — links, buttons, tags, hover states, active indicators** |
| `--muted` | `#e8e5df` | `#1e2130` | Card backgrounds, subtle fills |
| `--border` | `#d6d3cc` | `#2a2d3a` | Borders, dividers |
| `--hero-*` | Various | Various | Hero section colors (theme-responsive) |

Values verified against `src/styles/global.css`; the other rows already matched.
The light `--accent` was documented as `#d4550a` long after it had been darkened
to `#ae4508` for contrast — `#ae4508` on `#faf9f6` is 5.46:1 and passes AA,
`#d4550a` was 3.91:1 and did not. A reviewer trusting this table over the
stylesheet reported a contrast failure that does not exist, so keep it accurate.

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

Styling is composed inline via Tailwind utility classes on each component, not via centralised `.class` rules. Only a small set of reusable layers exists:

- `@utility max-w-app`, `@utility app-layout` (`src/styles/global.css`) — page-width containers.
- `@utility animate-reveal` and `animate-reveal-delay-1..3` (`src/styles/global.css`) — page-load fade-in-up reveals.
- `@utility animate-cmd-in` (`src/styles/global.css`) — cmd-K palette open animation.
- `.app-prose` (`src/styles/typography.css`) — long-form article body overrides on top of `@tailwindcss/typography`.
- `.heading-link` (`src/styles/global.css`) — runtime-injected `#` anchors on headings.
- `body::before` (`src/styles/global.css`) — accent gradient line at the top of the viewport.
- `@media (prefers-reduced-motion: reduce)` block (`src/styles/global.css`) — snaps every animation/transition to 0.01ms; honours OS preference.

Component-specific look (header, footer, card, post hero, etc.) lives inline in each `.astro` file as Tailwind class strings, not as named classes here. If you find yourself wanting a `.btn-glow` or `.section-heading` shortcut, write it as a Tailwind composition first and only promote to `@utility` if it repeats three or more times.

### Aesthetic Direction

The overall vibe is **editorial-meets-developer**: clean layouts with bold orange accents, generous whitespace, monospace typography for a technical feel, and thoughtful micro-interactions (bouncing dot, card lifts, staggered reveals). It should feel confident and polished, not flashy. Depth comes from subtle shadows, glass effects, and layered transparencies rather than gradients or complex backgrounds.

When adding new components or pages:
1. Use existing CSS custom properties — never introduce new hardcoded colors
2. Follow the orange accent convention — interactive = orange
3. Match existing border/background patterns: `rounded-xl`, `border-border/50`, `bg-muted/20`
4. Use `color-mix(in srgb, ...)` for nuanced transparency over Tailwind opacity modifiers where you need to mix with a specific color
5. Test in both light and dark themes
