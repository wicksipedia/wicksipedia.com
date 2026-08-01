# TinaCMS + Astro 7 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move wicksipedia.com from Astro content collections to TinaCMS-backed content on Astro 7, with `data-tina-field` click-to-edit and `<TinaIsland>` live re-rendering for the blog, site settings, and the home/about pages.

**Architecture:** Content stops flowing through `astro:content` and starts flowing through TinaCMS's generated GraphQL client. A thin adapter (`src/lib/tina/posts.ts`) normalises Tina blog nodes into the exact shape existing components already consume (`{ id, filePath, data }`), so ~20 call sites change their import and nothing else. Post bodies render through `<TinaMarkdown>` with a custom renderer that re-adds the two things Tina's AST drops on the floor: dual-theme Shiki highlighting (with the site's transformers) and Astro-optimised colocated images. Visual editing works on a statically-built site because every editable region is wrapped in `<TinaIsland>`, which the Tina bridge refreshes by calling one on-demand route (`/tina-island/[name]`) served by the Cloudflare Worker.

**Tech Stack:** Astro 7.1.x · `@tinacms/astro` 0.6.x · `tinacms` 3.11.x · `@tinacms/cli` 2.5.x · `@astrojs/cloudflare` 14.x · Shiki 4 · TailwindCSS 4 · Bun (package manager + task runner) · Cloudflare Workers · Tina Cloud (Phase 4)

---

## Global Constraints

- **Package manager is `bun`.** The repo ships `bun.lock` and `.github/workflows/daily-deploy.yml` runs `bun install` / `bun run build` / `bun run deploy`. Use `bun add`, `bun remove`, `bun run`. Do not create `package-lock.json` or `pnpm-lock.yaml`.
- **Branch:** all work happens on `feat/tinacms-astro7`, cut from `main`. Never commit to `main`.
- **Phase review gate:** at the end of every phase, STOP and ask Matt to review before starting the next phase. Commits within a phase are fine (they are local to the branch and keep work recoverable); moving to the next phase is not.
- **Astro version floor:** `astro@^7.1.6`. Node `>=22.12.0`.
- **No React in the shipped page.** `react` / `react-dom` stay as **devDependencies only** — the TinaCMS admin SPA build needs them. Zero `client:*` directives exist in this repo today; keep it that way.
- **Design must not regress.** `CLAUDE.md` defines the design system: orange `var(--accent)` for anything interactive, `rounded-xl`, `border-border/50`, `bg-muted/20`, `text-foreground/60` for muted text. No new hardcoded colours, no green accents. Every UI-touching task ends with the three checks named in `CLAUDE.md`: (1) mobile vs desktop layout consistency, (2) no duplicate elements at different breakpoints, (3) CSS animations still run.
- **Shiki config is site-wide and fixed:** themes `{ light: "min-light", dark: "night-owl" }`, `defaultColor: false`, `wrap: false`, transformers `[transformerFileName({ style: "v2", hideDot: false }), transformerNotationHighlight(), transformerNotationWordHighlight(), transformerNotationDiff({ matchAlgorithm: "v3" })]`. These emit the `--shiki-light` / `--shiki-dark` CSS variables that `src/styles/typography.css` targets. Any code path that highlights code must use exactly this config.
- **Shiki must use the JavaScript regex engine** (`createJavaScriptRegexEngine()` from `shiki/engine/javascript`), never the default Oniguruma WASM engine. The island route renders inside Astro's container on workerd, which forbids `WebAssembly.instantiate`.
- **Blog post URLs must not change.** Posts live at `/blog/<folder-slug>`. `src/utils/getPath.ts` derives that from `filePath`; the adapter must feed it a `filePath` of `src/data/blog/<slug>/index.md`.
- **Prose linting:** if any blog post body is edited, run `vale src/data/blog/<slug>/index.md` and resolve all errors before committing.

---

## File Structure

**New files**

| File | Responsibility |
|---|---|
| `tina/config.ts` | Tina schema entry: branch resolution, Cloud credentials, admin build output, collection list. |
| `tina/collections/blog.ts` | `blog` collection — maps `src/data/blog/{slug}/index.md`. |
| `tina/collections/settings.ts` | `settings` singleton — header/footer nav + social links. |
| `tina/collections/page.ts` | `page` collection — home + about, block lists. |
| `src/lib/tina/posts.ts` | Data adapter: Tina blog nodes → `PostEntry` (the shape existing components expect). Also the raw metadata-tagged query used by islands. |
| `src/lib/tina/images.ts` | Maps `/blog/<slug>/<file>` refs back to source `ImageMetadata` for build-time optimisation. |
| `src/lib/tina/settings.ts` | Loader for the `settings` singleton. |
| `src/lib/tina/pages.ts` | Loader + derived block types for the `page` collection. |
| `src/lib/islands.ts` | Island registry — the single place an editable region is declared. |
| `src/pages/tina-island/[name].ts` | The one on-demand route the Tina bridge calls to re-render an island. |
| `src/components/RichText.astro` | `<TinaMarkdown>` wrapper: AST walk that resolves images and pre-highlights code blocks. |
| `src/components/islands/BlogBody.astro` | Editable post body region. |
| `src/components/islands/PostHero.astro` | Editable post title/description/date/tags region. |
| `src/components/islands/PageBlocks.astro` | Editable page-blocks region (home + about). |
| `src/components/blocks/*.astro` + `*.template.ts` | One component + one Tina template per block type. Colocated so a block's schema and its rendering change together. |
| `src/shiki.ts` | Single shared Shiki configuration object + highlighter factory. |
| `src/middleware.ts` | Dev-only: serves colocated blog images at their absolute `/blog/<slug>/<file>` URL. |
| `scripts/check-content.mjs` | Runnable content check: every post parses to a clean Tina rich-text AST. |
| `content/settings/index.json` | Site settings document. |
| `content/pages/home.mdx`, `content/pages/about.mdx` | Page documents (blocks in frontmatter). |

**Files deleted by the end of Phase 3**

`src/content.config.ts`, `src/pages/about.mdx`, `src/layouts/AboutLayout.astro`, `src/utils/postFilter.ts`'s `CollectionEntry` dependency, and the `@astrojs/mdx` / `@astrojs/react` / `remark-toc` / `remark-collapse` / `@astrojs/markdown-remark` dependencies.

**Files modified**

The 20 files that currently import `astro:content`: `src/components/{Card,EditPost,Pagination,RelatedPosts}.astro`, `src/layouts/PostDetails.astro`, `src/pages/index.astro`, `src/pages/archives/index.astro`, `src/pages/blog/[...page].astro`, `src/pages/blog/[...slug]/index.astro`, `src/pages/blog/[...slug]/index.png.ts`, `src/pages/rss.xml.ts`, `src/pages/tags/[tag]/[...page].astro`, `src/pages/tags/index.astro`, `src/utils/{generateOgImages,getPostsByGroupCondition,getPostsByTag,getSortedPosts,getUniqueTags,postFilter}.ts`.

---

## Phase 0 — Astro 7 upgrade, no TinaCMS

Ships a site that looks and behaves identically to today, on Astro 7, with the dead React toolchain removed. Isolating the framework upgrade from the CMS migration means a Phase 1 failure is unambiguously a Tina failure.

### Task 0.1: Branch and capture a baseline

**Files:**
- Create: none
- Modify: none

**Interfaces:**
- Produces: a `baseline-routes.txt` in the scratchpad listing every HTML page the current build emits. Later phases diff against it to prove no route disappeared.

- [ ] **Step 1: Cut the branch from a clean `main`**

```bash
git switch main
git status --porcelain   # must print nothing
git switch -c feat/tinacms-astro7
```

- [ ] **Step 2: Build the site as it is today**

```bash
bun install
bun run build
```

Expected: exits 0. If it does not, stop — the baseline is broken and nothing below is measurable.

- [ ] **Step 3: Record the route list**

```bash
mkdir -p .baseline
find dist -name '*.html' | sed 's|^dist||' | sort > .baseline/routes.txt
wc -l < .baseline/routes.txt
```

Expected: a non-zero count (the site has 17 posts plus listing/tag/archive pages, so expect well over 40).

- [ ] **Step 4: Assert the baseline is not empty**

```bash
test -s .baseline/routes.txt || { echo "FAIL: empty baseline"; exit 1; }
```

Expected: no output, exit 0. An empty file would make every later "routes match" comparison pass vacuously.

- [ ] **Step 5: Keep the baseline out of git**

Add to `.gitignore`:

```gitignore
.baseline/
```

- [ ] **Step 6: Commit**

```bash
git add .gitignore
git commit -m "chore: ignore local build baseline"
```

---

### Task 0.2: Upgrade to Astro 7 and remove the React toolchain

**Files:**
- Modify: `package.json`, `tsconfig.json`

**Interfaces:**
- Produces: `astro@^7.1.6` installed; `@astrojs/react`, `react`, `react-dom`, `@types/react`, `@types/react-dom` gone from `dependencies`.

- [ ] **Step 1: Confirm nothing actually uses React**

```bash
git ls-files | grep -E '\.(tsx|jsx)$' || echo "no react files"
grep -rn 'client:load\|client:visible\|client:idle\|client:only' src || echo "no client directives"
```

Expected: `no react files` and `no client directives`. If either prints matches, STOP and report — this task's premise is wrong.

- [ ] **Step 2: Remove the React dependencies**

```bash
bun remove @astrojs/react react react-dom @types/react @types/react-dom
```

- [ ] **Step 3: Upgrade Astro and the integrations that peer-depend on it**

```bash
bun add astro@^7.1.6 @astrojs/mdx@^7 @astrojs/sitemap@^3.7 @astrojs/rss@^4 @astrojs/markdown-remark@latest
bun add -d @astrojs/check@^0.9.9 typescript@^5.9.3
```

`@astrojs/markdown-remark` is installed deliberately: Astro 7 swaps the default Markdown processor to Sätteri, and this site's code-block rendering depends on the remark/rehype pipeline's `shikiConfig` semantics. Pinning the old processor keeps Phase 0 a pure version bump with no rendering drift. Phase 1 deletes it again when posts stop going through Astro's Markdown pipeline at all.

- [ ] **Step 4: Drop the React JSX settings from `tsconfig.json`**

Remove these two lines from `compilerOptions`:

```json
		"jsx": "react-jsx",
		"jsxImportSource": "react"
```

The resulting file:

```json
{
	"extends": "astro/tsconfigs/strict",
	"include": [".astro/types.d.ts", "**/*"],
	"exclude": ["dist", "public/pagefind"],
	"compilerOptions": {
		"baseUrl": ".",
		"paths": {
			"@/*": ["./src/*"]
		}
	}
}
```

- [ ] **Step 5: Verify the installed version**

```bash
bun pm ls | grep -E '^\s*├─|└─' | grep astro | head
node -e "console.log(require('./node_modules/astro/package.json').version)"
```

Expected: a `7.x` version string.

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lock tsconfig.json
git commit -m "chore: upgrade to Astro 7, drop unused React toolchain"
```

---

### Task 0.3: Bring `astro.config.ts` up to Astro 7

**Files:**
- Modify: `astro.config.ts`

**Interfaces:**
- Produces: a config with no `experimental` block, no `react()` integration, and an explicit `markdown.processor`.

Three things changed between Astro 5 and 7 that this config trips over:

1. `experimental.fonts` graduated to a top-level `fonts` option (Astro 6).
2. `experimental.preserveScriptOrder` was removed — declaration order is now the default (Astro 6).
3. `markdown.remarkPlugins` moved onto a `unified()` processor, and Astro 7's default processor is Sätteri (Astro 6/7).

`remark-toc` and `remark-collapse` are configured today but no content uses them — no file in `src/data/blog` or `src/pages` contains a "Table of contents" heading. They are removed rather than ported.

- [ ] **Step 1: Remove the two unused remark plugins**

```bash
bun remove remark-toc remark-collapse
rm src/remark-collapse.d.ts
```

- [ ] **Step 2: Rewrite the config**

Replace the import block and the `integrations` / `markdown` / `experimental` sections of `astro.config.ts`:

```ts
import { unified } from "@astrojs/markdown-remark";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import {
	transformerNotationDiff,
	transformerNotationHighlight,
	transformerNotationWordHighlight,
} from "@shikijs/transformers";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig, envField, fontProviders } from "astro/config";
import { SITE } from "./src/config";
import { transformerFileName } from "./src/utils/transformers/fileName";

export default defineConfig({
	site: SITE.website,
	trailingSlash: "never",
	output: "static",

	integrations: [
		sitemap({
			filter: (page) => {
				if (!SITE.showArchives && page.endsWith("/archives")) return false;
				if (page.includes("/tags")) return false;
				if (page.endsWith("/search")) return false;
				if (/\/blog\/\d+$/.test(page)) return false;
				return true;
			},
		}),
		mdx(),
	],

	markdown: {
		// Astro 7 defaults to the Sätteri processor. This site's code blocks rely
		// on the remark/rehype pipeline's shikiConfig (dual themes + notation
		// transformers), so pin the old processor explicitly. Phase 1 removes this
		// entirely — post bodies stop going through Astro's Markdown pipeline.
		processor: unified({ gfm: true, smartypants: true }),
		shikiConfig: {
			themes: { light: "min-light", dark: "night-owl" },
			defaultColor: false,
			wrap: false,
			transformers: [
				transformerFileName({ style: "v2", hideDot: false }),
				transformerNotationHighlight(),
				transformerNotationWordHighlight(),
				transformerNotationDiff({ matchAlgorithm: "v3" }),
			],
		},
	},

	vite: {
		plugins: [tailwindcss(), basicSsl()],
		optimizeDeps: {
			exclude: ["@resvg/resvg-js"],
		},
		server: {
			cors: true, // giscus iframe fetches theme CSS cross-origin
		},
	},

	image: {
		responsiveStyles: true,
		layout: "constrained",
		service: {
			entrypoint: "astro/assets/services/sharp",
			config: {
				limitInputPixels: false,
			},
		},
	},

	env: {
		schema: {
			PUBLIC_GOOGLE_SITE_VERIFICATION: envField.string({
				access: "public",
				context: "client",
				optional: true,
			}),
		},
	},

	fonts: [
		{
			name: "Google Sans Code",
			cssVariable: "--font-google-sans-code",
			provider: fontProviders.google(),
			fallbacks: ["monospace"],
			weights: [300, 400, 500, 600, 700],
			styles: ["normal", "italic"],
		},
		{
			name: "Source Serif 4",
			cssVariable: "--font-source-serif",
			provider: fontProviders.google(),
			fallbacks: ["Georgia", "serif"],
			weights: [400, 600, 700],
			styles: ["normal", "italic"],
		},
	],
});
```

- [ ] **Step 3: Type-check**

```bash
bunx astro check
```

Expected: 0 errors. Two likely failures and their fixes:

- `image.responsiveStyles` reported as unknown — Astro 6 moved responsive styles to build-time emission. If flagged, delete the `responsiveStyles: true` line; `layout: "constrained"` alone keeps the behaviour.
- Unclosed-tag errors from the new Rust compiler. Astro 7's compiler no longer silently repairs unclosed or invalidly-nested HTML. Fix the markup it names; do not suppress.

- [ ] **Step 4: Build**

```bash
bun run build
```

Expected: exits 0.

- [ ] **Step 5: Prove no route disappeared**

```bash
find dist -name '*.html' | sed 's|^dist||' | sort > /tmp/routes-after.txt
diff .baseline/routes.txt /tmp/routes-after.txt && echo "ROUTES MATCH"
```

Expected: `ROUTES MATCH`.

- [ ] **Step 6: Prove the check can actually fail**

Break one route on purpose, confirm the diff goes red, restore, and verify the restore by content hash:

```bash
shasum -a 256 src/pages/archives/index.astro > /tmp/archives.sha
git mv src/pages/archives/index.astro src/pages/archives/_index.astro.bak
bun run build >/dev/null 2>&1
find dist -name '*.html' | sed 's|^dist||' | sort > /tmp/routes-broken.txt
diff .baseline/routes.txt /tmp/routes-broken.txt && echo "UNEXPECTED: check did not fail" || echo "GOOD: check fails when a route is missing"
git mv src/pages/archives/_index.astro.bak src/pages/archives/index.astro
shasum -a 256 -c /tmp/archives.sha
```

Expected: `GOOD: check fails when a route is missing`, then `src/pages/archives/index.astro: OK` from the hash check.

- [ ] **Step 7: Visual check in the browser**

```bash
bun run dev
```

Open `http://localhost:4321` and confirm, in both light and dark themes:
1. Mobile (375px) and desktop (1440px) layouts match today's site — header nav collapses, hero stacks, post grid goes one column.
2. No element renders twice across breakpoints.
3. Animations run: the header's bouncing orange dot, the staggered `animate-reveal` section fade-ins on the homepage, and the card hover lift.
4. A post page (`/blog/modern-zsh-setup`) still shows dual-theme Shiki code blocks with filename labels and diff markers.

- [ ] **Step 8: Commit**

```bash
git add astro.config.ts package.json bun.lock
git rm --cached src/remark-collapse.d.ts 2>/dev/null || true
git commit -m "feat: migrate astro.config to Astro 7 config surface"
```

- [ ] **Step 9: PHASE 0 REVIEW GATE — stop and ask Matt to review before starting Phase 1.**

---

## Phase 1 — TinaCMS scaffold and Tina-native blog with visual editing

The largest phase. At the end of it, `/admin` edits posts, the site renders those posts from Tina's GraphQL layer, and clicking a post's title or body inside the admin iframe focuses the matching form field.

### Task 1.1: Install TinaCMS and define the blog collection

**Files:**
- Create: `tina/config.ts`, `tina/collections/blog.ts`, `.env.example`
- Modify: `package.json`, `.gitignore`

**Interfaces:**
- Produces: `tina/__generated__/client.ts` (generated, committed) exposing `client.queries.blog({ relativePath })` and `client.queries.blogConnection({ first })`. The `Blog` node carries `title`, `description`, `pubDatetime`, `modDatetime`, `author`, `ogImage`, `tags`, `featured`, `draft`, `canonicalURL`, `hideEditPost`, `timezone`, `noindex`, `body`, and `_sys`.

- [ ] **Step 1: Install**

```bash
bun add @tinacms/astro@^0.6.1 tinacms@^3.11
bun add -d @tinacms/cli@^2.5 react@^19.2 react-dom@^19.2
```

`react` and `react-dom` are devDependencies only — `tinacms build` compiles the admin SPA with them, and nothing in `src/` imports React.

- [ ] **Step 2: Write `tina/collections/blog.ts`**

```ts
import type { Collection } from "tinacms";

// Posts live as `src/data/blog/{slug}/index.md` with colocated images.
// Tina indexes each `index.md`; the URL slug is the parent folder, not the
// literal `index` filename — hence the router and the slugify override below.
export const blogCollection: Collection = {
	name: "blog",
	label: "Blog Posts",
	path: "src/data/blog",
	// Plain CommonMark, not MDX: no post uses components, and `md` parses shell
	// `${...}` braces and `<word word>` literally instead of choking on them as
	// MDX expressions.
	format: "md",
	match: {
		// Only per-post index files; `_`-prefixed draft directories are excluded.
		include: "**/index",
	},
	ui: {
		router: ({ document }) =>
			`/blog/${document._sys.breadcrumbs.slice(0, -1).join("/")}`,
		filename: {
			readonly: false,
			slugify: (values) => {
				const slug = (values?.title ?? "untitled")
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, "-")
					.replace(/^-+|-+$/g, "");
				return `${slug}/index`;
			},
		},
	},
	fields: [
		{
			type: "string",
			name: "title",
			label: "Title",
			isTitle: true,
			required: true,
		},
		{
			type: "string",
			name: "description",
			label: "Description",
			required: true,
		},
		{
			type: "datetime",
			name: "pubDatetime",
			label: "Published",
			required: true,
		},
		{ type: "datetime", name: "modDatetime", label: "Last Modified" },
		{ type: "string", name: "author", label: "Author" },
		{ type: "image", name: "ogImage", label: "Cover / OG Image" },
		{ type: "string", name: "tags", label: "Tags", list: true },
		{ type: "boolean", name: "featured", label: "Featured" },
		{ type: "boolean", name: "draft", label: "Draft" },
		{ type: "string", name: "canonicalURL", label: "Canonical URL" },
		{ type: "boolean", name: "hideEditPost", label: "Hide Edit Link" },
		{ type: "string", name: "timezone", label: "Timezone" },
		{ type: "boolean", name: "noindex", label: "No Index" },
		{
			type: "rich-text",
			name: "body",
			label: "Body",
			isBody: true,
		},
	],
};
```

- [ ] **Step 3: Write `tina/config.ts`**

```ts
import { defineConfig } from "tinacms";
import { blogCollection } from "./collections/blog";

// Branch Tina Cloud reads and writes against. CI providers expose it under
// different names; fall back to `main`.
const branch =
	process.env.GITHUB_BRANCH ||
	process.env.WORKERS_CI_BRANCH ||
	process.env.CF_PAGES_BRANCH ||
	process.env.HEAD ||
	"main";

export default defineConfig({
	branch,
	// Empty strings keep `tinacms dev` (local filesystem mode) working with no
	// credentials. Phase 4 wires the real Tina Cloud values.
	clientId: process.env.PUBLIC_TINA_CLIENT_ID ?? "",
	token: process.env.TINA_TOKEN ?? "",

	build: {
		// Admin SPA is emitted to public/admin and served at /admin.
		outputFolder: "admin",
		publicFolder: "public",
	},

	media: {
		tina: {
			mediaRoot: "uploads",
			publicFolder: "public",
		},
	},

	schema: {
		collections: [blogCollection],
	},
});
```

- [ ] **Step 4: Write `.env.example`**

```bash
# Tina Cloud — https://app.tina.io (required for `bun run build`, not for `bun run dev`)
PUBLIC_TINA_CLIENT_ID=
TINA_TOKEN=
```

- [ ] **Step 5: Update `.gitignore`**

Append:

```gitignore
# TinaCMS
public/admin
tina/__generated__/*.js
.env
```

`tina/__generated__/client.ts`, `types.ts`, and the `.json`/`.gql` schema artifacts stay committed — the site imports the client at build time, and CI must not need a Tina generate step to type-check.

- [ ] **Step 6: Add the Tina-wrapped scripts to `package.json`**

Replace the `dev` script and add `build:local`:

```json
		"dev": "tinacms dev -c \"astro dev\"",
		"build:local": "tinacms build --local --skip-cloud-checks -c \"astro check && astro build\"",
```

Leave `build` alone for now — Task 1.7 rewrites it once the Cloudflare adapter changes the output directory.

- [ ] **Step 7: Generate the client**

```bash
bunx tinacms build --local --skip-cloud-checks
```

Expected: `tina/__generated__/` is created. This will report schema errors against the current `.mdx` posts (the collection declares `format: "md"`), which Task 1.2 fixes. A non-zero exit here is acceptable **only** if the error names missing `.md` files; any other error must be resolved before continuing.

- [ ] **Step 8: Commit**

```bash
git add tina .env.example .gitignore package.json bun.lock
git commit -m "feat: scaffold TinaCMS with the blog collection"
```

---

### Task 1.2: Convert posts to Tina-parseable Markdown

**Files:**
- Create: `scripts/check-content.mjs`
- Modify: all 17 `src/data/blog/*/index.mdx` → `index.md`

**Interfaces:**
- Produces: every post parses through `@tinacms/mdx` with zero `invalid_markdown` nodes. `bun run check:content` is the gate.

Tina parses rich-text bodies into a constrained AST, and a single unsupported construct fails the **whole document** to one `invalid_markdown` node — the post then renders as raw text in a `<pre>`. Two constructs in this repo trigger it:

- A fenced code block indented inside a list item → `code inside list item is not supported`.
- A list nested inside another list item or a blockquote → `UnwrapBlock: Unknown block content of type list`.

Six posts hit these: `git-and-diffs`, `github-settings-as-code`, `setting-up-a-new-mac`, `speeding-up-zsh-startup`, `the-future-of-software-engineering-is-not-what-you-think`, `verifying-your-github-commits`.

Sixteen of the seventeen posts were already converted on the abandoned `feat/tinacms-migration` branch, and all sixteen parse clean against the current parser. Reuse them rather than redoing the restructuring by hand.

- [ ] **Step 1: Write the content check**

Create `scripts/check-content.mjs`:

```js
/**
 * Every blog post body must parse into Tina's rich-text AST without producing
 * an `invalid_markdown` node — one such node fails the entire document, and the
 * post renders as raw text in a <pre> instead of prose.
 *
 * Run: bun run check:content
 */
import { parseMDX } from "@tinacms/mdx";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const BASE = "src/data/blog";
const FIELD = { type: "rich-text", name: "body", parser: { type: "markdown" } };

const dirs = readdirSync(BASE).filter((d) =>
	statSync(join(BASE, d)).isDirectory() && !d.startsWith("_"),
);

// A loop over an empty set passes identically to success. Refuse to pass here.
if (dirs.length === 0) {
	console.error(`FAIL: no post directories found under ${BASE}`);
	process.exit(1);
}

let checked = 0;
let failed = 0;

for (const dir of dirs) {
	const file = join(BASE, dir, "index.md");
	let raw;
	try {
		raw = readFileSync(file, "utf8");
	} catch {
		console.error(`FAIL: ${dir} has no index.md`);
		failed++;
		continue;
	}
	const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
	const ast = parseMDX(body, FIELD, (s) => s);
	const invalid = (ast.children ?? []).filter(
		(node) => node.type === "invalid_markdown",
	);
	checked++;
	if (invalid.length > 0) {
		failed++;
		console.error(`FAIL: ${dir}`);
		for (const node of invalid) {
			console.error(`  line ${node.position?.start?.line}: ${node.message}`);
		}
	}
}

if (checked !== dirs.length) {
	console.error(`FAIL: checked ${checked} of ${dirs.length} posts`);
	process.exit(1);
}

if (failed > 0) {
	console.error(`\n${failed} of ${checked} posts failed to parse`);
	process.exit(1);
}

console.log(`OK: ${checked} posts parse cleanly`);
```

Add the script to `package.json`:

```json
		"check:content": "node scripts/check-content.mjs",
```

- [ ] **Step 2: Take the sixteen already-converted posts from the abandoned branch**

```bash
git rm -q src/data/blog/*/index.mdx
git checkout feat/tinacms-migration -- src/data/blog
git status --porcelain src/data/blog | head -30
```

This restores sixteen `index.md` files. `src/data/blog/aspire-sqlclient-7-missing-azure-provider/` predates nothing on that branch, so its `index.mdx` was deleted by the `git rm` and must be re-added in the next step.

- [ ] **Step 3: Restore and convert the seventeenth post**

```bash
git checkout main -- src/data/blog/aspire-sqlclient-7-missing-azure-provider
git mv src/data/blog/aspire-sqlclient-7-missing-azure-provider/index.mdx \
       src/data/blog/aspire-sqlclient-7-missing-azure-provider/index.md
```

This post contains no MDX components — the only capitalised angle-bracket content is XML inside a fenced code block — so the rename is the whole conversion.

- [ ] **Step 4: Run the check**

```bash
bun run check:content
```

Expected: `OK: 17 posts parse cleanly`.

- [ ] **Step 5: Prove the check can fail**

```bash
POST=src/data/blog/terminal-setup/index.md
shasum -a 256 "$POST" > /tmp/post.sha
printf '\n1. step\n\n   ```sh\n   echo hi\n   ```\n' >> "$POST"
bun run check:content && echo "UNEXPECTED: check passed on broken content" || echo "GOOD: check fails on code-in-list"
git checkout -- "$POST"
shasum -a 256 -c /tmp/post.sha
```

Expected: `GOOD: check fails on code-in-list`, then `src/data/blog/terminal-setup/index.md: OK`.

- [ ] **Step 6: Point the Astro collection at `.md` so Phase 1 stays buildable**

In `src/content.config.ts`, change the glob pattern:

```ts
	loader: glob({ pattern: "**/[^_]*.md", base: `./${BLOG_PATH}` }),
```

This file is deleted in Task 1.5; the edit only keeps the site building between tasks.

- [ ] **Step 7: Verify the site still builds and every route survives**

```bash
bun run build
find dist -name '*.html' | sed 's|^dist||' | sort > /tmp/routes-after.txt
diff .baseline/routes.txt /tmp/routes-after.txt && echo "ROUTES MATCH"
```

Expected: `ROUTES MATCH`.

- [ ] **Step 8: Lint the prose that changed**

```bash
vale src/data/blog/
```

Expected: 0 errors. The six restructured posts changed body text layout; Vale must still pass.

- [ ] **Step 9: Commit**

```bash
git add src/data/blog scripts/check-content.mjs package.json src/content.config.ts
git commit -m "feat: convert blog posts to Tina-parseable Markdown"
```

---

### Task 1.3: Build the post data adapter

**Files:**
- Create: `src/lib/tina/posts.ts`, `src/lib/tina/images.ts`
- Modify: none yet

**Interfaces:**
- Produces:
  - `type PostEntry = { id: string; slug: string; relativePath: string; filePath: string; collection: "blog"; data: PostData; body: TinaRichTextContent | null }`
  - `type PostData = { title: string; description: string; author: string; pubDatetime: Date; modDatetime: Date | null; tags: string[]; ogImage: ImageMetadata | string | undefined; featured: boolean; draft: boolean; canonicalURL?: string; hideEditPost?: boolean; timezone?: string; noindex?: boolean }`
  - `getAllPosts(): Promise<PostEntry[]>`
  - `getPostByPath(relativePath: string): Promise<PostEntry>`
  - `getBlogRaw(slug: string): Promise<QueryResult<BlogQuery>>` — metadata-tagged, for islands
  - `resolveBlogImage(slug: string, ref?: string | null): ImageMetadata | string | undefined`

`PostEntry` deliberately mirrors `CollectionEntry<"blog">`'s `{ id, filePath, data }` shape. That is what lets `getSortedPosts`, `getUniqueTags`, `getPostsByGroupCondition`, `getPath`, `Card`, and `Datetime` keep working with a one-line import change instead of a rewrite.

- [ ] **Step 1: Write `src/lib/tina/images.ts`**

```ts
import type { ImageMetadata } from "astro";

/**
 * Colocated post images live at `src/data/blog/{slug}/{file}`. Posts reference
 * them as `/blog/<slug>/<file>` — absolute, not `./file.png` — because the Tina
 * editor resolves a stored ref as-is and has no post-folder context to resolve a
 * relative path against.
 *
 * A static build cannot serve files out of `src/`, so eagerly glob every blog
 * image and map the stored ref back to its `ImageMetadata`. That lets Astro's
 * <Image> / getImage() optimise it exactly as the MDX pipeline used to, so the
 * published page still serves `/_astro/*.webp`.
 *
 * Remote URLs and media-manager paths (`/uploads/...`) pass through untouched.
 */
const blogImages = import.meta.glob<{ default: ImageMetadata }>(
	"/src/data/blog/**/*.{png,PNG,jpg,JPG,jpeg,JPEG,webp,WEBP,gif,GIF,svg,SVG,avif,AVIF}",
	{ eager: true },
);

export function resolveBlogImage(
	slug: string,
	ref?: string | null,
): ImageMetadata | string | undefined {
	if (!ref) return undefined;

	const blogRef = ref.match(/^\/blog\/(.+\.\w+)$/);
	if (blogRef) {
		return blogImages[`/src/data/blog/${blogRef[1]}`]?.default ?? ref;
	}

	if (/^https?:\/\//i.test(ref) || ref.startsWith("/")) return ref;

	// Legacy `./file.png` refs, resolved against the post's own folder.
	const file = ref.replace(/^\.?\//, "");
	return blogImages[`/src/data/blog/${slug}/${file}`]?.default ?? ref;
}
```

- [ ] **Step 2: Write `src/lib/tina/posts.ts`**

```ts
import { requestWithMetadata } from "@tinacms/astro/data";
import type { TinaRichTextContent } from "@tinacms/astro/types";
import type { ImageMetadata } from "astro";
import { SITE } from "@/config";
import client from "../../../tina/__generated__/client";
import { resolveBlogImage } from "./images";

export const BLOG_PATH = "src/data/blog";

/**
 * Normalised post shape. Deliberately mirrors `CollectionEntry<"blog">`
 * (`id` / `filePath` / `data`) so getSortedPosts, getUniqueTags,
 * getPostsByGroupCondition, getPath, Card, and Datetime keep working against
 * the Tina data layer with no behavioural change.
 */
export type PostData = {
	title: string;
	description: string;
	author: string;
	pubDatetime: Date;
	modDatetime: Date | null;
	tags: string[];
	/** Colocated images resolve to ImageMetadata (optimised); remote refs stay strings. */
	ogImage: ImageMetadata | string | undefined;
	featured: boolean;
	draft: boolean;
	canonicalURL?: string;
	hideEditPost?: boolean;
	timezone?: string;
	noindex?: boolean;
};

export type PostEntry = {
	id: string;
	slug: string;
	/** Tina relativePath, e.g. `git-and-diffs/index.md`. */
	relativePath: string;
	filePath: string;
	collection: "blog";
	data: PostData;
	body: TinaRichTextContent | null;
};

/** Raw Tina `Blog` node — the subset this site consumes. */
type BlogNode = {
	title: string;
	description: string;
	pubDatetime: string;
	modDatetime?: string | null;
	author?: string | null;
	ogImage?: string | null;
	tags?: Array<string | null> | null;
	featured?: boolean | null;
	draft?: boolean | null;
	canonicalURL?: string | null;
	hideEditPost?: boolean | null;
	timezone?: string | null;
	noindex?: boolean | null;
	body?: TinaRichTextContent | null;
	_sys: { relativePath: string };
};

function normalize(node: BlogNode): PostEntry {
	const relativePath = node._sys.relativePath;
	const slug = relativePath.replace(/\/index\.mdx?$/i, "");
	const tags = (node.tags ?? []).filter((t): t is string => Boolean(t));

	return {
		id: slug,
		slug,
		relativePath,
		filePath: `${BLOG_PATH}/${relativePath}`,
		collection: "blog",
		body: node.body ?? null,
		data: {
			title: node.title,
			description: node.description,
			author: node.author ?? SITE.author,
			pubDatetime: new Date(node.pubDatetime),
			modDatetime: node.modDatetime ? new Date(node.modDatetime) : null,
			tags: tags.length > 0 ? tags : ["others"],
			ogImage: resolveBlogImage(slug, node.ogImage),
			featured: node.featured ?? false,
			draft: node.draft ?? false,
			canonicalURL: node.canonicalURL ?? undefined,
			hideEditPost: node.hideEditPost ?? undefined,
			timezone: node.timezone ?? undefined,
			noindex: node.noindex ?? undefined,
		},
	};
}

/** Every post, unfiltered. Draft/scheduled filtering stays in postFilter. */
export async function getAllPosts(): Promise<PostEntry[]> {
	const res = await client.queries.blogConnection({ first: 1000 });
	const edges = res.data.blogConnection.edges ?? [];
	const posts = edges.flatMap((edge) =>
		edge?.node ? [normalize(edge.node as BlogNode)] : [],
	);
	// An empty result from a non-empty source is never intentional — a silently
	// empty post list would build a site with no blog and report success.
	if (posts.length === 0) {
		throw new Error("getAllPosts: Tina returned zero posts");
	}
	return posts;
}

/** A single post by its Tina relativePath (e.g. `git-and-diffs/index.md`). */
export async function getPostByPath(relativePath: string): Promise<PostEntry> {
	const res = await client.queries.blog({ relativePath });
	return normalize(res.data.blog as BlogNode);
}

/**
 * Raw, metadata-tagged query for one post — used by the visual-editing islands.
 * The result carries the hidden Tina metadata `tinaField()` reads, which the
 * normalised PostEntry intentionally strips. `slug` is the folder slug.
 */
export function getBlogRaw(slug: string) {
	return requestWithMetadata(
		client.queries.blog({ relativePath: `${slug}/index.md` }),
		{ priority: "primary" },
	);
}
```

- [ ] **Step 3: Type-check the new modules in isolation**

```bash
bunx astro check
```

Expected: 0 errors. If `tina/__generated__/client` is missing or stale, regenerate:

```bash
bunx tinacms build --local --skip-cloud-checks
```

- [ ] **Step 4: Prove the adapter returns real data**

```bash
bunx tinacms dev -c "astro build" 2>&1 | tail -5
```

The build will still be using `astro:content` at this point — this step only confirms the Tina local GraphQL server starts and indexes the collection. Expected: no `Unable to index` errors and a successful build.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tina
git commit -m "feat: add Tina post data adapter"
```

---

### Task 1.4: Build the rich-text renderer

**Files:**
- Create: `src/shiki.ts`, `src/components/RichText.astro`
- Modify: `astro.config.ts` (import the shared Shiki config)

**Interfaces:**
- Consumes: `resolveBlogImage` from `src/lib/tina/images.ts`.
- Produces: `<RichText content={TinaRichTextContent | null} slug={string} />`, and `src/shiki.ts` exporting `SHIKI_THEMES`, `SHIKI_TRANSFORMERS`, and `getHighlighter(): Promise<Highlighter>`.

Two features of the current MDX pipeline do not survive Tina's AST and must be rebuilt here:

- **Code highlighting.** Tina's `code_block` node carries `{ lang, meta, value }`, but `@tinacms/astro`'s `CodeBlockNode.astro` only forwards `value` and `lang` to a `components.code_block` override — `meta` is dropped, which would lose the `title="~/.zshrc"` filename labels on seven fences across the site. So instead of registering an override, the AST walk **replaces each `code_block` node with an `html` node** holding pre-rendered Shiki output. `html` nodes render through `set:html`, and the walk has access to `lang`, `meta`, and `value`.
- **Colocated images.** `img` nodes hold the raw `/blog/<slug>/<file>` string. The walk rewrites each `url` to the optimised `/_astro/*.webp` emitted by `getImage()`.

- [ ] **Step 1: Write `src/shiki.ts`**

```ts
import {
	transformerNotationDiff,
	transformerNotationHighlight,
	transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { type Highlighter, createHighlighter } from "shiki";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { transformerFileName } from "@/utils/transformers/fileName";

/**
 * One Shiki configuration for the whole site. `defaultColor: false` is what
 * emits the `--shiki-light` / `--shiki-dark` CSS variables that
 * src/styles/typography.css targets; changing it breaks dark mode for code.
 */
export const SHIKI_THEMES = { light: "min-light", dark: "night-owl" } as const;

export const SHIKI_TRANSFORMERS = [
	transformerFileName({ style: "v2", hideDot: false }),
	transformerNotationHighlight(),
	transformerNotationWordHighlight(),
	transformerNotationDiff({ matchAlgorithm: "v3" }),
];

/** Languages used across posts, plus a few common ones. */
const LANGS = [
	"bash",
	"shell",
	"sh",
	"zsh",
	"ini",
	"json",
	"jsonc",
	"yaml",
	"typescript",
	"ts",
	"javascript",
	"js",
	"xml",
	"csharp",
	"diff",
	"powershell",
	"astro",
	"css",
	"html",
];

/**
 * Engine: the JavaScript regex engine, NOT the default Oniguruma WASM one. This
 * module also runs inside Astro's container for the on-demand /tina-island
 * route — a workerd sandbox that forbids `WebAssembly.instantiate`, where the
 * WASM engine throws and takes visual editing down with it.
 */
let highlighterPromise: Promise<Highlighter> | undefined;

export function getHighlighter(): Promise<Highlighter> {
	highlighterPromise ??= createHighlighter({
		themes: [SHIKI_THEMES.light, SHIKI_THEMES.dark],
		langs: LANGS,
		engine: createJavaScriptRegexEngine(),
	});
	return highlighterPromise;
}
```

- [ ] **Step 2: Point `astro.config.ts` at the shared transformers**

Replace the inline transformer array in `astro.config.ts` with the import:

```ts
import { SHIKI_THEMES, SHIKI_TRANSFORMERS } from "./src/shiki";
```

```ts
		shikiConfig: {
			themes: SHIKI_THEMES,
			defaultColor: false,
			wrap: false,
			transformers: SHIKI_TRANSFORMERS,
		},
```

and delete the now-unused `@shikijs/transformers` and `transformerFileName` imports from the config.

- [ ] **Step 3: Write `src/components/RichText.astro`**

```astro
---
import { getImage } from "astro:assets";
import TinaMarkdown from "@tinacms/astro/TinaMarkdown.astro";
import type { TinaRichTextContent } from "@tinacms/astro/types";
import { resolveBlogImage } from "@/lib/tina/images";
import { SHIKI_THEMES, SHIKI_TRANSFORMERS, getHighlighter } from "@/shiki";

/**
 * Renders a Tina rich-text body. Two things the default renderer would drop are
 * rebuilt in a single AST walk before handing the tree to <TinaMarkdown>:
 *
 *  - `code_block` nodes become `html` nodes holding dual-theme Shiki output.
 *    (Not a `components.code_block` override: that API only receives `value`
 *    and `lang`, so fence meta like `title="~/.zshrc"` would be lost.)
 *  - `img` nodes pointing at colocated `/blog/<slug>/<file>` refs get their url
 *    rewritten to the optimised `/_astro/*.webp` from getImage().
 */
interface Props {
	content: TinaRichTextContent | null;
	/** Post folder slug, so colocated image refs resolve to the right folder. */
	slug: string;
}

const { content, slug } = Astro.props;

type AstNode = {
	type?: string;
	url?: string;
	lang?: string;
	meta?: string;
	value?: string;
	children?: AstNode[];
	[key: string]: unknown;
};

const highlighter = await getHighlighter();

function highlight(node: AstNode): AstNode {
	const lang =
		node.lang && highlighter.getLoadedLanguages().includes(node.lang)
			? node.lang
			: "text";
	const html = highlighter.codeToHtml(node.value ?? "", {
		lang,
		themes: SHIKI_THEMES,
		defaultColor: false,
		// Shiki reads the raw fence meta from `__raw`; transformerFileName turns
		// `title="~/.zshrc"` into the filename label above the block.
		meta: { __raw: node.meta ?? "" },
		transformers: [
			...SHIKI_TRANSFORMERS,
			{
				name: "astro-code-class",
				pre(el) {
					const cls = (el.properties.class as string | undefined) ?? "";
					el.properties.class = `astro-code ${cls}`.trim();
				},
			},
		],
	});
	return { type: "html", value: html };
}

async function walk(node: AstNode): Promise<AstNode> {
	if (node.type === "code_block") return highlight(node);

	let next = node;
	if (node.type === "img" && typeof node.url === "string") {
		const resolved = resolveBlogImage(slug, node.url);
		if (resolved && typeof resolved !== "string") {
			const optimised = await getImage({ src: resolved, format: "webp" });
			next = { ...node, url: optimised.src };
		}
	}
	if (next.children?.length) {
		next = { ...next, children: await Promise.all(next.children.map(walk)) };
	}
	return next;
}

const resolved = content
	? ((await walk(content as AstNode)) as TinaRichTextContent)
	: null;
---

{resolved && <TinaMarkdown content={resolved} />}
```

The `astro-code` class matters: `src/styles/typography.css` scopes the dual-theme CSS-variable rules to it, and without it a highlighted block falls back to inline-`code` pill styling.

- [ ] **Step 4: Type-check**

```bash
bunx astro check
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/shiki.ts src/components/RichText.astro astro.config.ts
git commit -m "feat: add Tina rich-text renderer with Shiki and image resolution"
```

---

### Task 1.5: Switch every content consumer to the adapter

**Files:**
- Modify: `src/utils/postFilter.ts`, `src/utils/getSortedPosts.ts`, `src/utils/getUniqueTags.ts`, `src/utils/getPostsByTag.ts`, `src/utils/getPostsByGroupCondition.ts`, `src/utils/getPath.ts`, `src/utils/generateOgImages.ts`, `src/utils/og-templates/post.js`, `src/components/{Card,EditPost,Pagination,RelatedPosts}.astro`, `src/layouts/PostDetails.astro`, `src/pages/index.astro`, `src/pages/archives/index.astro`, `src/pages/blog/[...page].astro`, `src/pages/blog/[...slug]/index.astro`, `src/pages/blog/[...slug]/index.png.ts`, `src/pages/rss.xml.ts`, `src/pages/tags/[tag]/[...page].astro`, `src/pages/tags/index.astro`
- Delete: `src/content.config.ts`

**Interfaces:**
- Consumes: `PostEntry`, `getAllPosts`, `BLOG_PATH` from `src/lib/tina/posts.ts`.
- Produces: no `astro:content` import anywhere in `src/`.

- [ ] **Step 1: List every call site so none is missed**

```bash
grep -rln "astro:content" src | sort
```

Expected: 20 files. Work the list top to bottom.

- [ ] **Step 2: Replace the type import in the five utils**

In each of `src/utils/{postFilter,getSortedPosts,getUniqueTags,getPostsByTag,getPostsByGroupCondition}.ts`, swap:

```ts
import type { CollectionEntry } from "astro:content";
```

for:

```ts
import type { PostEntry } from "@/lib/tina/posts";
```

and replace every `CollectionEntry<"blog">` with `PostEntry`. For example, `src/utils/postFilter.ts` becomes:

```ts
import { SITE } from "@/config";
import type { PostEntry } from "@/lib/tina/posts";

const postFilter = ({ data }: PostEntry) => {
	const isPublishTimePassed =
		Date.now() >
		new Date(data.pubDatetime).getTime() - SITE.scheduledPostMargin;
	const isDraft = data.draft;
	if (isDraft && !import.meta.env.DEV) return false;
	return import.meta.env.DEV || isPublishTimePassed;
};

export default postFilter;
```

- [ ] **Step 3: Move `BLOG_PATH` out of the deleted config**

`src/utils/getPath.ts` imports `BLOG_PATH` from `@/content.config`. Change it to:

```ts
import { BLOG_PATH } from "@/lib/tina/posts";
```

Leave the rest of `getPath.ts` alone — its `index.mdx`/`index.md` handling already covers both extensions via the `slug === "index"` branch.

- [ ] **Step 4: Replace `getCollection("blog")` in the four page/route files**

In `src/pages/index.astro`, `src/pages/archives/index.astro`, `src/pages/tags/index.astro`, and `src/pages/tags/[tag]/[...page].astro`, replace:

```ts
import { getCollection } from "astro:content";
...
const posts = await getCollection("blog");
```

with:

```ts
import { getAllPosts } from "@/lib/tina/posts";
...
const posts = await getAllPosts();
```

- [ ] **Step 5: Update `src/pages/blog/[...page].astro`**

Same swap, plus the filter argument moves from `getCollection`'s second parameter to an explicit `.filter()`:

```ts
import { getAllPosts } from "@/lib/tina/posts";
import postFilter from "@/utils/postFilter";
...
const posts = (await getAllPosts()).filter(postFilter);
```

- [ ] **Step 6: Update `src/pages/blog/[...slug]/index.astro`**

```astro
---
import PostDetails from "@/layouts/PostDetails.astro";
import { type PostEntry, getAllPosts } from "@/lib/tina/posts";
import { getPath } from "@/utils/getPath";
import getSortedPosts from "@/utils/getSortedPosts";
import postFilter from "@/utils/postFilter";

type Props = {
	post: PostEntry;
};

export async function getStaticPaths() {
	const posts = (await getAllPosts()).filter(postFilter);
	return posts.map((post) => ({
		params: { slug: getPath(post.id, post.filePath, false) },
		props: { post },
	}));
}

const { post } = Astro.props;

const posts = getSortedPosts(await getAllPosts());
---

<PostDetails post={post} posts={posts} />
```

- [ ] **Step 7: Update `src/pages/blog/[...slug]/index.png.ts`**

```ts
import type { APIRoute } from "astro";
import { SITE } from "@/config";
import { type PostEntry, getAllPosts } from "@/lib/tina/posts";
import { generateOgImageForPost } from "@/utils/generateOgImages";
import { getPath } from "@/utils/getPath";

export async function getStaticPaths() {
	if (!SITE.dynamicOgImage) return [];

	const posts = (await getAllPosts()).filter(
		({ data }) => (!data.draft || import.meta.env.DEV) && !data.ogImage,
	);

	return posts.map((post) => ({
		params: { slug: getPath(post.id, post.filePath, false) },
		props: post,
	}));
}

export const GET: APIRoute = async ({ props }) => {
	if (!SITE.dynamicOgImage) {
		return new Response(null, { status: 404, statusText: "Not found" });
	}
	const buffer = await generateOgImageForPost(props as PostEntry);
	return new Response(new Uint8Array(buffer), {
		headers: { "Content-Type": "image/png" },
	});
};
```

- [ ] **Step 8: Update `src/pages/rss.xml.ts` and `src/utils/generateOgImages.ts`**

Both take the same treatment: `getCollection("blog")` → `getAllPosts()`, `CollectionEntry<"blog">` → `PostEntry`. In `generateOgImages.ts`:

```ts
import { Resvg } from "@resvg/resvg-js";
import type { PostEntry } from "@/lib/tina/posts";
import postOgImage from "./og-templates/post";
import siteOgImage from "./og-templates/site";

function svgBufferToPngBuffer(svg: string) {
	const resvg = new Resvg(svg);
	return resvg.render().asPng();
}

export async function generateOgImageForPost(post: PostEntry) {
	return svgBufferToPngBuffer(await postOgImage(post));
}

export async function generateOgImageForSite() {
	return svgBufferToPngBuffer(await siteOgImage());
}
```

- [ ] **Step 9: Update the four components**

`src/components/{Card,EditPost,Pagination,RelatedPosts}.astro` each import `CollectionEntry` for their `Props` type only. Swap the import to `import type { PostEntry } from "@/lib/tina/posts";` and replace the type references. No template changes — `PostEntry` exposes the same `id`, `filePath`, and `data` fields.

- [ ] **Step 10: Update `src/layouts/PostDetails.astro`**

Change the Props type to `{ post: PostEntry; posts: PostEntry[] }`, and replace the body rendering. The current layout renders `<Content />` from `render(post)`; replace that with:

```astro
import RichText from "@/components/RichText.astro";
...
<RichText content={post.body} slug={post.slug} />
```

Leave the surrounding hero, share links, comments, and prev/next markup untouched — Task 1.6 wraps parts of it in islands.

- [ ] **Step 11: Delete the Astro content collection**

```bash
git rm src/content.config.ts
```

- [ ] **Step 12: Verify no `astro:content` import survives**

```bash
grep -rn "astro:content" src && echo "FAIL: astro:content still imported" || echo "OK: no astro:content"
```

Expected: `OK: no astro:content`.

- [ ] **Step 13: Type-check and build**

```bash
bunx astro check
bunx tinacms build --local --skip-cloud-checks -c "astro build"
```

Expected: 0 type errors, build exits 0.

- [ ] **Step 14: Prove every route survived the swap**

```bash
find dist -name '*.html' | sed 's|^dist||' | sort > /tmp/routes-after.txt
diff .baseline/routes.txt /tmp/routes-after.txt && echo "ROUTES MATCH"
```

Expected: `ROUTES MATCH`. Any missing route means a post failed to come through Tina — investigate before continuing, do not update the baseline.

- [ ] **Step 15: Spot-check rendered output, not source text**

```bash
grep -c 'astro-code' dist/blog/modern-zsh-setup/index.html
grep -o 'title="~/.zshrc"' dist/blog/modern-zsh-setup/index.html | head -1
grep -o '_astro/[^"]*\.webp' dist/blog/setting-up-a-new-mac/index.html | head -3
```

Expected: a non-zero `astro-code` count (highlighting ran), the filename label present (fence meta survived), and at least one `/_astro/*.webp` reference (colocated images were optimised, not served raw).

- [ ] **Step 16: Commit**

```bash
git add -A src
git commit -m "feat: render blog from TinaCMS instead of astro:content"
```

---

### Task 1.6: Add the Cloudflare adapter, the island route, and visual editing

**Files:**
- Create: `src/pages/tina-island/[name].ts`, `src/lib/islands.ts`, `src/components/islands/BlogBody.astro`, `src/components/islands/PostHero.astro`, `src/middleware.ts`
- Modify: `astro.config.ts`, `src/layouts/PostDetails.astro`, `package.json`, `wrangler.jsonc`

**Interfaces:**
- Consumes: `getBlogRaw` from `src/lib/tina/posts.ts`.
- Produces: `islands: IslandRegistry` with keys `blog` and `blogHero`; `/tina-island/[name]` responding to the bridge.

Static visual editing needs exactly one on-demand route. `<TinaIsland>` emits an inline bootstrap that loads `/admin/bridge.js` only inside the admin iframe; on boot the bridge calls `/tina-island/<name>?slug=<slug>` to pick up form payloads and to re-render a region after each keystroke. That route is `prerender = false`, so the site changes from static-assets-only to static assets plus a Worker.

- [ ] **Step 1: Install the adapter**

```bash
bun add @astrojs/cloudflare@^14.1
bun add -d wrangler@^4.83
```

- [ ] **Step 2: Add the adapter and Tina wiring to `astro.config.ts`**

Add imports:

```ts
import cloudflare from "@astrojs/cloudflare";
import tina from "@tinacms/astro/integration";
import { tinaAdminDevRedirect } from "@tinacms/astro/vite";
import { sessionDrivers } from "astro/config";
```

Add the adapter and session config next to `output: "static"`:

```ts
	// Static by default; the Cloudflare adapter serves the one on-demand route
	// (Tina's /tina-island/[name] island-refresh endpoint) as a Worker.
	output: "static",
	// imageService "compile": Sharp-optimise at build time so prerendered pages
	// keep their /_astro webp output, then pass through at runtime on the Worker.
	// prerenderEnvironment "node": prerender in Node, not workerd, so the
	// build-time OG pipeline (satori + the resvg native addon) can run.
	adapter: cloudflare({
		imageService: "compile",
		prerenderEnvironment: "node",
	}),

	// This site never calls Astro.session. Setting any non-KV driver stops the
	// Cloudflare adapter injecting a `SESSION` KV binding that would otherwise
	// need a provisioned namespace at deploy time.
	session: { driver: sessionDrivers.lruCache() },
```

Add `tina()` to `integrations`, after `mdx()`.

Extend the `vite` block:

```ts
	vite: {
		plugins: [
			tailwindcss(),
			basicSsl(),
			// Makes a bare /admin reachable during `astro dev`.
			tinaAdminDevRedirect(),
			{
				// The Cloudflare adapter hardcodes rollupOptions.external = ["sharp"]
				// and forces ssr.noExternal = true, so resvg's native `.node` binary
				// would be parsed into the Worker bundle and break it. resvg only runs
				// at build time (prerendered OG routes), so append it to the externals
				// after the adapter has set its own.
				name: "externalize-resvg-for-worker",
				enforce: "post",
				config(cfg) {
					cfg.build ??= {};
					cfg.build.rollupOptions ??= {};
					const ext = cfg.build.rollupOptions.external;
					cfg.build.rollupOptions.external = Array.isArray(ext)
						? [...ext, "@resvg/resvg-js"]
						: ["@resvg/resvg-js"];
				},
			},
		],
		optimizeDeps: {
			exclude: ["@resvg/resvg-js"],
			// Pre-bundle Tina's middleware in the first optimize pass so Vite does
			// not discover it late and re-optimize mid-session.
			include: ["@tinacms/astro/middleware"],
		},
		// Dev SSR of the island route needs Tina's bridge bundled.
		ssr: {
			noExternal: ["@tinacms/astro", "@tinacms/bridge"],
		},
		server: {
			cors: true,
		},
	},
```

- [ ] **Step 3: Write `src/components/islands/PostHero.astro`**

Move the post title, description, date, and tags out of `PostDetails.astro` into this component verbatim — same classes, same `animate-reveal*` utilities, same `transition:name` — adding a `data-tina-field` to each editable node:

```astro
---
import { tinaField } from "@tinacms/astro/tina-field";
import dayjs from "dayjs";
import tz from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import IconHash from "@/assets/icons/IconHash.svg";
import { SITE } from "@/config";
import { slugifyStr } from "@/utils/slugify";

dayjs.extend(utc);
dayjs.extend(tz);

/**
 * Editable post hero. Rendered statically inside <TinaIsland name="blogHero">
 * and on demand by /tina-island/blogHero, so these fields live-update in the
 * admin preview. Light-on-image vs dark-on-page styling follows whether the post
 * has a cover, matching the two hero layouts in PostDetails.
 */
interface Props {
	// biome-ignore lint/suspicious/noExplicitAny: raw Tina blog node (metadata-tagged)
	post: any;
}

const { post } = Astro.props;

const title: string = post?.title ?? "";
const description: string = post?.description ?? "";
const tags: string[] = (post?.tags ?? []).filter(Boolean);
const overlay = Boolean(post?.ogImage);

const isModified =
	post?.modDatetime && new Date(post.modDatetime) > new Date(post?.pubDatetime);
const heroDatetime = dayjs(isModified ? post.modDatetime : post?.pubDatetime).tz(
	post?.timezone || SITE.timezone,
);
const heroDate = heroDatetime.format("MMMM D, YYYY");

const titleColor = overlay ? "text-overlay-ink" : "text-foreground";
const descColor = overlay ? "text-overlay-ink/85" : "text-foreground/70";
const timeColor = overlay ? "text-overlay-ink/75" : "text-foreground/60";
const dividerColor = overlay ? "bg-overlay-ink/25" : "bg-border/60";
const tagClass = overlay
	? "border-overlay-ink/20 bg-overlay-ink/10 text-overlay-ink/80 backdrop-blur-sm hover:border-accent/60 hover:bg-accent/20 hover:text-accent"
	: "border-accent/30 bg-accent/5 text-accent hover:border-accent/60 hover:bg-accent/15";
---

<h1
  transition:name={slugifyStr(title.replaceAll(".", "-"))}
  data-tina-field={tinaField(post, "title")}
  class:list={[
    "animate-reveal font-prose text-3xl font-bold italic leading-tight tracking-tight sm:text-4xl md:text-5xl lg:text-6xl max-w-4xl",
    titleColor,
  ]}
>
  {title}
</h1>

<p
  data-tina-field={tinaField(post, "description")}
  class:list={[
    "animate-reveal-delay-1 mt-4 max-w-2xl font-prose text-base leading-relaxed italic sm:text-lg",
    descColor,
  ]}
>
  {description}
</p>

<div class="animate-reveal-delay-2 mt-5 flex flex-wrap items-center gap-3">
  <time
    datetime={heroDatetime.toISOString()}
    data-tina-field={tinaField(post, "pubDatetime")}
    class:list={["text-xs font-bold uppercase tracking-[0.15em]", timeColor]}
  >
    {isModified ? `Updated: ${heroDate}` : heroDate}
  </time>
  {
    tags.length > 0 && (
      <>
        <span class:list={["inline-block w-4 h-px", dividerColor]} />
        <ul data-tina-field={tinaField(post, "tags")} class="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li>
              <a
                href={`/tags/${slugifyStr(tag)}`}
                class:list={[
                  "relative z-10 inline-flex items-center gap-0.5 rounded-full border px-2.5 py-0.5 text-xs no-underline transition-all duration-150",
                  tagClass,
                ]}
              >
                <IconHash class="size-3 opacity-70" />
                {tag}
              </a>
            </li>
          ))}
        </ul>
      </>
    )
  }
</div>
```

- [ ] **Step 4: Write `src/components/islands/BlogBody.astro`**

```astro
---
import { tinaField } from "@tinacms/astro/tina-field";
import RichText from "@/components/RichText.astro";

/**
 * Editable post body. Rendered statically inside <TinaIsland name="blog"> on the
 * post page, and on demand by /tina-island/blog when the bridge refreshes the
 * region. The data-tina-field marker makes the body click-to-edit in the admin.
 */
interface Props {
	// biome-ignore lint/suspicious/noExplicitAny: raw Tina blog node (metadata-tagged)
	post: any;
}

const { post } = Astro.props;

// Folder slug (e.g. `git-and-diffs`) for resolving colocated image refs.
const slug: string =
	post?._sys?.breadcrumbs?.slice(0, -1).join("/") ??
	post?._sys?.relativePath?.replace(/\/index\.mdx?$/i, "") ??
	"";
---

{
	post && (
		<div data-tina-field={tinaField(post, "body")}>
			<RichText content={post.body} slug={slug} />
		</div>
	)
}
```

- [ ] **Step 5: Write `src/lib/islands.ts`**

```ts
/**
 * Island registry — the single source of truth for every editable region the
 * Tina bridge can refresh. Each entry maps a slug under `/tina-island/...` to a
 * fetcher, a component, and a wrapper. The dynamic `[name].ts` route reads this,
 * so adding an editable region only ever means adding one entry here.
 */
import type { IslandRegistry } from "@tinacms/astro/experimental";
import BlogBody from "@/components/islands/BlogBody.astro";
import PostHero from "@/components/islands/PostHero.astro";
import { getBlogRaw } from "@/lib/tina/posts";

// biome-ignore lint/suspicious/noExplicitAny: registry data is loosely typed
const blogPost = (data: any) => ({ post: data.data?.blog });

export const islands: IslandRegistry = {
	// Post body (rich text) — full live in-place preview.
	blog: {
		fetch: (_request, params) => getBlogRaw(params.get("slug") ?? ""),
		component: BlogBody,
		wrapper: { tag: "div" },
		propsFromData: blogPost,
	},
	// Hero metadata (title / description / date / tags) — same document, so it
	// refreshes alongside the body when those fields change.
	blogHero: {
		fetch: (_request, params) => getBlogRaw(params.get("slug") ?? ""),
		component: PostHero,
		wrapper: { tag: "div" },
		propsFromData: blogPost,
	},
};
```

- [ ] **Step 6: Write `src/pages/tina-island/[name].ts`**

```ts
/**
 * One dynamic endpoint handling every island refetch the bridge sends. The URL
 * path (`/tina-island/blog`, `/tina-island/blogHero`, …) selects an entry from
 * the registry in `src/lib/islands.ts`.
 */
import type { APIRoute } from "astro";
import { experimental_createIslandRoute } from "@tinacms/astro/experimental";
import { islands } from "@/lib/islands";

export const prerender = false;
export const ALL: APIRoute = experimental_createIslandRoute(islands);
```

- [ ] **Step 7: Wrap the two regions in `src/layouts/PostDetails.astro`**

Add the imports:

```ts
import TinaIsland from "@tinacms/astro/TinaIsland.astro";
import BlogBody from "@/components/islands/BlogBody.astro";
import PostHero from "@/components/islands/PostHero.astro";
import { islands } from "@/lib/islands";
import { getBlogRaw } from "@/lib/tina/posts";
```

Fetch the metadata-tagged copy in the frontmatter:

```ts
// Raw, metadata-tagged copy of the post for visual editing. The normalised
// PostEntry strips the hidden Tina metadata that tinaField() needs.
const tinaResult = await getBlogRaw(post.slug);
const tinaPost = tinaResult.data?.blog;
```

Replace the inline hero title/description/date/tags markup with:

```astro
<TinaIsland name="blogHero" wrapper={islands.blogHero.wrapper} params={{ slug: post.slug }}>
  <PostHero post={tinaPost} />
</TinaIsland>
```

and replace the `<RichText …>` call added in Task 1.5 with:

```astro
<TinaIsland name="blog" wrapper={islands.blog.wrapper} params={{ slug: post.slug }} primary>
  <BlogBody post={tinaPost} />
</TinaIsland>
```

`primary` goes on the body island only — at most one per page, or the editor opens the multi-document picker instead of the post form.

- [ ] **Step 8: Write `src/middleware.ts`**

```ts
import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";
import { defineMiddleware } from "astro:middleware";

/**
 * Dev-only: serve colocated blog images at their absolute, slug-qualified URL.
 *
 * Posts reference images as `/blog/<slug>/<file>` so the TinaCMS editor can load
 * them (it resolves a stored string as-is, with no post context). The files live
 * in `src/data/blog/<slug>/<file>`, which `astro dev` does not serve.
 *
 * In production those files are copied into `dist/client/blog/<slug>/` by the
 * `copy:blog-media` build step, so this no-ops there — guarded by
 * `import.meta.env.DEV` since the Worker cannot read the source tree anyway.
 */
const IMAGE_MIME: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	webp: "image/webp",
	gif: "image/gif",
	svg: "image/svg+xml",
	avif: "image/avif",
};

const BLOG_IMAGE_RE =
	/^\/blog\/(?<rest>[^.][^?]*\.(?<ext>png|jpe?g|webp|gif|svg|avif))$/i;

export const onRequest = defineMiddleware(async (context, next) => {
	if (import.meta.env.DEV) {
		const match = context.url.pathname.match(BLOG_IMAGE_RE);
		if (match?.groups) {
			const rel = normalize(match.groups.rest).replace(/^(\.\.[/\\])+/, "");
			const file = join(process.cwd(), "src/data/blog", rel);
			try {
				const buf = await readFile(file);
				return new Response(new Uint8Array(buf), {
					headers: {
						"Content-Type":
							IMAGE_MIME[match.groups.ext.toLowerCase()] ??
							"application/octet-stream",
						"Cache-Control": "no-store",
					},
				});
			} catch {
				// Not a colocated image — fall through to normal routing.
			}
		}
	}
	return next();
});
```

- [ ] **Step 9: Rewrite the build scripts in `package.json`**

The Cloudflare adapter emits `dist/client` (static assets) and `dist/server` (the Worker plus a generated `wrangler.json`), so the pagefind path and the deploy target both move.

```json
		"dev": "tinacms dev -c \"astro dev\"",
		"copy:blog-media": "rsync -a --include='*/' --include='*.png' --include='*.PNG' --include='*.jpg' --include='*.jpeg' --include='*.webp' --include='*.gif' --include='*.svg' --include='*.avif' --exclude='*' src/data/blog/ dist/client/blog/",
		"build": "tinacms build --content=local -c \"astro check && astro build && bun run copy:blog-media && pagefind --site dist/client && cp -r dist/client/pagefind public/\"",
		"build:local": "tinacms build --local --skip-cloud-checks -c \"astro check && astro build && bun run copy:blog-media && pagefind --site dist/client && cp -r dist/client/pagefind public/\"",
		"preview": "bun run build:local && npx wrangler dev -c dist/server/wrangler.json",
		"deploy": "npx wrangler deploy -c dist/server/wrangler.json",
		"check:content": "node scripts/check-content.mjs",
```

- [ ] **Step 10: Retire the hand-written `wrangler.jsonc`**

The adapter generates `dist/server/wrangler.json` with the correct assets binding and entrypoint. Carry across the two settings the old file had that the adapter does not infer — `name` and `observability` — by keeping `wrangler.jsonc` as the source the adapter merges from, and updating the assets directory:

```jsonc
{
	"name": "wicksipedia-dot-com",
	"compatibility_date": "2026-01-26",
	"compatibility_flags": ["nodejs_compat"],
	"observability": {
		"enabled": true
	}
}
```

The `assets` block is removed — the adapter writes its own. `nodejs_compat` is required: the Tina bridge and the island route pull in Node built-ins.

- [ ] **Step 11: Build**

```bash
bun run build:local
```

Expected: exits 0, and `dist/server/wrangler.json` plus `dist/client/` both exist.

```bash
test -f dist/server/wrangler.json && test -d dist/client || echo "FAIL: adapter output missing"
```

- [ ] **Step 12: Prove the prerendered routes are unchanged**

```bash
find dist/client -name '*.html' | sed 's|^dist/client||' | sort > /tmp/routes-after.txt
diff .baseline/routes.txt /tmp/routes-after.txt && echo "ROUTES MATCH"
```

Expected: `ROUTES MATCH`.

- [ ] **Step 13: Exercise visual editing end to end**

```bash
bun run dev
```

Then, in a browser:
1. Open `http://localhost:4321/admin` — the Tina admin loads and lists 17 blog posts.
2. Open any post in the editor. The preview iframe shows the real post page, styled.
3. Click the post title in the preview — the editor focuses the Title field.
4. Change the title — the preview heading updates without a full reload.
5. Click a paragraph in the body — the editor focuses the Body field.
6. Type into the body — the preview updates, and a code block in that post still renders with dual-theme Shiki colours.
7. Save. Confirm `src/data/blog/<slug>/index.md` changed on disk: `git diff --stat src/data/blog`.
8. Revert: `git checkout -- src/data/blog`.

If step 6 shows an unstyled or errored code block, the island is hitting the WASM Shiki engine — verify `src/shiki.ts` passes `createJavaScriptRegexEngine()`.

- [ ] **Step 14: Run the three UI checks**

With `bun run dev` still running, on a post page:
1. Mobile (375px) and desktop (1440px) hero layouts match the pre-migration site in both themes.
2. No duplicated title, date, or tag list across breakpoints — the island wrapper `<div>` must not introduce a second copy.
3. `animate-reveal`, `animate-reveal-delay-1`, and `animate-reveal-delay-2` still fire on the hero; the reading-progress bar still tracks scroll.

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "feat: add Cloudflare adapter and Tina visual editing islands"
```

- [ ] **Step 16: PHASE 1 REVIEW GATE — stop and ask Matt to review before starting Phase 2.**

---

## Phase 2 — Site settings singleton

Makes header nav and social links editable without a deploy. Technical site metadata (`SITE.website`, `SITE.desc`, timezone, pagination) stays in `src/config.ts` — it feeds RSS, OG, and sitemap generation, and does not belong in a CMS.

### Task 2.1: Add the settings collection and drive header and footer from it

**Files:**
- Create: `tina/collections/settings.ts`, `content/settings/index.json`, `src/lib/tina/settings.ts`
- Modify: `tina/config.ts`, `src/components/Header.astro`, `src/components/Footer.astro`, `src/components/Socials.astro`, `src/lib/islands.ts`, `src/constants.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks beyond the Tina client.
- Produces:
  - `getSettings(): Promise<QueryResult<SettingsQuery>>`
  - `type CmsSettings = Awaited<ReturnType<typeof getSettings>>["data"]["settings"]`
  - islands `settings` (Header) and `settings-footer` (Footer)

- [ ] **Step 1: Write `tina/collections/settings.ts`**

```ts
import type { Collection } from "tinacms";

// One global document holding the editable chrome: header nav and social links.
// Technical site metadata (canonical URL, description, timezone, pagination)
// stays in src/config.ts — it feeds RSS/OG/sitemap and is not editorial.
export const settingsCollection: Collection = {
	name: "settings",
	label: "Site Settings",
	path: "content/settings",
	format: "json",
	ui: {
		global: true,
		allowedActions: { create: false, delete: false },
	},
	fields: [
		{
			type: "object",
			name: "nav",
			label: "Header Navigation",
			list: true,
			ui: { itemProps: (item) => ({ label: item?.title ?? "Link" }) },
			fields: [
				{ type: "string", name: "title", label: "Label", required: true },
				{ type: "string", name: "href", label: "URL", required: true },
			],
		},
		{
			type: "object",
			name: "socials",
			label: "Social Links",
			list: true,
			ui: { itemProps: (item) => ({ label: item?.name ?? "Social" }) },
			fields: [
				{ type: "string", name: "name", label: "Name", required: true },
				{ type: "string", name: "href", label: "URL", required: true },
				{
					type: "string",
					name: "icon",
					label: "Icon",
					options: ["github", "linkedin", "x", "facebook", "mail"],
					required: true,
				},
			],
		},
	],
};
```

- [ ] **Step 2: Seed `content/settings/index.json` from the current hardcoded values**

Read the nav links out of `src/components/Header.astro` and the socials out of `src/constants.ts` (`SOCIALS`), and write them verbatim so nothing visible changes:

```json
{
	"nav": [
		{ "title": "Posts", "href": "/blog" },
		{ "title": "Tags", "href": "/tags" },
		{ "title": "About", "href": "/about" }
	],
	"socials": [
		{
			"name": "GitHub",
			"href": "https://github.com/wicksipedia",
			"icon": "github"
		},
		{
			"name": "LinkedIn",
			"href": "https://www.linkedin.com/in/matt-wicks/",
			"icon": "linkedin"
		}
	]
}
```

Before writing this, open `src/components/Header.astro` and confirm the actual nav labels and hrefs — the values above must match what the site renders today, not an approximation.

- [ ] **Step 3: Register the collection in `tina/config.ts`**

```ts
import { settingsCollection } from "./collections/settings";
...
		collections: [blogCollection, settingsCollection],
```

- [ ] **Step 4: Write `src/lib/tina/settings.ts`**

```ts
import { requestWithMetadata } from "@tinacms/astro/data";
import client from "../../../tina/__generated__/client";

export const getSettings = () =>
	requestWithMetadata(client.queries.settings({ relativePath: "index.json" }));

export type CmsSettings = Awaited<
	ReturnType<typeof getSettings>
>["data"]["settings"];
export type CmsNavItem = NonNullable<NonNullable<CmsSettings["nav"]>[number]>;
export type CmsSocial = NonNullable<NonNullable<CmsSettings["socials"]>[number]>;
```

- [ ] **Step 5: Regenerate the client**

```bash
bunx tinacms build --local --skip-cloud-checks
```

Expected: `tina/__generated__/types.ts` now exports `SettingsQuery`.

- [ ] **Step 6: Map social icon names to the existing SVG components**

`src/constants.ts` currently exports `SOCIALS` with imported SVG components. Replace the `SOCIALS` array with a name→component map, keeping the same icon imports:

```ts
export const SOCIAL_ICONS: Record<string, (_props: Props) => Element> = {
	github: IconGitHub,
	linkedin: IconLinkedin,
	x: IconBrandX,
	facebook: IconFacebook,
	mail: IconMail,
};
```

Uncomment the `IconMail` import. Leave `SHARE_LINKS` and `GISCUS` untouched — share targets are not editorial content.

- [ ] **Step 7: Drive `src/components/Socials.astro` from props**

```astro
---
import { SOCIAL_ICONS } from "@/constants";
import type { CmsSocial } from "@/lib/tina/settings";
import LinkButton from "./LinkButton.astro";

interface Props {
	socials: CmsSocial[];
}

const { socials } = Astro.props;
---

<div class="flex flex-wrap items-center gap-1">
  {
    socials.map(social => {
      const Icon = SOCIAL_ICONS[social.icon ?? ""];
      return Icon ? (
        <LinkButton
          href={social.href}
          class="p-2 hover:rotate-6 sm:p-1"
          title={`${social.name} profile`}
        >
          <Icon class="inline-block size-6 scale-125 fill-transparent stroke-current stroke-2 opacity-90 group-hover:fill-transparent sm:scale-110" />
          <span class="sr-only">{social.name}</span>
        </LinkButton>
      ) : null;
    })
  }
</div>
```

- [ ] **Step 8: Add `data-tina-field` to Header and Footer**

In `src/components/Header.astro`, accept a `settings` prop, render nav from `settings.nav`, and mark each link:

```astro
{nav.map((item) => (
  <a href={item.href} data-tina-field={tinaField(item, "title")} class="…existing classes…">
    {item.title}
  </a>
))}
```

Keep every existing class string exactly as it is — the uppercase `0.65`-opacity resting state, the orange hover tint, the 2px active underline bar. Do the same for the social row in `src/components/Footer.astro`.

- [ ] **Step 9: Register the two islands in `src/lib/islands.ts`**

```ts
import Footer from "@/components/Footer.astro";
import Header from "@/components/Header.astro";
import { getSettings } from "@/lib/tina/settings";

// biome-ignore lint/suspicious/noExplicitAny: registry data is loosely typed
const settingsProps = (data: any) => ({ settings: data.data?.settings });

export const islands: IslandRegistry = {
	// …blog, blogHero…
	settings: {
		fetch: () => getSettings(),
		component: Header,
		wrapper: { tag: "div" },
		propsFromData: settingsProps,
	},
	"settings-footer": {
		fetch: () => getSettings(),
		component: Footer,
		wrapper: { tag: "div" },
		propsFromData: settingsProps,
	},
};
```

- [ ] **Step 10: Wrap Header and Footer at every call site**

`Header` and `Footer` are used in `src/pages/index.astro`, `src/layouts/{PostDetails,AboutLayout,Main}.astro`, and the listing pages. At each, fetch settings once and wrap:

```astro
---
import TinaIsland from "@tinacms/astro/TinaIsland.astro";
import { islands } from "@/lib/islands";
import { getSettings } from "@/lib/tina/settings";

const settings = (await getSettings()).data?.settings ?? null;
---
<TinaIsland name="settings" wrapper={islands.settings.wrapper}>
  <Header settings={settings} />
</TinaIsland>
```

Do not pass `primary` on these — the post body island already claims it.

- [ ] **Step 11: Type-check and build**

```bash
bunx astro check
bun run build:local
```

Expected: 0 errors, exits 0.

- [ ] **Step 12: Prove the nav renders from the CMS, not from hardcoded markup**

```bash
NAV=$(node -e "console.log(require('./content/settings/index.json').nav[0].title)")
grep -q ">$NAV<" dist/client/index.html && echo "OK: nav from settings" || echo "FAIL: nav label not rendered"
```

Expected: `OK: nav from settings`.

- [ ] **Step 13: Prove that check can fail**

```bash
shasum -a 256 content/settings/index.json > /tmp/settings.sha
node -e "
const fs=require('fs');const p='content/settings/index.json';
const j=JSON.parse(fs.readFileSync(p));j.nav[0].title='ZZTOPMARKER';
fs.writeFileSync(p,JSON.stringify(j,null,'\t')+'\n');
"
bun run build:local >/dev/null 2>&1
grep -q '>ZZTOPMARKER<' dist/client/index.html && echo "GOOD: nav really comes from settings" || echo "FAIL: nav is still hardcoded"
git checkout -- content/settings/index.json
shasum -a 256 -c /tmp/settings.sha
```

Expected: `GOOD: nav really comes from settings`, then `content/settings/index.json: OK`.

- [ ] **Step 14: Run the three UI checks**

`bun run dev`, then confirm on the homepage and a post page, in both themes:
1. Mobile and desktop nav match today's site — the mobile menu still collapses and expands.
2. No duplicate nav or social row appears at any breakpoint (the island `<div>` wrapper is a common cause).
3. The header's bouncing orange dot still animates, and nav hover still tints orange.

Then open `/admin`, edit a nav label under Site Settings, and confirm the preview header updates live.

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "feat: drive header nav and socials from Tina site settings"
```

- [ ] **Step 16: PHASE 2 REVIEW GATE — stop and ask Matt to review before starting Phase 3.**

---

## Phase 3 — Home and About as Tina block pages

The homepage and about page become `page` documents composed of blocks. The blocks are **site-specific**, not the starter's generic Hero/Features/Stats set — the point is to make the existing bespoke sections editable, not to replace the design with a template.

Four block types cover both pages:

| Block | Fields | Renders |
|---|---|---|
| `hero` | `name`, `tagline`, `jobTitle`, `organization`, `organizationUrl`, `avatar` | The homepage identity band |
| `postFeed` | `label`, `limit`, `allPostsLabel`, `allPostsHref` | The featured post + recent grid + "All posts" link |
| `prose` | `body` (rich-text) | Long-form page copy (the About page) |
| `githubStats` | `heading` | The existing `<GitHubStats />` component |

### Task 3.1: Define the page collection and block templates

**Files:**
- Create: `src/components/blocks/{Hero,PostFeed,Prose,GithubStats}.astro`, `src/components/blocks/{hero,post-feed,prose,github-stats}.template.ts`, `src/components/blocks/Blocks.astro`, `tina/collections/page.ts`, `src/lib/tina/pages.ts`, `content/pages/home.mdx`, `content/pages/about.mdx`
- Modify: `tina/config.ts`

**Interfaces:**
- Consumes: `getAllPosts`, `PostEntry` from `src/lib/tina/posts.ts`.
- Produces:
  - `getPage(slug: string): Promise<QueryResult<PageQuery>>`
  - `type CmsPage`, `type PageBlock`, and per-block `Extract<>` aliases (`HeroBlock`, `PostFeedBlock`, `ProseBlock`, `GithubStatsBlock`)
  - `<Blocks data={CmsPage | null} />`

- [ ] **Step 1: Write the four templates**

Colocate each template beside its component so schema and rendering change together. `src/components/blocks/hero.template.ts`:

```ts
import type { Template } from "tinacms";

export const heroBlockSchema: Template = {
	name: "hero",
	label: "Hero",
	fields: [
		{ type: "string", name: "name", label: "Name" },
		{
			type: "string",
			name: "tagline",
			label: "Tagline",
			ui: { component: "textarea" },
		},
		{ type: "string", name: "jobTitle", label: "Job Title" },
		{ type: "string", name: "organization", label: "Organisation" },
		{ type: "string", name: "organizationUrl", label: "Organisation URL" },
		{ type: "image", name: "avatar", label: "Avatar" },
	],
};
```

`src/components/blocks/post-feed.template.ts`:

```ts
import type { Template } from "tinacms";

export const postFeedBlockSchema: Template = {
	name: "postFeed",
	label: "Post Feed",
	fields: [
		{ type: "string", name: "label", label: "Section Label" },
		{
			type: "number",
			name: "limit",
			label: "Posts in grid",
			description: "Excludes the lead post shown above the grid.",
		},
		{ type: "string", name: "allPostsLabel", label: "All-posts Link Label" },
		{ type: "string", name: "allPostsHref", label: "All-posts Link URL" },
	],
};
```

`src/components/blocks/prose.template.ts`:

```ts
import type { Template } from "tinacms";

export const proseBlockSchema: Template = {
	name: "prose",
	label: "Prose",
	fields: [{ type: "rich-text", name: "body", label: "Body" }],
};
```

`src/components/blocks/github-stats.template.ts`:

```ts
import type { Template } from "tinacms";

export const githubStatsBlockSchema: Template = {
	name: "githubStats",
	label: "GitHub Stats",
	fields: [{ type: "string", name: "heading", label: "Heading" }],
};
```

- [ ] **Step 2: Write `tina/collections/page.ts`**

```ts
import type { Collection } from "tinacms";
import { githubStatsBlockSchema } from "../../src/components/blocks/github-stats.template";
import { heroBlockSchema } from "../../src/components/blocks/hero.template";
import { postFeedBlockSchema } from "../../src/components/blocks/post-feed.template";
import { proseBlockSchema } from "../../src/components/blocks/prose.template";

// Two documents only: home and about. Routes are explicit .astro files, so
// creating a third page here would produce content with nowhere to render —
// hence create/delete are disabled.
export const pageCollection: Collection = {
	name: "page",
	label: "Pages",
	path: "content/pages",
	format: "mdx",
	ui: {
		router: ({ document }) =>
			document._sys.filename === "home" ? "/" : `/${document._sys.filename}`,
		allowedActions: { create: false, delete: false },
	},
	fields: [
		{
			type: "string",
			name: "seoTitle",
			label: "Meta Title (SEO)",
			isTitle: true,
			required: true,
			description:
				"Browser tab and search results only — not shown on the page. To change the visible heading, edit the Hero block's Name below.",
		},
		{
			type: "object",
			name: "blocks",
			label: "Page Sections",
			list: true,
			ui: { visualSelector: true },
			templates: [
				heroBlockSchema,
				postFeedBlockSchema,
				proseBlockSchema,
				githubStatsBlockSchema,
			],
		},
	],
};
```

- [ ] **Step 3: Register it in `tina/config.ts`**

```ts
		collections: [blogCollection, pageCollection, settingsCollection],
```

- [ ] **Step 4: Seed `content/pages/home.mdx` from the current homepage**

Copy the literal strings out of `src/pages/index.astro` so the rendered page is unchanged:

```mdx
---
seoTitle: Wicksipedia
blocks:
  - name: Matt Wicks
    tagline: CI/CD, cloud-native, and clean code. Opinions held loosely, pipelines held tightly.
    jobTitle: Solution Architect
    organization: SSW
    organizationUrl: 'https://ssw.com.au/people/matt-wicks/'
    avatar: /uploads/avatar.png
    _template: hero
  - label: Latest
    limit: 4
    allPostsLabel: All posts
    allPostsHref: /blog
    _template: postFeed
---
```

The avatar moves from `src/assets/images/avatar.png` to Tina's media root so the editor can swap it:

```bash
mkdir -p public/uploads
cp src/assets/images/avatar.png public/uploads/avatar.png
```

- [ ] **Step 5: Seed `content/pages/about.mdx` from `src/pages/about.mdx`**

Move the existing prose into a `prose` block's `body` field and the GitHub stats heading into a `githubStats` block. Copy the body text verbatim from `src/pages/about.mdx` — do not rewrite it:

```mdx
---
seoTitle: About
blocks:
  - body: |
      Matt Wicks. Solution Architect at [SSW](https://ssw.com.au/people/matt-wicks/), running the Newcastle office. I write here about CI/CD, DevOps, cloud-native architecture, and clean code, mostly the bits I had to learn the hard way.

      (…remaining paragraphs and the bullet list, copied verbatim…)
    _template: prose
  - heading: GitHub stats
    _template: githubStats
---
```

The bullet list in that page is flat, so it parses cleanly. Verify before moving on:

```bash
node -e "
const {parseMDX}=require('@tinacms/mdx');
const fs=require('fs');
const raw=fs.readFileSync('content/pages/about.mdx','utf8');
const m=raw.match(/body: \|\n([\s\S]*?)\n    _template/);
if(!m) throw new Error('could not extract body');
const body=m[1].replace(/^      /gm,'');
const ast=parseMDX(body,{type:'rich-text',name:'body',parser:{type:'markdown'}},s=>s);
const bad=(ast.children??[]).filter(n=>n.type==='invalid_markdown');
if(bad.length) { console.error('FAIL',bad.map(b=>b.message)); process.exit(1); }
console.log('OK: about body parses cleanly');
"
```

Expected: `OK: about body parses cleanly`.

- [ ] **Step 6: Write `src/lib/tina/pages.ts`**

```ts
import { requestWithMetadata } from "@tinacms/astro/data";
import client from "../../../tina/__generated__/client";

export const getPage = (slug: string) =>
	requestWithMetadata(client.queries.page({ relativePath: `${slug}.mdx` }), {
		priority: "primary",
	});

export type CmsPage = Awaited<ReturnType<typeof getPage>>["data"]["page"];
export type PageBlock = NonNullable<NonNullable<CmsPage["blocks"]>[number]>;

export type HeroBlock = Extract<PageBlock, { __typename: "PageBlocksHero" }>;
export type PostFeedBlock = Extract<
	PageBlock,
	{ __typename: "PageBlocksPostFeed" }
>;
export type ProseBlock = Extract<PageBlock, { __typename: "PageBlocksProse" }>;
export type GithubStatsBlock = Extract<
	PageBlock,
	{ __typename: "PageBlocksGithubStats" }
>;
```

- [ ] **Step 7: Regenerate the client**

```bash
bunx tinacms build --local --skip-cloud-checks
```

Expected: `PageBlocksHero`, `PageBlocksPostFeed`, `PageBlocksProse`, and `PageBlocksGithubStats` appear in `tina/__generated__/types.ts`.

```bash
grep -c 'PageBlocksPostFeed' tina/__generated__/types.ts
```

Expected: a non-zero count.

- [ ] **Step 8: Commit**

```bash
git add tina content/pages public/uploads src/components/blocks src/lib/tina/pages.ts
git commit -m "feat: add Tina page collection with site-specific blocks"
```

---

### Task 3.2: Render the blocks and switch the two routes over

**Files:**
- Create: `src/components/islands/PageBlocks.astro`, `src/pages/about.astro`
- Modify: `src/pages/index.astro`, `src/lib/islands.ts`, `src/components/blocks/*.astro`
- Delete: `src/pages/about.mdx`, `src/layouts/AboutLayout.astro`

**Interfaces:**
- Consumes: `CmsPage`, block type aliases from `src/lib/tina/pages.ts`; `getAllPosts`, `PostEntry` from `src/lib/tina/posts.ts`.
- Produces: island `page`, keyed by a `slug` param.

- [ ] **Step 1: Write the block components by moving existing markup, not rewriting it**

`src/components/blocks/Hero.astro` takes the hero band out of `src/pages/index.astro` lines 42–110 as-is — same `bg-hero-bg`, same responsive avatar sizing, same `text-hero-text` / `text-hero-accent` tokens — with the hardcoded strings replaced by block fields and each marked editable:

```astro
---
import { Image } from "astro:assets";
import { tinaField } from "@tinacms/astro/tina-field";
import Socials from "@/components/Socials.astro";
import type { HeroBlock } from "@/lib/tina/pages";
import type { CmsSocial } from "@/lib/tina/settings";

interface Props {
	data: HeroBlock;
	socials: CmsSocial[];
}

const { data, socials } = Astro.props;
---
<!-- markup moved verbatim from src/pages/index.astro; each text node gains
     data-tina-field={tinaField(data, "<field>")} -->
```

Do the same for `PostFeed.astro` (index.astro lines 112–305), `Prose.astro` (the `app-prose` section from `AboutLayout.astro`, rendering `<RichText content={data.body} slug="" />`), and `GithubStats.astro` (the `## GitHub stats` heading plus `<GitHubStats />`).

`PostFeed.astro` fetches its own posts:

```ts
import { getAllPosts } from "@/lib/tina/posts";
import getSortedPosts from "@/utils/getSortedPosts";

const sorted = getSortedPosts(await getAllPosts());
const featured = sorted.filter(({ data }) => data.featured);
const recent = sorted.filter(({ data }) => !data.featured);
const heroPost = featured[0] ?? recent[0];
const gridPosts = [
	...featured.slice(1),
	...(featured.length > 0 ? recent : recent.slice(1)),
].slice(0, data.limit ?? SITE.postPerIndex);
```

- [ ] **Step 2: Write `src/components/blocks/Blocks.astro`**

```astro
---
import { tinaField } from "@tinacms/astro/tina-field";
import type { CmsPage } from "@/lib/tina/pages";
import type { CmsSocial } from "@/lib/tina/settings";
import GithubStats from "./GithubStats.astro";
import Hero from "./Hero.astro";
import PostFeed from "./PostFeed.astro";
import Prose from "./Prose.astro";

interface Props {
	data?: CmsPage | null;
	socials: CmsSocial[];
}

const { data, socials } = Astro.props;
const blocks = (data?.blocks ?? []).filter((b) => b !== null);
---
{blocks.map((block) => (
	<div data-tina-field={tinaField(block)}>
		{block.__typename === "PageBlocksHero" && <Hero data={block} socials={socials} />}
		{block.__typename === "PageBlocksPostFeed" && <PostFeed data={block} />}
		{block.__typename === "PageBlocksProse" && <Prose data={block} />}
		{block.__typename === "PageBlocksGithubStats" && <GithubStats data={block} />}
	</div>
))}
```

- [ ] **Step 3: Write `src/components/islands/PageBlocks.astro`**

```astro
---
import type { CmsPage } from "@/lib/tina/pages";
import type { CmsSocial } from "@/lib/tina/settings";
import Blocks from "@/components/blocks/Blocks.astro";

interface Props {
	data?: CmsPage | null;
	socials?: CmsSocial[];
}

const { data, socials = [] } = Astro.props;
---
<Blocks data={data} socials={socials} />
```

- [ ] **Step 4: Register the `page` island**

In `src/lib/islands.ts`:

```ts
import PageBlocks from "@/components/islands/PageBlocks.astro";
import { getPage } from "@/lib/tina/pages";
import { getSettings } from "@/lib/tina/settings";
...
	page: {
		fetch: (_request, params) => getPage(params.get("slug") ?? "home"),
		component: PageBlocks,
		wrapper: { tag: "main" },
		// biome-ignore lint/suspicious/noExplicitAny: registry data is loosely typed
		propsFromData: (data: any) => ({ data: data.data?.page }),
	},
```

The island re-render does not have the settings result, so `PageBlocks` defaults `socials` to `[]` — the hero's social row is driven by the `settings` island, which refreshes independently.

- [ ] **Step 5: Rewrite `src/pages/index.astro`**

```astro
---
import TinaIsland from "@tinacms/astro/TinaIsland.astro";
import Footer from "@/components/Footer.astro";
import Header from "@/components/Header.astro";
import PageBlocks from "@/components/islands/PageBlocks.astro";
import Layout from "@/layouts/Layout.astro";
import { islands } from "@/lib/islands";
import { getPage } from "@/lib/tina/pages";
import { getSettings } from "@/lib/tina/settings";

const slug = "home";
const page = (await getPage(slug)).data?.page ?? null;
const settings = (await getSettings()).data?.settings ?? null;
const socials = (settings?.socials ?? []).filter((s) => s !== null);
---

<Layout isHomepage={true}>
  <TinaIsland name="settings" wrapper={islands.settings.wrapper}>
    <Header settings={settings} />
  </TinaIsland>
  <TinaIsland name="page" wrapper={islands.page.wrapper} params={{ slug }} primary>
    <PageBlocks data={page} socials={socials} />
  </TinaIsland>
  <TinaIsland name="settings-footer" wrapper={islands["settings-footer"].wrapper}>
    <Footer settings={settings} />
  </TinaIsland>
</Layout>

<script>
  document.addEventListener("astro:page-load", () => {
    const indexLayout = (document.querySelector("#main-content") as HTMLElement)
      ?.dataset?.layout;
    if (indexLayout) {
      sessionStorage.setItem("backUrl", "/");
    }
  });
</script>
```

The island wrapper is `<main>`, so `PostFeed.astro` must carry the `id="main-content"` and `data-layout="index"` attributes the back-button script reads — move them onto its outer element.

- [ ] **Step 6: Write `src/pages/about.astro` and delete the MDX page**

```astro
---
import TinaIsland from "@tinacms/astro/TinaIsland.astro";
import Breadcrumb from "@/components/Breadcrumb.astro";
import Footer from "@/components/Footer.astro";
import Header from "@/components/Header.astro";
import PageBlocks from "@/components/islands/PageBlocks.astro";
import { SITE } from "@/config";
import Layout from "@/layouts/Layout.astro";
import { islands } from "@/lib/islands";
import { getPage } from "@/lib/tina/pages";
import { getSettings } from "@/lib/tina/settings";

const slug = "about";
const page = (await getPage(slug)).data?.page ?? null;
const settings = (await getSettings()).data?.settings ?? null;
const socials = (settings?.socials ?? []).filter((s) => s !== null);
---

<Layout title={`${page?.seoTitle ?? "About"} | ${SITE.title}`}>
  <TinaIsland name="settings" wrapper={islands.settings.wrapper}>
    <Header settings={settings} />
  </TinaIsland>
  <Breadcrumb />
  <TinaIsland name="page" wrapper={islands.page.wrapper} params={{ slug }} primary>
    <PageBlocks data={page} socials={socials} />
  </TinaIsland>
  <TinaIsland name="settings-footer" wrapper={islands["settings-footer"].wrapper}>
    <Footer settings={settings} />
  </TinaIsland>
</Layout>
```

```bash
git rm src/pages/about.mdx src/layouts/AboutLayout.astro
```

The About page's `<h1>About</h1>` heading and its `border-b border-border/50` rule move into `Prose.astro` so the page keeps its current header treatment.

- [ ] **Step 7: Drop the now-unused MDX toolchain**

No `.mdx` file remains under `src/` — posts are `.md` rendered by Tina, and both pages are `.astro`. The `content/pages/*.mdx` documents are read by Tina, never by Astro.

```bash
bun remove @astrojs/mdx @astrojs/markdown-remark
```

Remove the `mdx()` integration and the whole `markdown:` block from `astro.config.ts` — with no Markdown flowing through Astro, `shikiConfig` there governs nothing. `src/shiki.ts` remains the only highlighting path. Keep the `SHIKI_THEMES` / `SHIKI_TRANSFORMERS` exports; delete the `astro.config.ts` import of them.

- [ ] **Step 8: Type-check and build**

```bash
bunx astro check
bun run build:local
```

Expected: 0 errors, exits 0.

- [ ] **Step 9: Prove both routes still exist and no other route was lost**

```bash
find dist/client -name '*.html' | sed 's|^dist/client||' | sort > /tmp/routes-after.txt
diff .baseline/routes.txt /tmp/routes-after.txt && echo "ROUTES MATCH"
test -f dist/client/index.html && test -f dist/client/about/index.html && echo "OK: home and about built"
```

Expected: `ROUTES MATCH` and `OK: home and about built`.

- [ ] **Step 10: Prove the homepage renders from the CMS**

```bash
grep -q 'Opinions held loosely' dist/client/index.html && echo "OK: hero tagline from CMS" || echo "FAIL"
grep -c 'article' dist/client/index.html
```

Then confirm the check can fail:

```bash
shasum -a 256 content/pages/home.mdx > /tmp/home.sha
sed -i '' 's/Opinions held loosely/ZZTOPMARKER/' content/pages/home.mdx
bun run build:local >/dev/null 2>&1
grep -q 'ZZTOPMARKER' dist/client/index.html && echo "GOOD: hero really comes from the CMS" || echo "FAIL: hero still hardcoded"
git checkout -- content/pages/home.mdx
shasum -a 256 -c /tmp/home.sha
```

Expected: `GOOD: hero really comes from the CMS`, then `content/pages/home.mdx: OK`.

- [ ] **Step 11: Run the three UI checks on both pages**

`bun run dev`, then for `/` and `/about`, in both light and dark themes:
1. Mobile (375px) and desktop (1440px) match the pre-migration layouts — the hero avatar swaps between the round mobile version and the tall desktop crop; the post grid goes one column then two.
2. No section renders twice — the block wrapper `<div>` per block and the `<main>` island wrapper are the two places a duplicate would come from.
3. `animate-reveal` on the hero and `animate-reveal-delay-1/2/3` on the featured, grid, and all-posts sections all fire on load; card hover lift and the orange left border still work.

Then open `/admin`, edit the hero tagline, and confirm the preview updates without a reload.

- [ ] **Step 12: Lint the prose that moved**

```bash
vale content/pages/about.mdx
```

Expected: 0 errors.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: render home and about from Tina page blocks"
```

- [ ] **Step 14: PHASE 3 REVIEW GATE — stop and ask Matt to review before starting Phase 4.**

---

## Phase 4 — Tina Cloud and deployment

### Task 4.1: Wire Tina Cloud and deploy the Worker

**Files:**
- Modify: `.github/workflows/daily-deploy.yml`, `README.md`

**Interfaces:**
- Consumes: `PUBLIC_TINA_CLIENT_ID` and `TINA_TOKEN` from Tina Cloud.
- Produces: a deployed Worker serving static assets plus the `/tina-island/[name]` route, with `/admin` editing against Tina Cloud.

- [ ] **Step 1: Create the Tina Cloud project (Matt, manual)**

At <https://app.tina.io>: create a project pointed at `wicksipedia/wicksipedia.com`, branch `main`. Copy the Client ID and generate a read-only token. This step needs Matt's account — an implementing agent must stop here and ask rather than guess.

- [ ] **Step 2: Store the credentials locally**

```bash
cp .env.example .env
# fill in PUBLIC_TINA_CLIENT_ID and TINA_TOKEN
```

Confirm `.env` is ignored:

```bash
git check-ignore -v .env
```

Expected: a line naming `.gitignore`. If it prints nothing, the credentials would be committed — fix `.gitignore` before continuing.

- [ ] **Step 3: Add the secrets to GitHub Actions (Matt, manual)**

Repository settings → Secrets and variables → Actions: add `PUBLIC_TINA_CLIENT_ID` and `TINA_TOKEN`.

- [ ] **Step 4: Update `.github/workflows/daily-deploy.yml`**

```yaml
      - run: bun run build
        env:
          PUBLIC_TINA_CLIENT_ID: ${{ secrets.PUBLIC_TINA_CLIENT_ID }}
          TINA_TOKEN: ${{ secrets.TINA_TOKEN }}
      - run: bun run deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

`bun run build` now runs `tinacms build --content=local`, which needs the Cloud credentials to validate the schema; `--content=local` still reads content from the checked-out repo, so the build stays hermetic.

Also update the build cache key, which references `src/data/blog/**/*.{png,...}` — those paths are unchanged, so no edit is needed there. Confirm by reading the file.

- [ ] **Step 5: Full production build with credentials**

```bash
bun run build
```

Expected: exits 0, `dist/client/` and `dist/server/wrangler.json` both present, `public/admin/index.html` exists.

- [ ] **Step 6: Preview the Worker locally**

```bash
bun run preview
```

Open the printed URL and check:
1. The homepage, a post, `/tags`, `/archives`, and `/search` all render.
2. Search returns results (pagefind indexed `dist/client`).
3. `/blog/<a-post-with-images>` shows its images.
4. `curl -s localhost:8787/tina-island/blog?slug=terminal-setup | head -c 200` returns HTML, not an error — this is the route that makes visual editing work in production.

- [ ] **Step 7: Deploy**

```bash
bun run deploy
```

Expected: wrangler reports a successful deploy. If it fails on a missing KV namespace, the `session: { driver: sessionDrivers.lruCache() }` line in `astro.config.ts` was dropped — restore it rather than provisioning a namespace the site never uses.

- [ ] **Step 8: Verify production**

```bash
curl -sI https://wicksipedia.com/ | head -1
curl -s https://wicksipedia.com/tina-island/blog?slug=terminal-setup | head -c 200
curl -sI https://wicksipedia.com/admin/index.html | head -1
```

Expected: `200` for the homepage, HTML from the island route, `200` for the admin SPA.

Then open `https://wicksipedia.com/admin`, edit a post, and save — Tina Cloud commits to `main` on GitHub. Confirm the commit appears.

- [ ] **Step 9: Update `README.md`**

Document: `bun run dev` starts Astro plus the Tina local GraphQL server; `/admin` is the editor; `bun run build:local` builds with no credentials; `bun run build` requires `PUBLIC_TINA_CLIENT_ID` and `TINA_TOKEN`; content lives in `src/data/blog/<slug>/index.md`, `content/pages/`, and `content/settings/`; and the two Markdown constructs that break Tina's parser (fenced code inside a list item, nested lists) with `bun run check:content` as the gate.

- [ ] **Step 10: Commit**

```bash
git add .github/workflows/daily-deploy.yml README.md
git commit -m "chore: wire Tina Cloud credentials into CI and document the workflow"
```

- [ ] **Step 11: PHASE 4 REVIEW GATE — stop and ask Matt to review before opening a PR.**

---

## Rollback

Every phase is a set of commits on `feat/tinacms-astro7`; `main` is untouched throughout. To abandon at any point:

```bash
git switch main
git branch -D feat/tinacms-astro7
```

The only change outside the branch is the Cloudflare deploy in Task 4.1. Reverting that means checking out `main`, running the pre-migration `bun run build && bun run deploy`, and deleting the `SESSION` KV binding if one was created.

## Known risks

- **`@tinacms/astro` island rendering on Astro 7 is unproven here.** The package declares `astro: ^5 || ^6 || ^7`, but its island route builds on Astro's `experimental_AstroContainer`, which Astro itself flags unstable. Task 1.6 Step 13 is the point where this surfaces. If the container API broke, the fallback is `output: "server"` with `prerender = true` on content routes — same static output, different plumbing.
- **Sätteri versus `shikiConfig`.** Phase 0 sidesteps this by pinning `processor: unified()`, and Phase 3 removes Astro's Markdown pipeline entirely. If `@astrojs/markdown-remark` turns out to be incompatible with Astro 7's integration surface, pull Phase 3 Step 7's dependency removal forward — nothing between Phase 0 and Phase 3 needs Astro to render Markdown except `src/pages/about.mdx`, which can be converted to `.astro` early.
- **Fence meta through Tina.** `@tinacms/mdx` preserves `meta` on `code_block` nodes, but `@tinacms/astro`'s built-in `code_block` override API does not forward it. The plan works around this by replacing `code_block` nodes with pre-highlighted `html` nodes; if a future `@tinacms/astro` release starts forwarding `meta`, that walk can be simplified to a plain `components.code_block` override.
