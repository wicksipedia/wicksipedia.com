# Wicksipedia

Personal blog of [Matt Wicks](https://wicksipedia.com/): CI/CD, DevOps, cloud-native architecture, and clean code.

Astro 7 static site, content managed in TinaCMS, deployed to Cloudflare Workers.

## Stack

| | |
|---|---|
| [Astro 7](https://astro.build/) | Static site, one on-demand route for CMS visual editing |
| [TinaCMS](https://tina.io/) | Content: posts, pages and site settings, with an admin at `/admin` |
| [Cloudflare Workers](https://workers.cloudflare.com/) | Hosting, via `@astrojs/cloudflare` and Wrangler |
| [TailwindCSS 4](https://tailwindcss.com/) | Styling. Light and dark themes through CSS custom properties |
| [TypeScript](https://www.typescriptlang.org/) | Strict |
| [Biome](https://biomejs.dev/) | Formatting and linting |
| [Vale](https://vale.sh/) | Prose linting for posts |
| [Pagefind](https://pagefind.app/) | Static search behind the `⌘K` palette |
| [Satori](https://github.com/vercel/satori) | Open Graph images at build time |
| [Bun](https://bun.sh/) | Package manager and script runner |

No React ships in the site bundle. It is a dev dependency, used only to build the Tina admin.

Type is [Google Sans Code](https://fonts.google.com/specimen/Google+Sans+Code) for headlines and UI and [Geist](https://vercel.com/font) for reading copy, both loaded through Astro's font API.

## Getting started

Requires [Bun](https://bun.sh/).

```bash
bun install
bun run dev
```

The site is at http://localhost:4321 and the CMS admin at http://localhost:4321/admin/index.html. Dev runs against the local filesystem and needs no Tina Cloud credentials.

Search needs a build first, because Pagefind indexes the built output.

### Commands

| Command | What it does |
|---|---|
| `bun run dev` | Dev server with the Tina admin |
| `bun run build:local` | Full production build from local content. No credentials needed |
| `bun run build` | Same build, but the admin points at Tina Cloud. Needs the two variables in `.env.example` |
| `bun run build:cloud` | Build with content fetched from Tina Cloud |
| `bun run preview` | `build:local`, then serve it with `wrangler dev` |
| `bun run deploy` | Deploy the last build to Cloudflare Workers |
| `bun run check` | The content-parse and safety suites in `scripts/`. Also runs inside every build |
| `bun run check:dev-smoke` | Start a dev server, load real pages, shut it down |
| `bun run lint` | Biome: lint, import order and formatting |
| `bun run format` | Biome: write formatting |
| `vale src/data/blog/` | Prose lint |

## Content

Everything editorial is a TinaCMS collection, defined in `tina/collections/`.

| Collection | Where | What |
|---|---|---|
| `blog` | `src/data/blog/<slug>/index.md` | Posts as Markdown, images colocated in the same folder |
| `page` | `content/pages/*.mdx` | Pages assembled from blocks: hero, prose, post feed, GitHub stats |
| `settings` | `content/settings/index.json` | The sidebar profile, nav and social links |

Posts need `title`, `description` and `pubDatetime`. `draft: true` or a future `pubDatetime` keeps a post out of production builds. The dev server still shows it, so you can preview it.

Tina's Markdown parser is stricter than CommonMark. Two things it rejects: code fences inside list items, and nested lists. `bun run check` catches both.

Create a page in the admin and it publishes at its slug with no code change. The catch-all route in `src/pages/[...slug].astro` builds every page in the collection.

## Layout

```
src/
  components/   Astro components. blocks/ are the CMS page blocks, islands/ the editable regions
  layouts/      Page shells, including the post layout
  pages/        File-based routing
  lib/tina/     Adapters between Tina and the pages. Every one throws on an empty result
  styles/       Tailwind entry, tokens, prose styles
  data/blog/    Posts
content/        CMS pages and settings
tina/           CMS schema. __generated__ is written by the Tina CLI at build time
scripts/        The check suites
public/         Copied verbatim. Not for content images
```

`CLAUDE.md` holds the engineering notes: the design system, why the dev script looks the way it does, and the image pipeline.

## CI

| Workflow | Runs on | Does |
|---|---|---|
| Checks | every push and PR | `bun run check` |
| Prose lint | PRs | Vale over the posts |
| Preview | PRs | Builds, uploads a Workers version, comments the preview URL on the PR |
| Deploy | pushes to `main` and nightly | Builds and deploys |

The Tina Cloud schema check in the preview build runs against the PR branch, so a PR that adds a CMS field passes once Tina Cloud has indexed the branch.

## License

MIT, see `LICENSE`.
