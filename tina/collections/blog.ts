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
		// Matches every `index` file under any subdirectory depth, including
		// `_`-prefixed directories — this mirrors the Astro content collection's
		// prior glob (`**/[^_]*.mdx`), whose `[^_]` guards the filename, not the
		// directory, so `_`-prefixed dirs were never excluded there either.
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
