/**
 * The real `body` field from the blog collection, for the content checks.
 *
 * These scripts used to declare their own `{ type: "rich-text", name: "body",
 * parser: { type: "markdown" } }`. That is the shape Tina infers, so it was
 * right — until the field grew a `templates` entry, at which point every check
 * was parsing posts differently from the build. A rich-text template with a
 * `match` changes the AST: the embed becomes an `mdxJsxFlowElement` instead of
 * raw html, so a hand-written field would have gone on reporting the old shape
 * and the checks would have been measuring something the site never renders.
 *
 * Importing the collection removes the possibility of that drift entirely.
 */
import { blogCollection } from "../../tina/collections/blog.ts";

const body = blogCollection.fields.find((field) => field.name === "body");
if (!body) {
	throw new Error(
		"blog collection has no `body` field — content checks cannot run",
	);
}

/**
 * Tina infers the parser from the collection's `format`. Deriving it here rather
 * than hardcoding `markdown` means a future `format: "md"` -> `"mdx"` change
 * cannot silently recreate the drift this module exists to prevent: the checks
 * would follow the collection instead of quietly parsing posts a way the build
 * no longer does.
 */
const PARSER_FOR_FORMAT = {
	md: "markdown",
	markdown: "markdown",
	mdx: "mdx",
};

/**
 * Same derivation for any collection. `check-page-prose.mjs` needs it for the
 * `page` collection, which is `format: "mdx"` — and the two parsers genuinely
 * disagree: `<img src=x onerror=alert(1)>` is an `html` node under `markdown`
 * and a whole-body `invalid_markdown` under `mdx`. A check that guessed the
 * parser would be describing a document the build never renders.
 *
 * @param {string | undefined} format
 * @param {string} collectionName
 */
export function parserForFormat(format, collectionName) {
	const parserType = PARSER_FOR_FORMAT[format ?? "md"];
	if (!parserType) {
		throw new Error(
			`${collectionName} collection has format "${format}", which these checks do not know how to parse`,
		);
	}
	return parserType;
}

const parserType = parserForFormat(blogCollection.format, "blog");

export const BODY_FIELD = { ...body, parser: { type: parserType } };
