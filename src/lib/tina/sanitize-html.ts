import { parseFragment } from "parse5";

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

/** Block elements, each with the exact attributes it may keep. */
const BLOCK_POLICY: Record<string, ReadonlySet<string>> = {
	// No `target`/`rel`: an author-set `rel="opener"` re-enables
	// window.opener for a new tab, and nothing in the corpus needs either.
	a: new Set(["href", "title"]),
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

/**
 * Attributes holding a URL, which get a scheme check rather than a name check.
 * `srcset` is deliberately absent from every policy above: it holds a
 * comma-separated candidate list, so a single-URL check on it would be theatre.
 */
const URL_ATTRIBUTES = new Set(["href", "src", "cite"]);

/** Hosts an <iframe> may embed. An iframe from anywhere else is dropped. */
const EMBED_HOSTS = new Set([
	"www.youtube.com",
	"youtube.com",
	"www.youtube-nocookie.com",
	"youtube-nocookie.com",
	"player.vimeo.com",
]);

function isSafeUrl(value: string, element: string): boolean {
	const trimmed = value.trim();
	// Protocol-relative borrows the page's scheme and the attacker's host.
	if (trimmed.startsWith("//")) return false;

	// An iframe is the one element that executes another origin's code, so it is
	// checked first and absolutely: it must be an https URL on a known embed
	// host. Relative and schemeless forms never reach the host allowlist, so
	// they have to be rejected here rather than after the parse attempt.
	if (element === "iframe") {
		let url: URL;
		try {
			url = new URL(trimmed);
		} catch {
			return false;
		}
		return url.protocol === "https:" && EMBED_HOSTS.has(url.hostname);
	}

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

/**
 * Layout properties an author may set inline. `style` is kept at all only
 * because the responsive-video embed needs it; it is the one attribute whose
 * *value* is a language of its own, so the value is filtered rather than trusted.
 */
const STYLE_PROPERTIES = new Set([
	"aspect-ratio",
	"border",
	"border-radius",
	"bottom",
	"display",
	"height",
	"left",
	"margin",
	"margin-bottom",
	"margin-left",
	"margin-right",
	"margin-top",
	"max-width",
	"min-height",
	"overflow",
	"padding",
	"padding-bottom",
	"padding-left",
	"padding-right",
	"padding-top",
	"position",
	"right",
	"text-align",
	"top",
	"width",
]);

/** `fixed`/`sticky` lift an element out of the article and over the page. */
const SAFE_POSITIONS = new Set(["static", "relative", "absolute"]);

function sanitizeStyle(value: string): string {
	const kept: string[] = [];
	for (const declaration of value.split(";")) {
		const [rawProp, ...rest] = declaration.split(":");
		const prop = rawProp.trim().toLowerCase();
		const val = rest.join(":").trim();
		if (!prop || !val) continue;
		if (!STYLE_PROPERTIES.has(prop)) continue;
		// url() is a request to an arbitrary host — a visitor beacon with no
		// consent gate. The rest cannot appear in a real layout value.
		if (/url\(|expression\(|@import|javascript:|<|\\/i.test(val)) continue;
		if (prop === "position" && !SAFE_POSITIONS.has(val.toLowerCase())) continue;
		kept.push(`${prop}: ${val}`);
	}
	// Trailing semicolon kept so a filtered value is byte-identical to an
	// unfiltered one, which keeps existing posts untouched.
	return kept.length ? `${kept.join("; ")};` : "";
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
function clean(node: Parse5Node): string {
	// Text is escaped, never copied through. parse5 has already decoded entities,
	// so this re-encodes exactly once.
	if (node.nodeName === "#text") return escapeText(node.value ?? "");
	// Comments, doctypes, template contents and anything else are dropped.
	if (!node.tagName) return "";

	const name = node.tagName.toLowerCase();
	const allowed = BLOCK_POLICY[name];
	// Default deny, and drop the subtree with it: keeping the children of a
	// <script> or <style> would put their contents on the page as text.
	if (!allowed) return "";

	const attrs: string[] = [];
	for (const { name: rawKey, value: rawValue } of node.attrs ?? []) {
		const key = rawKey.toLowerCase();
		if (!allowed.has(key)) continue;
		if (URL_ATTRIBUTES.has(key) && !isSafeUrl(rawValue, name)) continue;
		if (key === "style") {
			const style = sanitizeStyle(rawValue);
			if (style) attrs.push(`style="${escapeAttribute(style)}"`);
			continue;
		}
		attrs.push(rawValue === "" ? key : `${key}="${escapeAttribute(rawValue)}"`);
	}

	const open = `<${name}${attrs.length ? ` ${attrs.join(" ")}` : ""}>`;
	if (VOID_ELEMENTS.has(name)) return open;
	const inner = (node.childNodes ?? []).map(clean).join("");
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
 * Sanitise a block of author HTML against the allowlist above. The parser throws
 * on some malformed input (an unpaired closing tag, for one), so failure drops
 * the block rather than taking the build down or, worse, passing it through.
 */
export function sanitizeBlockHtml(value: string): string {
	let fragment: Parse5Node;
	try {
		fragment = parseFragment(value) as unknown as Parse5Node;
	} catch {
		return "";
	}
	return (fragment.childNodes ?? []).map(clean).join("");
}

/** Dispatch on the Tina node type. */
export function sanitizeAuthorHtml(value: string, type: string): string {
	if (typeof value !== "string" || value === "") return "";
	return type === "html_inline"
		? sanitizeInlineHtml(value)
		: sanitizeBlockHtml(value);
}
