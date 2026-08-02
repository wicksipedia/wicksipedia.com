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
			// Every entry is a POST-slugify form. The plan's list carried
			// `rss.xml`, `robots.txt` and `og.png`, none of which can ever match:
			// slugify has already turned `.` into `-` by the time the comparison
			// runs, so those three were three entries that could never fire. The
			// reachable spellings are `rss-xml`, `robots-txt`, `og-png`.
			//
			// `about` is deliberately NOT here — it is one of the CMS pages
			// (`content/pages/about.mdx`), and `src/pages/about.mdx` disappears in
			// Task 3.2. `index` and `tina-island` are here because they are real
			// top-level routes (`src/pages/index.astro`, `src/pages/tina-island/`).
			slugify: (values) => {
				const RESERVED = [
					"blog",
					"tags",
					"archives",
					"search",
					"admin",
					"index",
					"tina-island",
					"404",
					"rss-xml",
					"robots-txt",
					"og-png",
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
