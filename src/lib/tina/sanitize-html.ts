import { parseFragment } from "parse5";

/**
 * Allowlist sanitiser for author-written HTML in post bodies.
 *
 * RichText renders `html` / `html_inline` nodes unescaped, because the Markdown
 * pipeline this migration replaced did too and posts rely on it — a `<cite>`
 * attribution and `<kbd>` keys. Unescaped means that whoever can write a post
 * body can write a `<script>`. Today that is only someone with commit access,
 * but Tina Cloud is designed to let an editor publish without a commit or a
 * review, at which point an unfiltered body is stored XSS on every visitor.
 *
 * `iframe`, the `style` attribute and the embed-host allowlist are deliberately
 * absent. They existed for exactly one YouTube embed, and carried with them a
 * CSS value parser, a position allowlist and a URL-host check — the three most
 * delicate things here, to serve one node. That embed is now a rich-text block
 * rendered by src/components/YouTubeEmbed.astro from a validated video id, so a
 * post can no longer express an arbitrary frame or arbitrary CSS at all.
 *
 * Provenance is knowable at the point this is applied: RichText's walk returns
 * `highlight(node)` before recursing, so the `html` nodes Shiki mints never
 * re-enter the walk. Every node reaching this function is author-written.
 *
 * The parser is parse5 — the spec-compliant tokenizer jsdom uses — and NOT
 * ultrahtml. This matters more than the policy does. ultrahtml tokenizes with a
 * regex that requires whitespace before attributes, so `<script/ src=…>` fails
 * to match and falls through as a *text* node; re-emitting text verbatim then
 * handed the browser a live `<script>`. A policy is only as sound as the parse
 * beneath it, so the tree is parsed to spec and every text node is escaped on
 * the way out. Nothing is ever copied through from the source string.
 *
 * ultrahtml's own `sanitize` transformer is unusable here regardless: it throws
 * on an unpaired closing tag such as `</cite>`, rewrites `<cite>` into
 * `<cite></cite>`, and lets `<div onclick="…">` through.
 */

/** Inline tags an author may use. No attributes are permitted on any of them. */
const INLINE_TAGS = new Set([
	"abbr",
	"b",
	"br",
	"cite",
	"code",
	"del",
	"em",
	"i",
	"ins",
	"kbd",
	"mark",
	"q",
	"s",
	"samp",
	"small",
	"span",
	"strong",
	"sub",
	"sup",
	"time",
	"u",
	"var",
	"wbr",
]);

/**
 * Block elements, each with the exact attributes it may keep.
 *
 * A Map, not an object. A plain object inherits from Object.prototype, so a
 * lookup for an element named after an inherited member returns something
 * truthy and defeats the default-deny check: `<constructor>` was let through
 * untouched, and `<constructor id=x>` then threw on `allowed.has`. A Map has no
 * such keys, so the whole class of bug is gone rather than one name patched.
 */
const BLOCK_POLICY = new Map<string, ReadonlySet<string>>(
	Object.entries({
		// No `target`/`rel`: an author-set `rel="opener"` re-enables
		// window.opener for a new tab, and nothing in the corpus needs either.
		a: new Set(["href", "title"]),
		blockquote: new Set(["cite"]),
		br: new Set(),
		caption: new Set(),
		col: new Set(["span"]),
		div: new Set(["class"]),
		figcaption: new Set(),
		figure: new Set(["class"]),
		img: new Set([
			"src",
			"alt",
			"title",
			"width",
			"height",
			"loading",
			"class",
		]),
		li: new Set(),
		ol: new Set(["start"]),
		p: new Set(["class"]),
		picture: new Set(),
		pre: new Set(["class"]),
		span: new Set(["class"]),
		table: new Set(),
		tbody: new Set(),
		td: new Set(["colspan", "rowspan"]),
		tfoot: new Set(),
		th: new Set(["colspan", "rowspan", "scope"]),
		thead: new Set(),
		tr: new Set(),
		ul: new Set(),
	}),
);
for (const tag of INLINE_TAGS) {
	if (!BLOCK_POLICY.has(tag)) BLOCK_POLICY.set(tag, new Set());
}

/**
 * Attributes holding a URL, which get a scheme check rather than a name check.
 * `srcset` is deliberately absent from every policy above: it holds a
 * comma-separated candidate list, so a single-URL check on it would be theatre.
 */
const URL_ATTRIBUTES = new Set(["href", "src", "cite"]);

function isSafeUrl(value: string): boolean {
	const trimmed = value.trim();
	// Protocol-relative borrows the page's scheme and the attacker's host.
	if (trimmed.startsWith("//")) return false;
	// A backslash is never part of a legitimate URL, and the WHATWG parser folds
	// it to `/` for special schemes — so `/\evil.example/x`, which reads as a
	// site-relative path, is fetched from evil.example. Refusing the character
	// outright is the only check that does not have to model that folding.
	if (trimmed.includes("\\")) return false;

	if (trimmed.startsWith("/") || trimmed.startsWith("#")) return true;
	let url: URL;
	try {
		url = new URL(trimmed);
	} catch {
		// Relative to the current page; no scheme to smuggle anything through.
		return !trimmed.includes(":");
	}
	return (
		url.protocol === "https:" ||
		url.protocol === "http:" ||
		url.protocol === "mailto:"
	);
}

const escapeAttribute = (value: string) =>
	value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** Elements that must not be given a closing tag. */
const VOID_ELEMENTS = new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"link",
	"meta",
	"source",
	"track",
	"wbr",
]);

/**
 * Limits on the shape of a single author HTML node.
 *
 * `clean` recurses per child, so deep nesting overflows the stack: 2,165 opening
 * `<div>`s — under 11 KB, and no closing tags needed — was enough. parse5 is
 * also superlinear on depth, taking minutes on a few hundred thousand. Neither
 * is a defect to fix, both are input to refuse: real prose is not 100 elements
 * deep, and the largest legitimate html node in this repo is under half a KB.
 */
const MAX_HTML_BYTES = 64 * 1024;
const MAX_DEPTH = 100;

type Parse5Node = {
	nodeName: string;
	tagName?: string;
	value?: string;
	attrs?: Array<{ name: string; value: string }>;
	childNodes?: Parse5Node[];
};

const escapeText = (value: string) =>
	value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Serialise a parsed tree, keeping only what the policy allows. */
function clean(node: Parse5Node, depth = 0): string {
	if (depth > MAX_DEPTH) return "";
	// Text is escaped, never copied through. parse5 has already decoded entities,
	// so this re-encodes exactly once.
	if (node.nodeName === "#text") return escapeText(node.value ?? "");
	// Comments, doctypes, template contents and anything else are dropped.
	if (!node.tagName) return "";

	const name = node.tagName.toLowerCase();
	const allowed = BLOCK_POLICY.get(name);
	// Default deny, and drop the subtree with it: keeping the children of a
	// <script> or <style> would put their contents on the page as text.
	if (!allowed) return "";

	const attrs: string[] = [];
	for (const { name: rawKey, value: rawValue } of node.attrs ?? []) {
		const key = rawKey.toLowerCase();
		if (!allowed.has(key)) continue;
		if (URL_ATTRIBUTES.has(key) && !isSafeUrl(rawValue)) continue;
		attrs.push(rawValue === "" ? key : `${key}="${escapeAttribute(rawValue)}"`);
	}

	const open = `<${name}${attrs.length ? ` ${attrs.join(" ")}` : ""}>`;
	if (VOID_ELEMENTS.has(name)) return open;
	const inner = (node.childNodes ?? [])
		.map((child) => clean(child, depth + 1))
		.join("");
	return `${open}${inner}</${name}>`;
}

/**
 * `html_inline` nodes are single unpaired tags — `<cite>` and `</cite>` arrive
 * as separate nodes — so they cannot be parsed as a document without the parser
 * inventing or rejecting a partner. They are matched exactly instead, and are
 * allowed no attributes at all, which makes the check total.
 */
export function sanitizeInlineHtml(value: string): string {
	const match = value.trim().match(/^<\/?([a-zA-Z][a-zA-Z0-9-]*)\s*\/?>$/);
	if (!match) return "";
	return INLINE_TAGS.has(match[1].toLowerCase()) ? value : "";
}

/**
 * Sanitise a block of author HTML against the allowlist above.
 *
 * Both the parse and the walk are inside the try. Previously only the parse was,
 * so a throw from `clean` escaped into RichText's walk and killed the Astro
 * build — which a Tina Cloud editor could trigger with no commit access.
 *
 * On failure this rethrows rather than returning "" — with one exception.
 *
 * parse5 recovers from malformed markup instead of throwing; measured across a
 * dozen malformed inputs it threw on none. But that was a measurement of parse5,
 * not of this file, and `clean` recurses: deeply nested input overflowed the
 * stack and was then rethrown as "a sanitiser bug, not bad input", which is both
 * wrong and a build-time denial of service reachable by anyone who can publish a
 * post. Depth is input. So a RangeError fails closed, and the size and depth
 * limits above stop it arising in the first place.
 *
 * Any other throw really is a defect here. Swallowing it would silently delete
 * the post's content and hide the bug, which is how the last hole stayed hidden;
 * a failed build is visible, and the previous build keeps serving. The offending
 * value is named so it can be found.
 */
export function sanitizeBlockHtml(value: string): string {
	// Refused before parsing: parse5's own cost grows superlinearly with depth,
	// so an oversized node is a build-time denial of service whatever this
	// function then does with the tree.
	if (value.length > MAX_HTML_BYTES) return "";
	try {
		const fragment = parseFragment(value) as unknown as Parse5Node;
		return (fragment.childNodes ?? []).map((child) => clean(child, 0)).join("");
	} catch (cause) {
		// A stack overflow is a statement about the input's shape, not a defect
		// here, so it fails closed like any other refused content. Everything
		// else still rethrows — see below.
		if (cause instanceof RangeError) return "";
		const excerpt = value.length > 200 ? `${value.slice(0, 200)}…` : value;
		throw new Error(
			`sanitizeBlockHtml failed on author HTML — this is a sanitiser bug, not bad input, because parse5 does not throw on malformed markup. Offending node: ${JSON.stringify(excerpt)}`,
			{ cause },
		);
	}
}

/** Dispatch on the Tina node type. */
export function sanitizeAuthorHtml(value: string, type: string): string {
	if (typeof value !== "string" || value === "") return "";
	return type === "html_inline"
		? sanitizeInlineHtml(value)
		: sanitizeBlockHtml(value);
}
