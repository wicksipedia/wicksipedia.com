# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev          # Dev server at localhost:4321
bun run build        # Type check (astro check) + build + pagefind index
bun run preview      # Build + preview with wrangler dev
bun run deploy       # Deploy to Cloudflare Workers via wrangler
bun run format:check # Prettier check
bun run format       # Prettier write
bun run lint         # ESLint (note: console.log is an error)
```

Search requires a build before it works locally (pagefind indexes `dist/`).

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
