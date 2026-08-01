import { ELEMENT_NODE, parse, TEXT_NODE } from "ultrahtml";

/**
 * Allowlist sanitiser for author-written HTML in post bodies.
 *
 * RichText renders `html` / `html_inline` nodes unescaped, because the Markdown
 * pipeline this migration replaced did too and posts rely on it — a `<cite>`
 * attribution, `<kbd>` keys, a YouTube embed. Unescaped means that whoever can
 * write a post body can write a `<script>`. Today that is only someone with
 * commit access, but Tina Cloud is designed to let an editor publish without a
 * commit or a review, at which point an unfiltered body is stored XSS on every
 * visitor.
 *
 * Provenance is knowable at the point this is applied: RichText's walk returns
 * `highlight(node)` before recursing, so the `html` nodes Shiki mints never
 * re-enter the walk. Every node reaching this function is author-written.
 *
 * ultrahtml's own `sanitize` transformer is deliberately not used: it throws on
 * an unpaired closing tag such as `</cite>`, rewrites `<cite>` into
 * `<cite></cite>` (which would break inline pairing), and in this version lets
 * `<div onclick="…">` through. Only its parser is used here; the policy is
 * explicit and default-deny.
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

/** Block elements, each with the exact attributes it may keep. */
const BLOCK_POLICY: Record<string, ReadonlySet<string>> = {
	a: new Set(["href", "title", "target", "rel"]),
	blockquote: new Set(["cite"]),
	br: new Set(),
	caption: new Set(),
	col: new Set(["span"]),
	div: new Set(["class", "style"]),
	figcaption: new Set(),
	figure: new Set(["class"]),
	iframe: new Set([
		"src",
		"title",
		"width",
		"height",
		"style",
		"loading",
		"allow",
		"allowfullscreen",
		"frameborder",
		"referrerpolicy",
	]),
	img: new Set(["src", "alt", "title", "width", "height", "loading", "class"]),
	li: new Set(),
	ol: new Set(["start"]),
	p: new Set(["class"]),
	picture: new Set(),
	pre: new Set(["class"]),
	source: new Set(["src", "srcset", "type", "media"]),
	span: new Set(["class"]),
	table: new Set(),
	tbody: new Set(),
	td: new Set(["colspan", "rowspan"]),
	tfoot: new Set(),
	th: new Set(["colspan", "rowspan", "scope"]),
	thead: new Set(),
	tr: new Set(),
	ul: new Set(),
};
for (const tag of INLINE_TAGS) BLOCK_POLICY[tag] ??= new Set();

/** Attributes holding a URL, which get a scheme check rather than a name check. */
const URL_ATTRIBUTES = new Set(["href", "src", "srcset", "cite"]);

/** Hosts an <iframe> may embed. An iframe from anywhere else is dropped. */
const EMBED_HOSTS = new Set([
	"www.youtube.com",
	"youtube.com",
	"www.youtube-nocookie.com",
	"youtube-nocookie.com",
	"player.vimeo.com",
	"codepen.io",
]);

function isSafeUrl(value: string, element: string): boolean {
	const trimmed = value.trim();
	if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;
	if (trimmed.startsWith("#")) return true;
	let url: URL;
	try {
		url = new URL(trimmed);
	} catch {
		// Relative to the current page; no scheme to smuggle anything through.
		return !trimmed.includes(":");
	}
	if (element === "iframe") {
		return url.protocol === "https:" && EMBED_HOSTS.has(url.hostname);
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

type UltraNode = {
	type: number;
	name?: string;
	value?: string;
	attributes?: Record<string, string>;
	children?: UltraNode[];
};

/** Serialise a parsed tree, keeping only what the policy allows. */
function clean(node: UltraNode): string {
	if (node.type === TEXT_NODE) return node.value ?? "";
	if (node.type === ELEMENT_NODE) {
		const name = (node.name ?? "").toLowerCase();
		const allowed = BLOCK_POLICY[name];
		// Default deny, and drop the subtree with it: keeping the children of a
		// <script> or <style> would put their contents on the page as text.
		if (!allowed) return "";
		const attrs: string[] = [];
		for (const [rawKey, rawValue] of Object.entries(node.attributes ?? {})) {
			const key = rawKey.toLowerCase();
			if (!allowed.has(key)) continue;
			if (URL_ATTRIBUTES.has(key) && !isSafeUrl(rawValue, name)) continue;
			attrs.push(
				rawValue === "" ? key : `${key}="${escapeAttribute(rawValue)}"`,
			);
		}
		const open = `<${name}${attrs.length ? ` ${attrs.join(" ")}` : ""}>`;
		if (VOID_ELEMENTS.has(name)) return open;
		const inner = (node.children ?? []).map(clean).join("");
		return `${open}${inner}</${name}>`;
	}
	// Comments, doctypes and anything else are dropped.
	return node.children ? node.children.map(clean).join("") : "";
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
 * Sanitise a block of author HTML against the allowlist above. The parser throws
 * on some malformed input (an unpaired closing tag, for one), so failure drops
 * the block rather than taking the build down or, worse, passing it through.
 */
export function sanitizeBlockHtml(value: string): string {
	let doc: UltraNode;
	try {
		doc = parse(value) as UltraNode;
	} catch {
		return "";
	}
	return (doc.children ?? []).map(clean).join("");
}

/** Dispatch on the Tina node type. */
export function sanitizeAuthorHtml(value: string, type: string): string {
	if (typeof value !== "string" || value === "") return "";
	return type === "html_inline"
		? sanitizeInlineHtml(value)
		: sanitizeBlockHtml(value);
}
