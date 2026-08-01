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
 * KNOWN LIMIT — a boundary that falls between a `text` node and an inline-HTML
 * node is not recoverable, because the parser emits byte-identical ASTs for
 *
 *   `> It depends.` / `>` / `> <cite>X</cite>`     (two paragraphs)
 *   `> It depends.<cite>X</cite>`                  (one paragraph)
 *
 * Both render as one paragraph. This affects the quote in
 * `github-settings-as-code`, whose `<cite>` attribution now sits on the same
 * line as the quote. Authors who need the break should put the attribution in a
 * separate blockquote. Verified by comparing the two parses directly, so no
 * change to this function can fix it.
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
