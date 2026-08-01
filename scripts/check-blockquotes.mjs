/**
 * Pins the blockquote paragraph-recovery heuristic in src/lib/tina/blockquote.ts.
 *
 * Tina's parser discards blockquote paragraph boundaries, so that function
 * reconstructs them from punctuation, whitespace and inline-tag depth. Every
 * guard it applies exists because removing it corrupts real prose, so every
 * guard has at least one fixture here that fails without it — see the `kills`
 * note on each case. Two mutants are equivalent rather than untested and are
 * called out at the bottom.
 *
 * The corpus section compares all real blockquotes against recorded shapes.
 * Child-count checks alone cannot see a mid-sentence split, which is the failure
 * that actually matters, so the shapes are exact.
 *
 * Run: bun run check:blockquotes
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseMDX } from "@tinacms/mdx";
import { groupBlockquoteParagraphs } from "../src/lib/tina/blockquote.ts";

const BASE = "src/data/blog";
const FIELD = { type: "rich-text", name: "body", parser: { type: "markdown" } };

/** @param {string} message */
const out = (message) => process.stdout.write(`${message}\n`);
/** @param {string} message */
const err = (message) => process.stderr.write(`${message}\n`);

const blockquotesIn = (markdown) =>
	(parseMDX(markdown, FIELD, (s) => s).children ?? []).filter(
		(n) => n.type === "blockquote",
	);

/** Render a grouping as `paragraph || paragraph` of plain text. */
const shape = (groups) =>
	groups
		.map((g) =>
			(g.children ?? [])
				.map((c) => (typeof c.text === "string" ? c.text : (c.value ?? "~")))
				.join(""),
		)
		.join(" || ");

/**
 * `kills` names the guard the case exists to protect. Deleting that guard must
 * turn this case red — verified by mutation, not by assumption.
 */
const CASES = [
	// --- must NOT split: these are one sentence, and splitting corrupts prose ---
	{
		name: "opening double quote before inline node",
		md: '> He said "**no way**" and left.',
		want: 'He said "no way" and left.',
		kills: "TERMINAL_PUNCTUATION excludes quotes",
	},
	{
		name: "colon before inline code",
		md: "> Flag:`--force` is required.",
		want: "Flag:--force is required.",
		kills: "TERMINAL_PUNCTUATION excludes colon",
	},
	{
		name: "semicolon before inline code",
		md: "> One;`two` three.",
		want: "One;two three.",
		kills: "TERMINAL_PUNCTUATION excludes semicolon",
	},
	{
		name: "ellipsis before bold",
		md: "> He paused…**then** left.",
		want: "He paused…then left.",
		kills: "TERMINAL_PUNCTUATION excludes ellipsis",
	},
	{
		name: "code span followed by punctuation",
		md: "> Run `foo`, then bar.",
		want: "Run foo, then bar.",
		kills: "TERMINAL_PUNCTUATION requires a real terminator",
	},
	{
		name: "link followed by punctuation",
		md: "> See [docs](https://example.com). It is good.",
		want: "See ~. It is good.",
		kills: "TERMINAL_PUNCTUATION requires a real terminator",
	},
	{
		name: "bold followed by full stop",
		md: "> This is **great**.",
		want: "This is great.",
		kills: "TERMINAL_PUNCTUATION requires a real terminator",
	},
	{
		name: "sentence end followed by a space keeps flowing",
		md: "> **Bold.** more text",
		want: "Bold. more text",
		kills: "leading-whitespace half of the whitespace guard",
	},
	{
		name: "hard line break is not a paragraph boundary",
		md: "> alpha.  \n> beta",
		want: "alpha.~beta",
		kills: "isIntraParagraph break branch",
	},
	{
		name: "void <br> neither opens a tag pair nor starts a paragraph",
		md: "> alpha.<br>beta.\n>\n> gamma",
		want: "alpha.<br>beta. || gamma",
		kills: "VOID_ELEMENTS / isIntraParagraph html branch",
	},
	{
		name: "nested tag pair is never split apart",
		md: "> <cite>A.<b>B</b></cite>",
		want: "<cite>A.<b>B</b></cite>",
		kills: "openTags === 0 guard",
	},
	{
		name: "self-closing void tag does not open a pair",
		md: '> a<img src="x.png"/>b.\n>\n> next.',
		want: 'a<img src="x.png"/>b. || next.',
		kills: "VOID_ELEMENTS branch of tagDelta",
	},
	{
		// Deliberately NOT <img/>: img is in VOID_ELEMENTS too, so that case
		// passes even with the self-closing branch removed. Only a self-closing
		// tag of a non-void element isolates this guard.
		name: "self-closing non-void tag does not open a pair",
		md: "> a<span/>b.\n>\n> next.",
		want: "a<span/>b. || next.",
		kills: "self-closing branch of tagDelta",
	},
	{
		name: "stray closing tag does not wedge the depth negative",
		md: "> a.</em>b.\n>\n> next.",
		want: "a. || </em>b. || next.",
		kills: "Math.max clamp on openTags",
	},

	// --- must split: a real paragraph boundary was lost and has to come back ---
	{
		name: "genuine two-paragraph quote",
		md: "> quote line.\n>\n> (Me)",
		want: "quote line. || (Me)",
		kills: "the split rule itself",
	},
	{
		name: "terminator followed by a closing quote still ends a paragraph",
		md: '> "Some quote."\n>\n> (Me)',
		want: '"Some quote." || (Me)',
		kills: "optional closing-delimiter in TERMINAL_PUNCTUATION",
	},
	{
		name: "consecutive italic paragraphs",
		md: "> *Yes, milord?*\n>\n> *Yes?*\n>\n> *What?*",
		want: "Yes, milord? || Yes? || What?",
		kills: "the split rule itself",
	},
	{
		name: "inline html pair starts its own paragraph",
		md: "> It depends.\n>\n> <cite>Every consultant ever</cite>",
		want: "It depends. || <cite>Every consultant ever</cite>",
		kills: "the split rule itself",
	},
	{
		name: "single paragraph is untouched",
		md: "> Just one line.",
		want: "Just one line.",
		kills: "grouping never invents a boundary",
	},
];

let failed = 0;
let checked = 0;

for (const { name, md, want, kills } of CASES) {
	const [quote] = blockquotesIn(md);
	if (!quote) {
		err(`FAIL: ${name} — fixture did not parse to a blockquote`);
		failed++;
		continue;
	}
	checked++;
	const got = shape(groupBlockquoteParagraphs(quote.children ?? []));
	if (got !== want) {
		failed++;
		err(`FAIL: ${name}  [guards: ${kills}]`);
		err(`  expected: ${want}`);
		err(`  actual:   ${got}`);
	}
}

if (checked !== CASES.length) {
	err(`FAIL: ran ${checked} of ${CASES.length} fixtures`);
	process.exit(1);
}

/**
 * Recorded shapes of every blockquote in the corpus. These match the output of
 * the pre-TinaCMS Astro Markdown build, so a regression here is a regression on
 * the published site. Regenerate deliberately, never reflexively.
 */
const CORPUS = [
	[
		"downfalls-of-environment-branching-patterns",
		0,
		'Them: "Oh, we don\'t use main, at the moment we are currently working on test since we need to add some features there."',
	],
	[
		"downfalls-of-environment-branching-patterns",
		1,
		"Them: We are working in test at the moment, We'll merge it back afterwards, it works for us.",
	],
	[
		"github-settings-as-code",
		0,
		"It depends. || <cite>Every consultant ever</cite>",
	],
	[
		"peon-ping-setup",
		0,
		"Yes, milord? || Yes? || What? || Stop poking me! || Why do you keep touching me?!",
	],
	[
		"setting-up-a-new-mac",
		0,
		"It's a great time to be a developer! There's so much great hardware and software, you're spoilt for choice.",
	],
	[
		"setting-up-a-new-mac",
		1,
		"My starting point is always the same: Homebrew.",
	],
	[
		"speeding-up-zsh-startup",
		0,
		"Two minutes with zprof and a dash of AI would have saved me 20 minutes of wrong guesses. Measure first, tinker second.",
	],
	[
		"the-future-of-software-engineering-is-not-what-you-think",
		0,
		"Maybe we'll be called builders instead of developers, but the core skills remain the same. || (Me)",
	],
	[
		"the-future-of-software-engineering-is-not-what-you-think",
		1,
		"In economics, the ~ states that as a tool makes a resource more efficient (and thus cheaper), the demand for that resource actually increases rather than decreases. Spreadsheets made accounting cheaper, so companies hired more accountants to do deeper analysis",
	],
	[
		"the-future-of-software-engineering-is-not-what-you-think",
		2,
		"You are absolutely right... || (GPT-4, Jan 2024)",
	],
];

const seen = new Map();
for (const dir of readdirSync(BASE).sort()) {
	if (!statSync(join(BASE, dir)).isDirectory() || dir.startsWith("_")) continue;
	let raw;
	try {
		raw = readFileSync(join(BASE, dir, "index.md"), "utf8");
	} catch {
		continue;
	}
	const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
	blockquotesIn(body).forEach((quote, i) => {
		seen.set(
			`${dir}#${i}`,
			shape(groupBlockquoteParagraphs(quote.children ?? [])),
		);
	});
}

// A loop over an empty set passes identically to success. Refuse to pass here.
if (seen.size === 0) {
	err(
		`FAIL: no blockquotes found under ${BASE} — the corpus check ran over nothing`,
	);
	process.exit(1);
}
if (seen.size !== CORPUS.length) {
	err(
		`FAIL: corpus has ${seen.size} blockquotes, ${CORPUS.length} are recorded`,
	);
	err(
		"  A new or deleted blockquote must be reviewed and recorded, not ignored.",
	);
	process.exit(1);
}

for (const [dir, index, want] of CORPUS) {
	const key = `${dir}#${index}`;
	const got = seen.get(key);
	if (got !== want) {
		failed++;
		err(`FAIL: corpus ${key}`);
		err(`  expected: ${want}`);
		err(`  actual:   ${got ?? "(missing)"}`);
	}
}

if (failed > 0) {
	err(`\n${failed} blockquote check(s) failed`);
	process.exit(1);
}

out(
	`OK: ${checked} fixtures and ${seen.size} corpus blockquotes group correctly`,
);

/**
 * EQUIVALENT MUTANTS — deliberately not covered, because they cannot change
 * behaviour rather than because no fixture was written:
 *
 *  - Removing the trailing-whitespace half of the old whitespace guard
 *    (`/\s$/.test(prev)`). TERMINAL_PUNCTUATION is anchored to the end of the
 *    string, so text ending in whitespace already fails it. That half was
 *    deleted from the source for exactly this reason.
 *  - Removing the block-level bailout (`INLINE_TYPES`). Tina emits
 *    `invalid_markdown`, not `blockquote`, for a list or a fence inside a quote,
 *    so a blockquote with block-level children is unreachable through the
 *    markdown parser. The bailout stays as a guard against AST shapes arriving
 *    from Tina Cloud, but no markdown fixture can exercise it.
 */
