import type { Template } from "tinacms";

/**
 * Long-form body copy — the `.app-prose` region an ordinary Markdown page used
 * to fill.
 *
 * The `page` collection is `format: "mdx"`, so this body is parsed by Tina's
 * MDX parser: `{` and `<` are significant, and the authoring constraints that
 * apply to post bodies (no code fences inside list items, no nested lists)
 * apply here too. A body Tina cannot parse becomes a single `invalid_markdown`
 * node and renders as raw text.
 *
 * `overrides.headingLevels` starts at h2 because the `<h1>` belongs to the page,
 * not to a block. `Heading.astro` renders whatever level the AST carries
 * (clamped only to 1-6), and the rich-text editor offers "Heading 1" by default,
 * so two clicks in the admin would give a page two `<h1>`s — the one failure
 * `primaryHeroIndex` is built to prevent, arriving from outside the block list
 * where that helper cannot see it.
 *
 * `overrides.headingLevels` and NOT `toolbarOverride`. The latter is marked
 * `@deprecated use overrides.toolbar` in `@tinacms/schema-tools`, and it is the
 * wrong instrument regardless: its values are toolbar ITEMS (`'heading'`,
 * `'link'`, `'quote'`, …), so the only heading-related thing it can express is
 * removing the heading control altogether. `headingLevels` is documented there
 * as restricting "the headings dropdown, 'Turn into' menu, slash menu, and
 * markdown autoformat shortcuts like `## `" — every route to an h1 in the
 * editor. It is also documented as UI-only: existing content carrying a
 * disallowed level still renders. That is the half `scripts/check-page-prose.mjs`
 * covers, and it is not a hypothetical gap — both committed page documents were
 * seeded by hand, never through the admin.
 */
export const proseBlockSchema: Template = {
	name: "prose",
	label: "Prose",
	fields: [
		{
			type: "rich-text",
			name: "body",
			label: "Body",
			overrides: { headingLevels: ["h2", "h3", "h4", "h5", "h6"] },
		},
	],
};
