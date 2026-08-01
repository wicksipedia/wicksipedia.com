/**
 * Recovering blockquote paragraphs from Tina's rich-text AST.
 *
 * Tina's markdown parser gives a blockquote a flat list of inline children with
 * no paragraph nodes, so `> quote` / `>` / `> (Me)` would render as
 * `<blockquote>quote(Me)</blockquote>` — attribution glued onto the quote, and
 * typography.css's `blockquote p` rules unmatched.
 *
 * The boundary is recoverable structurally, with no guessing. Markdown merges
 * adjacent same-mark inline runs inside one paragraph, so:
 *
 *   `> alpha`  / `> beta`   (soft wrap)  -> ONE text node, "alpha\nbeta"
 *   `> alpha`  / `>` / `> beta`          -> TWO text nodes
 *
 * Two adjacent `text` nodes carrying identical marks therefore occur only where
 * a paragraph ended. Anything else — differing marks, a link, inline HTML, a
 * hard break between them — is ordinary intra-paragraph structure and is left
 * alone. That is a structural fact about the parser, not a heuristic about
 * punctuation, so it cannot split a sentence.
 *
 * KNOWN LIMIT — a paragraph that *starts with an inline HTML element* cannot be
 * detected, because the rule needs two adjacent text nodes and there is only one
 * here. It is not merely undetected by this rule; the information is absent. The
 * parser emits ASTs that differ by a single trailing space, which a genuine
 * one-paragraph quote can have too:
 *
 *   two paragraphs → ["text:'It depends.'",  "html_inline:'<cite>'", …]
 *   one paragraph  → ["text:'It depends. '", "html_inline:'<cite>'", …]
 *
 * So this is fixed in content, not in code — adding any heuristic here is the
 * mistake earlier rounds already made twice. Start the paragraph with text:
 * `github-settings-as-code` wraps its attribution in parentheses, matching the
 * style the other quotes already use, and avoiding the em dash that .vale.ini
 * bans. Pinned in scripts/check-blockquotes.mjs.
 */

export type BlockquoteChild = {
	type?: string;
	text?: string;
	[key: string]: unknown;
};

const INLINE_TYPES = new Set(["text", "a", "html_inline", "break"]);

/** Every mark a `text` leaf can carry; two runs differing in any are distinct. */
const MARKS = [
	"bold",
	"italic",
	"underline",
	"strikethrough",
	"code",
	"highlight",
] as const;

const markKey = (node: BlockquoteChild) =>
	MARKS.map((m) => (node[m] ? "1" : "0")).join("");

/** True only where markdown could not have merged the two runs: a boundary. */
function isParagraphBreak(prev: BlockquoteChild, next: BlockquoteChild) {
	return (
		prev.type === "text" &&
		next.type === "text" &&
		markKey(prev) === markKey(next)
	);
}

/**
 * Regroups a blockquote's flattened inline children into `p` nodes. Children are
 * returned untouched when any of them is block-level, so a blockquote holding a
 * list or a code block is never wrapped in a paragraph.
 */
export function groupBlockquoteParagraphs<T extends BlockquoteChild>(
	children: T[],
): Array<T | { type: "p"; children: T[] }> {
	if (!children.every((c) => INLINE_TYPES.has(c.type ?? ""))) return children;

	const paragraphs: T[][] = [[]];
	children.forEach((child, i) => {
		if (i > 0 && isParagraphBreak(children[i - 1], child)) paragraphs.push([]);
		paragraphs[paragraphs.length - 1].push(child);
	});

	return paragraphs.map((group) => ({ type: "p" as const, children: group }));
}
