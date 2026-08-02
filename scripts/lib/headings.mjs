/**
 * The `<h1>` rule, in one place, for every content check that needs it.
 *
 * The `<h1>` belongs to the PAGE (or the post), never to a body an editor typed
 * into a rich-text field. A rich-text field with no `overrides.headingLevels`
 * offers "Heading 1" in its block-type dropdown, its "Turn into" menu, its slash
 * menu and its `# ` autoformat shortcut, so authoring a second `<h1>` is one
 * click away; and `overrides.headingLevels` is documented as UI-only, so
 * existing content carrying a disallowed level still renders. Both halves are
 * needed, which is why every consumer here asserts the schema restriction AND
 * walks the committed corpus.
 *
 * Shared rather than copied for the reason `scripts/lib/body-field.mjs` gives
 * for importing the collection instead of re-declaring the field: two
 * definitions of "what counts as an h1" is two things that can drift, and the
 * one that drifts is the one nobody is looking at. `check-page-prose.mjs` covers
 * `content/pages/*` block bodies; `check-content.mjs` covers post bodies.
 *
 * Every function here is pure and every failure is a BROKEN CHECK rather than
 * broken content, so they throw `HeadingRuleError` carrying the full operator
 * message. Callers print `error.message` and exit 1, which keeps the multi-line
 * guidance the scripts had when this logic lived inside them.
 */

import { parseMDX } from "@tinacms/mdx";

/** A check-integrity failure, as opposed to a genuine crash. */
export class HeadingRuleError extends Error {
	name = "HeadingRuleError";
}

/**
 * Heading levels a body may author. `h1` is the document's own heading.
 *
 * Consumers assert their schema's `overrides.headingLevels` against this set
 * rather than trusting it by hand, so restricting the editor further (or
 * loosening it) cannot leave the schema and the corpus scan disagreeing about
 * what is legal.
 */
export const ALLOWED_HEADING_LEVELS = new Set(["h2", "h3", "h4", "h5", "h6"]);

/**
 * The concatenated text of a node's subtree. Tina's rich-text nodes carry no
 * `position`, so the heading's own words are the only way to point an author at
 * the one that is wrong.
 */
export function nodeText(node) {
	if (typeof node?.text === "string") return node.text;
	return (node?.children ?? []).map(nodeText).join("");
}

/** Every heading node in a body, depth-first, in document order. */
export function collectHeadings(node, into = []) {
	if (typeof node?.type === "string" && /^h[1-6]$/.test(node.type)) {
		into.push({ level: node.type, text: nodeText(node).trim() });
	}
	for (const child of node?.children ?? []) collectHeadings(child, into);
	return into;
}

/** Which of a body's headings it must not have authored. */
export const disallowedHeadings = (headings) =>
	headings.filter((heading) => !ALLOWED_HEADING_LEVELS.has(heading.level));

/**
 * Known bodies with known headings, so `collectHeadings` and
 * `disallowedHeadings` are exercised whatever the corpus happens to contain.
 *
 * This is the part that is not optional. Neither committed corpus contains an
 * `h1` — 2 page bodies with 0 headings, 17 post bodies with 126 — so a corpus
 * scan that was deleted outright prints exactly what a working one prints. The
 * fixtures put a known `#` through the same parser and the same predicate, and
 * the guards below refuse to run unless at least one is rejected and at least
 * one accepted.
 *
 * `setext` is here because `Title\n===` is an h1 that contains no `#` — a check
 * that grepped for the character would pass it, and Tina's parser does emit `h1`
 * for it (measured).
 */
export const HEADING_FIXTURES = [
	{ name: "atx h1", body: "# Page title", levels: ["h1"], bad: ["h1"] },
	{
		name: "setext h1",
		body: "Page title\n==========",
		levels: ["h1"],
		bad: ["h1"],
	},
	{
		name: "h1 below a paragraph",
		body: "Intro.\n\n# Page title",
		levels: ["h1"],
		bad: ["h1"],
	},
	{ name: "h2", body: "## Section", levels: ["h2"], bad: [] },
	{
		name: "h3 then h6",
		body: "### Deeper\n\n###### Deepest",
		levels: ["h3", "h6"],
		bad: [],
	},
	{ name: "no headings", body: "Just a paragraph.", levels: [], bad: [] },
];

// A fixture set that rejects nothing proves the predicate cannot go red; one
// that accepts no heading proves only that it rejects everything. Both pass a
// heading-free corpus identically to a working check. Thrown at import time, so
// every consumer inherits the guard rather than remembering to call it.
if (!HEADING_FIXTURES.some((fixture) => fixture.bad.length > 0)) {
	throw new HeadingRuleError(
		"no heading fixture expects a rejection — the h1 predicate cannot go red",
	);
}
if (
	!HEADING_FIXTURES.some(
		(fixture) => fixture.levels.length > 0 && fixture.bad.length === 0,
	)
) {
	throw new HeadingRuleError(
		"no heading fixture expects an accepted heading — the h1 predicate is a stub",
	);
}

/**
 * Puts every fixture through the real parser with the real field, and returns
 * how many ran. `label` names the parser variant in the failure message — a
 * file extension for pages, the collection format for posts — because the two
 * parsers genuinely disagree and a fixture that fails under only one of them
 * has to say which.
 *
 * @param {object} field a rich-text field object carrying its `parser`
 * @param {string} label
 * @returns {number} fixture runs
 */
export function runHeadingFixtures(field, label) {
	let runs = 0;
	for (const fixture of HEADING_FIXTURES) {
		const found = collectHeadings(parseMDX(fixture.body, field, (v) => v));
		const levels = found.map((heading) => heading.level);
		const bad = disallowedHeadings(found).map((heading) => heading.level);
		if (levels.join(",") !== fixture.levels.join(",")) {
			throw new HeadingRuleError(
				`heading fixture "${fixture.name}" (${label}) parsed to [${levels.join(", ")}], expected [${fixture.levels.join(", ")}]`,
			);
		}
		if (bad.join(",") !== fixture.bad.join(",")) {
			throw new HeadingRuleError(
				`heading fixture "${fixture.name}" (${label}) rejected [${bad.join(", ")}], expected [${fixture.bad.join(", ")}]`,
			);
		}
		runs++;
	}
	// Structural, not input-driven: this can only diverge if the loop above is
	// edited. It is here because `for (const x of [])` is the shape that has
	// silently reported success nine times on this branch.
	if (runs !== HEADING_FIXTURES.length) {
		throw new HeadingRuleError(
			`ran ${runs} of ${HEADING_FIXTURES.length} heading fixtures (${label})`,
		);
	}
	return runs;
}

/**
 * Asserts one rich-text field's editor cannot offer a disallowed heading level.
 *
 * `overrides.headingLevels` and NOT `toolbarOverride`. The latter is marked
 * `@deprecated use overrides.toolbar` in `@tinacms/schema-tools`, and it is the
 * wrong instrument regardless: its values are toolbar ITEMS (`'heading'`,
 * `'link'`, `'quote'`, …), so the only heading-related thing it can express is
 * removing the heading control altogether.
 *
 * @param {string} label how to name the field in a failure, e.g. `prose.body`
 * @param {object} field
 */
export function assertRestrictsHeadingLevels(label, field) {
	const levels = field.overrides?.headingLevels ?? [];
	if (levels.length === 0) {
		throw new HeadingRuleError(
			`${label} declares no overrides.headingLevels —\n` +
				"  its editor's heading dropdown still offers Heading 1. See prose.template.ts\n" +
				"  for the shape, and why toolbarOverride is not the instrument.",
		);
	}
	const disagreement = [
		...levels.filter((level) => !ALLOWED_HEADING_LEVELS.has(level)),
		...[...ALLOWED_HEADING_LEVELS].filter((level) => !levels.includes(level)),
	];
	if (disagreement.length > 0) {
		throw new HeadingRuleError(
			`${label} allows [${levels.join(", ")}] but this check enforces [${[...ALLOWED_HEADING_LEVELS].join(", ")}]\n` +
				`  disagreeing on: ${disagreement.join(", ")}`,
		);
	}
}

/**
 * Prints a `HeadingRuleError` the way the content checks print everything else
 * and exits 1. Anything that is not one is a real crash and is rethrown, so a
 * `TypeError` in a helper cannot be laundered into a tidy content failure.
 *
 * @param {unknown} error @param {(m: string) => void} err
 */
export function reportHeadingRuleError(error, err) {
	if (!(error instanceof HeadingRuleError)) throw error;
	err(`FAIL: ${error.message}`);
	process.exit(1);
}
