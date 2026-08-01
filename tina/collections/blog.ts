import type { Collection } from "tinacms";

// Posts live as `src/data/blog/{slug}/index.md` with colocated images.
// Tina indexes each `index.md`; the URL slug is the parent folder, not the
// literal `index` filename — hence the router and the slugify override below.
export const blogCollection: Collection = {
	name: "blog",
	label: "Blog Posts",
	path: "src/data/blog",
	// Plain CommonMark, not MDX. Every post's hazardous syntax — shell `${...}`
	// braces, `<word word>` placeholders — currently sits inside code fences,
	// which MDX would also survive, so this is a guard against future prose
	// rather than a present-tense necessity. Components still work: a rich-text
	// template with a `match` is parsed and serialised by the markdown parser.
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
			ui: {
				// Editor-side companion to the hard cap in scripts/check-content.mjs.
				// parseMDX is superlinear on some inline runs, so an oversized body
				// hangs the build before anything reaches the sanitiser. This tells
				// an author at the point of writing instead of at deploy; the build
				// gate is the one that actually protects the site, since nothing
				// obliges a commit to have gone through the CMS.
				//
				// The rich-text value is an AST, not a string, so the serialised
				// size is a proxy rather than the body length the build measures.
				// It is deliberately looser than the build cap so it never rejects
				// something the build would accept.
				validate: (value?: unknown) => {
					if (!value) return undefined;
					const size = JSON.stringify(value)?.length ?? 0;
					return size > 256 * 1024
						? "This post is too large to build reliably. Split it into several posts."
						: undefined;
				},
			},
			// A YouTube block, so no post has to hand-write iframe HTML.
			//
			// `match` is load-bearing, not decoration. Without it the markdown
			// parser does not recognise the template at all: it reads the element
			// as raw html on the way in, and — worse — serialises an
			// editor-inserted block to an empty string on the way out, silently
			// deleting whatever the author just filled in. With it, the same
			// parser produces a real mdxJsxFlowElement and writes the shortcode
			// back symmetrically. Verified in both directions.
			//
			// It also RESERVES `{{<` and `>}}` across every post body. An
			// unrelated shortcode in prose — `{{< ref "x" >}}`, which this blog is
			// likely to write about, given the subject matter — still renders, but
			// Tina escapes it to `{{\< ref "x" >}}` when it next writes the file.
			// Inside a code fence or inline code it is untouched, which is where
			// such an example belongs anyway.
			templates: [
				{
					name: "youTubeEmbed",
					label: "YouTube Embed",
					match: { start: "{{<", end: ">}}" },
					fields: [
						{
							type: "string",
							name: "videoId",
							label: "Video ID",
							description:
								"The 11-character id from the video URL, e.g. SJtuU_6mags",
							required: true,
						},
						{
							type: "string",
							name: "title",
							label: "Title",
							description:
								"Describes the video to screen readers, and captions it. Required: two untitled embeds are indistinguishable to anyone not seeing the page.",
							required: true,
						},
					],
				},
			],
		},
	],
};
