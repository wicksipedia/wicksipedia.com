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

/** Tina infers the parser from the collection's `format`, which is `md`. */
export const BODY_FIELD = { ...body, parser: { type: "markdown" } };
