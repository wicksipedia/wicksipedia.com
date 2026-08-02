import type { Collection } from "tinacms";
import { githubStatsBlockSchema } from "../../src/components/blocks/github-stats.template";
import { heroBlockSchema } from "../../src/components/blocks/hero.template";
import { postFeedBlockSchema } from "../../src/components/blocks/post-feed.template";
import { proseBlockSchema } from "../../src/components/blocks/prose.template";

// Pages are INFERRED from this collection — `src/pages/[...slug].astro` builds
// its routes from `listPages()`, so creating a page in the CMS creates a route
// with no code change. That is the point of the collection; do not add explicit
// per-page `.astro` routes.
//
// `home` is the exception: it renders at `/` via `src/pages/index.astro` and is
// filtered out of the catch-all.
export const pageCollection: Collection = {
	name: "page",
	label: "Pages",
	path: "content/pages",
	format: "mdx",
	ui: {
		router: ({ document }) =>
			document._sys.filename === "home" ? "/" : `/${document._sys.filename}`,
		filename: {
			readonly: false,
			// Reserved slugs collide with real file-based routes. Astro gives static
			// routes priority, so a page named e.g. `blog` would index in Tina, pass
			// every build check, and silently never render. Refuse the name instead.
			//
			// The list is derived from what actually lands at the top level of
			// `dist/client`, filtered by what a slug can even be. A slug is
			// `[a-z0-9-]+` by the time it is compared, so **no route containing a
			// dot is reachable** and none of them belongs here: `rss.xml`,
			// `robots.txt`, `og.png`, `sitemap-index.xml`, `favicon.ico`,
			// `404.html` and friends can never equal a slug. The plan's list
			// carried three of those, and respelling them `rss-xml` / `robots-txt`
			// / `og-png` (as this file briefly did) is just as wrong in the other
			// direction — `/rss-xml` does not collide with `/rss.xml`, so that only
			// blocked innocent titles.
			//
			// What is left is the directories: a page slug equal to one of these
			// writes `dist/client/<slug>/index.html` into a directory that already
			// belongs to something else.
			//
			//   blog tags archives search   real Astro routes
			//   admin                       the TinaCMS SPA in public/admin
			//   pagefind                    the search index
			//
			// `uploads` is the one entry that no longer names a built directory:
			// Tina's media root moved to `src/assets/uploads` in Task 3.3, so the
			// build emits no `/uploads/` at all. Kept anyway — it IS a live URL
			// under `astro dev` (`serveTinaUploadsInDev()` in astro.config.ts), and
			// a page slug that shadowed it would break the admin's media previews
			// for whoever was editing at the time.
			//
			// `about` is deliberately absent: it *is* one of the CMS pages
			// (`content/pages/about.mdx`), and `src/pages/about.mdx` goes away in
			// Task 3.2.
			//
			// `index`, `404` and `tina-island` cannot collide as files — `index.html`
			// and `404.html` are files, not directories, and `tina-island` is a
			// server route that emits nothing static — but all three would produce a
			// URL that reads like the real one. Kept as defence, not as a fix.
			slugify: (values) => {
				const RESERVED = [
					"blog",
					"tags",
					"archives",
					"search",
					"admin",
					"pagefind",
					"uploads",
					"index",
					"tina-island",
					"404",
				];
				const slug = (values?.seoTitle ?? "")
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, "-")
					.replace(/^-+|-+$/g, "");
				// A title made entirely of punctuation, emoji or non-Latin script
				// slugifies to "" — which RESERVED does not catch, and which
				// `ui.router` above would render as `/`, shadowing the homepage. An
				// empty filename is never what the author meant, so name it instead.
				// Two such titles both land on `untitled`, and Tina refuses the
				// duplicate filename, which is the loud outcome we want.
				if (!slug) return "untitled";
				return RESERVED.includes(slug) ? `${slug}-page` : slug;
			},
		},
	},
	fields: [
		{
			type: "string",
			name: "seoTitle",
			label: "Meta Title (SEO)",
			isTitle: true,
			required: true,
			description:
				"Browser tab and search results only — not shown on the page. To change the visible heading, use Page Heading below, or the Hero block's Name.",
		},
		{
			type: "string",
			name: "heading",
			label: "Page Heading",
			// The rendering decides this, not the author — see the heading block in
			// `src/components/islands/PageBlocks.astro`. A page opening with a Hero
			// never renders a page-level <h1> (the Hero supplies one), and a page
			// without one falls back to Meta Title, which is required. Neither the
			// two-<h1> nor the zero-<h1> outcome is reachable from this field, so
			// the description describes behaviour rather than asking for care.
			description:
				"Overrides Meta Title as the visible <h1> at the top of the page. Leave blank to use Meta Title. Ignored entirely when the page starts with a Hero block, which supplies its own heading.",
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
