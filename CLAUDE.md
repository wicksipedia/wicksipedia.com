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
| `--accent` | `#ae4508` (burnt orange) | `#ff7a1a` (bright orange) | **The one accent: links, active nav, the brand dot, hover states** |
| `--muted` | `#e8e5df` | `#1e2130` | Image tiles, the avatar ring, kbd and hover fills |
| `--border` | `#d6d3cc` | `#2a2d3a` | Hairlines |
| `--overlay-ink` | `#faf9f6` | same | Text over a cover photo; does not flip with the theme |
| `--scrim` | `#0f1117` | same | Cover gradient and modal backdrop; does not flip with the theme |

Values verified against `src/styles/global.css`. The light `--accent` is
`#ae4508`, not the `#d4550a` an older version of this table claimed: `#ae4508`
on `#faf9f6` is 5.46:1 and passes AA, `#d4550a` was 3.91:1 and did not. A
reviewer trusting this table over the stylesheet once reported a contrast
failure that does not exist, so keep it accurate.

**Rules:**
- **Orange is the only accent.** Use `text-accent`, `bg-accent`, `border-accent` for interactive elements and nothing else. No second colour, no green.
- Secondary text is `text-foreground/70`, `/60` or `/50`. Never a grey hex.
- Hairlines are `border-border/60`. Structure comes from rules and space, not boxes: **no cards, no borders around content, no drop shadows.**
- Two radii only: `rounded-2xl` for media tiles (covers, the portrait, code blocks, images in prose) and `rounded-md` for small controls (kbd, buttons). Nothing is `rounded-xl` or `rounded-full` except the brand dot and the mobile avatar.

### Typography

Two families, both loaded through Astro's `Font` component in `astro.config.ts`; the preloads live in `Layout.astro`.

- **`--font-app` = Google Sans Code** (mono). Display headlines, UI, nav, meta, dates, tags, and headings inside prose.
- **`--font-prose` = Geist** (sans). Reading copy only: article bodies, descriptions, the hero tagline. Google Fonts ships no italic for it; the browser synthesises one for the rare `<em>`.
- **Display headlines** use the `text-display` utility (`font-extrabold tracking-[-0.04em] leading-[1.02]`). Scale is deliberately restrained: page titles `text-3xl sm:text-4xl`, the hero name `text-4xl sm:text-5xl`, post titles capped at `lg:text-[2.75rem]`. A first pass at `text-8xl` read as unbalanced; do not creep back up.
- **Section labels** are `text-sm font-medium text-foreground/50` in sentence case. **No uppercase-tracked eyebrows anywhere.** They read as templated and were the site's biggest tell.
- **Tags** are plain mono text `#tag` links at `text-xs text-foreground/50`, `hover:text-accent`. Not pills.

### Component Patterns

#### Header / sidebar (`src/components/Header.astro`)
- **One element, two layouts.** Below `lg` it is a 64px sticky top bar with a hamburger. From `lg` it is a fixed left rail, `w-68` (17rem), full height, hairline right border, and `body` carries `lg:pl-68` (`global.css`) to clear it. Same DOM either way, so `#theme-btn`, `#cmd-k-trigger` and `#menu-items` stay unique
- Rail order: wordmark + **brand dot**, then the **profile** from `settings.profile` (round `size-20` avatar, name, Geist tagline, role with the org link), nav, and pinned to the bottom (`mt-auto`, hairline above) one row of uniform `size-9` icon buttons: search, theme, RSS, socials. No `⌘K` chip in the rail; the palette shows its own shortcuts. Below `lg` the profile renders at the top of the hamburger dropdown instead. The homepage has no hero block; `PageBlocks.astro` keeps its `<h1>` `sr-only` there because the rail is the identity. The dot is static; it squishes (`dot-squish`) on hover of the link, never on a loop
- Nav links: sentence case, `text-sm font-medium text-foreground/65`, `hover:text-foreground`. Active: `text-accent` with a small accent dot in front (`before:`), rail only
- Search trigger shows a single `⌘K` kbd; theme toggle is a bare icon button with a `bg-muted` hover
- The footer's social row is `lg:hidden` because the rail already shows it

#### Hero block (`src/components/blocks/Hero.astro`)
- Still a CMS block type, no longer on the home document. If placed: asymmetric split, name at `text-display text-4xl sm:text-5xl` (no bigger), portrait in a `w-56 lg:w-64 aspect-4/5 rounded-2xl bg-muted` tile
- Below `md` the tile is replaced by a `size-28` round avatar above the name. Both `<Image>`s share `widths`, `sizes`, `width` and `height` so they resolve to one URL and one download; see the comment in the file before touching either
- No load-in animation. The hero is the LCP candidate and an element that first paints at `opacity: 0` is excluded from LCP for good

#### Post index (`src/components/PostIndex.astro` + `Card.astro`)
- `PostIndex` groups an already-sorted list by year and draws a faded `text-display text-3xl text-foreground/25` year marker before each group. Used by the homepage feed, `/blog` and `/tags/*`
- `Card` is one `<li>`: `grid sm:grid-cols-[5.5rem_1fr]`, date in the gutter (`withYear={false}` inside a year group), title + description + tags beside it, `border-t border-border/60` between rows. Also used bare by `/archives` and related posts
- Whole row is the link (stretched `after:` pseudo); tags sit above it at `relative z-10`
- Hover: title goes `text-accent`. No lift, no shadow

#### Post feed (`src/components/blocks/PostFeed.astro`)
- Lead post: `aspect-2/1 rounded-2xl` cover, then `text-display text-2xl sm:text-3xl` title, Geist description, mono meta row. Cover ladder is capped at 1024w on purpose; the slot is at most 992 CSS px and a wider file only warms a colder cache
- Remaining posts render through `PostIndex`; the home document's `limit` is 8

#### Post detail (`src/layouts/PostDetails.astro` + `islands/PostHero.astro`)
- Back link, then the cover as a contained `rounded-2xl` block inside `app-layout` (`min-h` 26/30/34rem) with the meta row, `text-display` title (capped at `lg:text-[2.75rem]`) and description **overlaid** bottom-left in `text-overlay-ink` over a `from-scrim/95` gradient. Both tokens are theme-independent on purpose. A post with no cover renders the same `PostHero` as a plain header
- Cover `HERO_WIDTHS` / `HERO_SIZES` in `PostDetails.astro` feed both the `<img>` and the `<head>` preload; change them together
- Reading progress bar: 4px accent bar, `scaleX` driven by a CSS scroll timeline (`.progress-bar` in `global.css`). The scroll listener in the inline script runs only where `animation-timeline` is unsupported
- Share/edit sit in one ruled row; prev/next are two ruled cells, not cards

#### Footer (`src/components/Footer.astro`)
- Hairline top border, no background band. Wordmark + dot, then `© year`, the tagline and the commit hash as separate flex items with `gap-x-5` (no `|` separators; they failed contrast). Socials right

### Animation

- **Reveals are below-the-fold only.** `animate-reveal` and `animate-reveal-delay-1..3` (0.4s fade-in-up) may go on the recent-posts list and the footer link, never on the hero, page title or lead post
- The only other motion is the brand dot on hover, `group-hover:scale-[1.02]` on the lead cover, arrow nudges on links, and the scroll-driven progress bar
- `@media (prefers-reduced-motion: reduce)` in `global.css` snaps everything to 0.01ms

### CSS Class Conventions

Styling is composed inline via Tailwind utility classes on each component, not via centralised `.class` rules. The reusable layer is small:

- `@utility max-w-app`, `@utility app-layout` (`global.css`) — page-width containers
- `@utility text-display` (`global.css`) — the headline shape
- `@utility animate-reveal` and `animate-reveal-delay-1..3`, `animate-cmd-in` (`global.css`)
- `.brand-dot`, `.progress-bar` (`global.css`) — the two things that move
- `.app-prose` (`typography.css`) — article body on top of `@tailwindcss/typography`; mono headings, Geist body, left-ruled blockquotes, `rounded-2xl` code blocks and images
- `.heading-link` (`global.css`) — runtime-injected `#` anchors on headings

If you find yourself wanting a `.section-heading` shortcut, write it as a Tailwind composition first and only promote to `@utility` if it repeats three or more times.

### Aesthetic Direction

The vibe is **a senior engineer's notebook**: heavy tight mono headlines, a calm sans for reading, one orange, hairlines instead of boxes, and a lot of air. It should feel confident and typographic, not decorated. Depth comes from type scale and spacing, never from shadows, gradients or glass.

When adding new components or pages:
1. Use existing CSS custom properties. Never introduce a hardcoded colour
2. Interactive = orange. Everything else is `foreground` at some opacity
3. Separate things with `border-t border-border/60` and space, not with cards
4. Headlines get `text-display`; labels get `text-sm font-medium text-foreground/50`; nothing gets `uppercase tracking-*`
5. Keep new above-the-fold content free of `animate-reveal`
6. Test in both themes, at 390px, and at `lg` (1024px) where the rail first appears
