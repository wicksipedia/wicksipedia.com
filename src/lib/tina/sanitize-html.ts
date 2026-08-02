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

/**
 * The value a URL parser will actually see, per the WHATWG URL spec: leading and
 * trailing C0 controls and spaces removed, all ASCII tab/LF/CR removed anywhere,
 * and `\` folded to `/` as special schemes do.
 *
 * Judging one string and emitting another is how this check kept being wrong.
 * Three rounds found three different characters living in that gap — `\`, then
 * tab/LF/CR, then the rest of the C0 controls, each "fixed" by naming one more
 * literal. `.trim()` strips whitespace; a URL parser strips more than
 * whitespace, so `\u0001//evil.example/x` validated as a path and resolved to
 * evil.example.
 *
 * The fix is not another character. `clean` now emits this normalised value, so
 * the string that was validated is the string the browser gets, and any
 * character the parser ignores is irrelevant by construction.
 */
export function normalizeUrl(value: string): string {
	// The control characters below are the ones a URL parser strips; matching
	// them is the entire point, hence the suppressions.
	return (
		value
			// biome-ignore lint/suspicious/noControlCharactersInRegex: leading C0 strip
			.replace(/^[\u0000-\u0020]+/, "")
			// biome-ignore lint/suspicious/noControlCharactersInRegex: trailing C0 strip
			.replace(/[\u0000-\u0020]+$/, "")
			.replace(/[\t\n\r]/g, "")
			.replace(/\\/g, "/")
	);
}

/** Expects an already-normalised value — see the emit site in `clean`. */
export function isSafeUrl(trimmed: string): boolean {
	// Not a security boundary on its own: the policy already permits an absolute
	// `https://evil.example`, so this stops a cross-origin URL *masquerading* as
	// a same-origin path, not cross-origin URLs as such.
	if (trimmed.startsWith("//")) return false;

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
 * The same check, for a CMS string that reaches an `href` OUTSIDE a rich-text
 * body — the nav in `Header.astro`, the social row, the hero's organisation
 * link, the post feed's "all posts" link. Those never touch `clean`, so until
 * this existed they rendered whatever the settings document said.
 *
 * `@tinacms/astro` exports its own `sanitizeHref` and it is imported ZERO times
 * in this repo, which is just as well: it is round one of the three bypasses
 * documented above. It does `.trim()` and then `startsWith("/") &&
 * !startsWith("//")`, and never folds `\` to `/`. Measured against the shipped
 * `node_modules/@tinacms/astro/dist/sanitize.js`:
 *
 *   "/\evil.example/x"   -> kept verbatim, browser resolves https://evil.example/x
 *   "/\\evil.example"    -> kept verbatim, browser resolves https://evil.example/
 *   "/\/evil.example"    -> kept verbatim, browser resolves https://evil.example/
 *   "\t/\evil.example"   -> kept verbatim, browser resolves https://evil.example/
 *
 * All four are dropped here, because `normalizeUrl` emits the string the URL
 * parser will actually see and `isSafeUrl` judges THAT string. Same reasoning
 * as `clean`: validating one string and emitting another is how every hole in
 * this file got in.
 *
 * `fallback` rather than `""`: an `<a>` with no href is not a link and stops
 * being focusable, which turns a bad CMS value into a silently missing control
 * instead of an inert one.
 */
export function safeHref(
	value: string | null | undefined,
	fallback = "#",
): string {
	if (typeof value !== "string") return fallback;
	const normalized = normalizeUrl(value);
	// `isSafeUrl("")` is true — no scheme to smuggle anything through — but an
	// empty href resolves to the current page, which is not what a blank CMS
	// field means.
	if (normalized === "") return fallback;
	return isSafeUrl(normalized) ? normalized : fallback;
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
 *
 * The length limit counts UTF-16 code units, not bytes — `String.length` — so
 * multibyte prose gets a proportionally larger byte ceiling. That is fine for
 * what this bounds, which is parser work rather than transfer size, and the name
 * says so rather than implying a byte count it does not measure.
 */
const MAX_HTML_LENGTH = 64 * 1024;
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
		// The validated string and the emitted string must be the same string.
		// Every URL bypass in this file has come from them differing.
		let value = rawValue;
		if (URL_ATTRIBUTES.has(key)) {
			value = normalizeUrl(rawValue);
			if (!isSafeUrl(value)) continue;
		}
		attrs.push(value === "" ? key : `${key}="${escapeAttribute(value)}"`);
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
 *
 * The RETURN is re-serialised from the match rather than being the input string.
 * That is the fourth instance of the pattern this file keeps closing: the old
 * version matched `value.trim()` and returned `value`, so the string that was
 * validated was not the string that got emitted. Whitespace was provably the
 * only thing living in that gap today — brute-forced over every non-surrogate
 * code point, `trim()` and `/^\s$/` disagree on nothing — but that is a property
 * of `trim()`, not something this file's own gate ever checked.
 *
 * MEASURED: adding `/m` to the pattern below made
 * `"<cite>\n<img src=x onerror=alert(1)>"` return VERBATIM, because under `/m`
 * the `$` anchors to a line end and the first line matches on its own. That
 * mutant SURVIVED `scripts/check-sanitize.mjs` — every anchor fixture there was
 * single-line — so it was a real hole, not an equivalent mutant. Re-serialising
 * makes the second line unreachable by construction whatever the pattern does,
 * and a multi-line fixture now kills the mutant outright.
 *
 * Two visible consequences, both wanted: `<CITE>` normalises to `<cite>`, and
 * `<br/>` to `<br>`. The corpus check compares before and after exactly, so if
 * a post ever contains either form the build says so rather than silently
 * rewriting published markup.
 */
export function sanitizeInlineHtml(value: string): string {
	const match = value.trim().match(/^(<\/?)([a-zA-Z][a-zA-Z0-9-]*)\s*\/?>$/);
	if (!match) return "";
	const tag = match[2].toLowerCase();
	if (!INLINE_TAGS.has(tag)) return "";
	return match[1] === "</" ? `</${tag}>` : `<${tag}>`;
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
	if (value.length > MAX_HTML_LENGTH) return "";
	try {
		const fragment = parseFragment(value) as unknown as Parse5Node;
		return (fragment.childNodes ?? []).map((child) => clean(child, 0)).join("");
	} catch (cause) {
		// Defence in depth that NO KNOWN INPUT REACHES. The depth cap returns
		// before `clean` can recurse far enough to overflow, and MAX_HTML_LENGTH
		// refuses anything large enough to trouble parse5 — a reviewer failed to
		// throw here across ten nesting shapes at the cap, and the 3,000-div
		// fixture returns at MAX_DEPTH instead. It stays because a stack overflow
		// is a statement about the input's shape rather than a defect here, so if
		// some future shape does reach it, failing closed beats failing the build
		// with a misleading "sanitiser bug" message. It is not covered by a
		// fixture, and this comment exists so it does not look as though it is.
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
