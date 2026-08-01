/**
 * Recovering blockquote paragraphs from Tina's rich-text AST.
 *
 * Tina's markdown parser flattens a blockquote's paragraphs into a flat list of
 * inline nodes. `> quote` / `>` / `> (Me)` arrives as two adjacent `text` nodes
 * with the paragraph boundary gone, so the default renderer emits
 * `<blockquote>quote(Me)</blockquote>` — attribution glued onto the quote, and
 * typography.css's `blockquote p` rules never match.
 *
 * The boundary is not recorded anywhere in the AST, so this reconstructs it.
 * That makes it a heuristic, and the rule is deliberately biased towards
 * *under*-splitting: merging two short paragraphs is a cosmetic loss, whereas
 * splitting mid-sentence corrupts the prose. A break is only inserted where all
 * four hold:
 *
 *  1. no whitespace adjoins the join — markdown keeps the space that separated
 *     inline runs inside one paragraph and drops it at a paragraph break;
 *  2. the preceding node's own text ends in sentence-terminating punctuation.
 *     Without this, `> Run \`foo\`, then bar.` splits after the code span, and
 *     `> This is **great**.` strands the full stop in its own paragraph;
 *  3. the join is not inside an open `html_inline` tag pair, which would put
 *     `<cite>` in a different paragraph from its closing tag;
 *  4. the following node is not intra-paragraph markup such as `<br>`.
 *
 * KNOWN LIMITS, all of which under-split (paragraphs merge; prose is never
 * broken mid-sentence). Authors who need a guaranteed break should use separate
 * blockquotes.
 *
 *  - A paragraph ending without terminal punctuation is not recovered:
 *    `> alpha` / `>` / `> beta` renders as one paragraph.
 *  - A paragraph ending in a closing inline tag is not recovered, because the
 *    node's own text is `</cite>` rather than the sentence before it.
 *  - Inline HTML left unclosed in a blockquote pins the tag depth above zero and
 *    suppresses every later break in that quote.
 *
 * `scripts/check-blockquotes.mjs` pins all of this, and each guard below is
 * mutation-tested there.
 */

export type BlockquoteChild = {
	type?: string;
	text?: string;
	value?: string;
	[key: string]: unknown;
};

const INLINE_TYPES = new Set(["text", "a", "html_inline", "break"]);

/** Elements that never have a closing tag, so must not open a pair. */
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
	"param",
	"source",
	"track",
	"wbr",
]);

/**
 * A real sentence terminator, optionally followed by ONE closing delimiter so
 * `"Some quote."` and `(see below.)` still end a paragraph.
 *
 * Only `.?!` and their CJK equivalents qualify. An earlier version also accepted
 * `: ; ) ] " ' …`, which split ordinary prose mid-sentence wherever one of those
 * abutted an inline node — `> He said "**no way**" and left.` became two
 * paragraphs. Opening delimiters and clause separators are not terminators.
 */
const TERMINAL_PUNCTUATION = /[.?!。！？]["'’”)\]]?$/;

const textOf = (node: BlockquoteChild): string =>
	typeof node.text === "string" ? node.text : (node.value ?? "");

/** +1 for an opening tag, -1 for a closing one, 0 for void/self-closing. */
function tagDelta(raw: string): number {
	const match = raw.trim().match(/^<\s*(\/?)\s*([a-zA-Z][\w-]*)([^>]*)>$/);
	if (!match) return 0;
	const [, closing, name, rest] = match;
	if (closing) return -1;
	if (rest.trimEnd().endsWith("/")) return 0;
	return VOID_ELEMENTS.has(name.toLowerCase()) ? 0 : 1;
}

/**
 * A hard line break, or inline HTML that opens no tag pair (`<br>`, `<img …/>`),
 * is markup *within* a paragraph. A paragraph can never start with one, so a
 * break must never be inserted immediately before it — otherwise
 * `> alpha.<br>beta.` splits at the `<br>`.
 */
function isIntraParagraph(node: BlockquoteChild): boolean {
	if (node.type === "break") return true;
	return node.type === "html_inline" && tagDelta(textOf(node)) === 0;
}

/**
 * Regroups a blockquote's flattened inline children into `p` nodes. Returns the
 * children untouched when any of them is already a block-level node, so a
 * blockquote containing a list or a code block is never wrapped in a paragraph.
 */
export function groupBlockquoteParagraphs<T extends BlockquoteChild>(
	children: T[],
): Array<T | { type: "p"; children: T[] }> {
	if (!children.every((c) => INLINE_TYPES.has(c.type ?? ""))) return children;

	const paragraphs: T[][] = [[]];
	let openTags = 0;

	children.forEach((child, i) => {
		if (i > 0 && openTags === 0 && !isIntraParagraph(child)) {
			const prev = textOf(children[i - 1]);
			// Only the *leading* whitespace of the next run is checked:
			// TERMINAL_PUNCTUATION is anchored to the end of `prev`, so text that
			// trails a space already fails it and needs no separate guard.
			const continues = /^\s/.test(textOf(child));
			if (!continues && TERMINAL_PUNCTUATION.test(prev)) paragraphs.push([]);
		}
		paragraphs[paragraphs.length - 1].push(child);
		if (child.type === "html_inline") {
			openTags = Math.max(0, openTags + tagDelta(textOf(child)));
		}
	});

	return paragraphs.map((group) => ({ type: "p" as const, children: group }));
}
