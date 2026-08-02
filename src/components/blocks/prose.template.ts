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
 */
export const proseBlockSchema: Template = {
	name: "prose",
	label: "Prose",
	fields: [{ type: "rich-text", name: "body", label: "Body" }],
};
