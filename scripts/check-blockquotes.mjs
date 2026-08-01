/**
 * Pins the blockquote paragraph rule in src/lib/tina/blockquote.ts.
 *
 * The rule is structural, not a guess: markdown merges adjacent same-mark inline
 * runs within a paragraph, so two adjacent `text` nodes with identical marks can
 * only mean a paragraph ended. The fixtures below fix both directions — the
 * joins that must split, and the joins that must not, including the ones an
 * earlier punctuation-based heuristic corrupted.
 *
 * The corpus section compares every real blockquote against a recorded shape.
 * Counting children cannot see a mid-sentence split, so the shapes are exact.
 *
 * Run: bun run check:blockquotes
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseMDX } from "@tinacms/mdx";
import { groupBlockquoteParagraphs } from "../src/lib/tina/blockquote.ts";
import { BODY_FIELD } from "./lib/body-field.mjs";

const BASE = "src/data/blog";

/** @param {string} message */
const out = (message) => process.stdout.write(`${message}\n`);
/** @param {string} message */
const err = (message) => process.stderr.write(`${message}\n`);

const blockquotesIn = (markdown) =>
	(parseMDX(markdown, BODY_FIELD, (s) => s).children ?? []).filter(
		(n) => n.type === "blockquote",
	);

/** Render a grouping as `paragraph || paragraph`, newlines made visible. */
const shape = (groups) =>
	groups
		.map((g) =>
			(g.children ?? [])
				.map((c) => (typeof c.text === "string" ? c.text : (c.value ?? "~")))
				.join(""),
		)
		.join(" || ")
		.replace(/\n/g, "\\n");

const CASES = [
	// --- must split: adjacent same-mark text runs are a paragraph boundary ---
	{
		name: "two plain paragraphs",
		md: "> alpha.\n>\n> beta.",
		want: "alpha. || beta.",
	},
	{
		// The punctuation heuristic this rule replaced missed this entirely.
		name: "two plain paragraphs with no terminal punctuation",
		md: "> alpha\n>\n> beta",
		want: "alpha || beta",
	},
	{
		name: "consecutive italic paragraphs",
		md: "> *Yes, milord?*\n>\n> *Yes?*\n>\n> *What?*",
		want: "Yes, milord? || Yes? || What?",
	},
	{
		name: "quote then attribution",
		md: "> quote line.\n>\n> (Me)",
		want: "quote line. || (Me)",
	},

	// --- must NOT split: every one of these is a single paragraph ---
	{
		// Soft-wrapped lines merge into one node, so there is no join to misread.
		name: "soft-wrapped lines stay one paragraph",
		md: "> alpha\n> beta",
		want: "alpha\\nbeta",
	},
	{
		name: "opening double quote around bold",
		md: '> He said "**no way**" and left.',
		want: 'He said "no way" and left.',
	},
	{
		name: "code span followed by punctuation",
		md: "> Run `foo`, then bar.",
		want: "Run foo, then bar.",
	},
	{
		name: "bold followed by full stop",
		md: "> This is **great**.",
		want: "This is great.",
	},
	{
		name: "colon before inline code",
		md: "> Flag:`--force` is required.",
		want: "Flag:--force is required.",
	},
	{
		name: "italic run between text runs",
		md: "> plain *italic* plain.",
		want: "plain italic plain.",
	},
	{
		name: "strikethrough run between text runs",
		md: "> plain ~~struck~~ plain.",
		want: "plain struck plain.",
	},
	{
		name: "link between text runs",
		md: "> See [docs](https://example.com). It is good.",
		want: "See ~. It is good.",
	},
	{
		name: "hard line break",
		md: "> alpha.  \n> beta",
		want: "alpha.~beta",
	},
	{
		name: "inline html between text runs",
		md: "> alpha.<br>beta.",
		want: "alpha.<br>beta.",
	},
	{
		name: "single paragraph is untouched",
		md: "> Just one line.",
		want: "Just one line.",
	},

	// --- documented limit, pinned so it is noticed if the parser ever changes ---
	{
		name: "KNOWN LIMIT: boundary at an inline-HTML join is unrecoverable",
		md: "> It depends.\n>\n> <cite>Every consultant ever</cite>",
		want: "It depends.<cite>Every consultant ever</cite>",
	},
];

let failed = 0;
let checked = 0;

for (const { name, md, want } of CASES) {
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
		err(`FAIL: ${name}`);
		err(`  expected: ${want}`);
		err(`  actual:   ${got}`);
	}
}

if (checked !== CASES.length) {
	err(`FAIL: ran ${checked} of ${CASES.length} fixtures`);
	process.exit(1);
}

/**
 * Recorded shape of every blockquote in the corpus. All but
 * `github-settings-as-code#0` match the pre-TinaCMS Astro build exactly; that
 * one is the documented inline-HTML limit. Regenerate deliberately.
 */
const CORPUS = [
	[
		"downfalls-of-environment-branching-patterns#0",
		'Them: "Oh, we don\'t use main, at the moment we are currently working on test since we need to add some features there."',
	],
	[
		"downfalls-of-environment-branching-patterns#1",
		"Them: We are working in test at the moment, We'll merge it back afterwards, it works for us.",
	],
	[
		"github-settings-as-code#0",
		"It depends.<cite>Every consultant ever</cite>",
	],
	[
		"peon-ping-setup#0",
		"Yes, milord? || Yes? || What? || Stop poking me! || Why do you keep touching me?!",
	],
	[
		"setting-up-a-new-mac#0",
		"It's a great time to be a developer! There's so much great hardware and software, you're spoilt for choice.",
	],
	["setting-up-a-new-mac#1", "My starting point is always the same: Homebrew."],
	[
		"speeding-up-zsh-startup#0",
		"Two minutes with zprof and a dash of AI would have saved me 20 minutes of wrong guesses. Measure first, tinker second.",
	],
	[
		"the-future-of-software-engineering-is-not-what-you-think#0",
		"Maybe we'll be called builders instead of developers, but the core skills remain the same. || (Me)",
	],
	[
		"the-future-of-software-engineering-is-not-what-you-think#1",
		"In economics, the ~ states that as a tool makes a resource more efficient (and thus cheaper), the demand for that resource actually increases rather than decreases. Spreadsheets made accounting cheaper, so companies hired more accountants to do deeper analysis",
	],
	[
		"the-future-of-software-engineering-is-not-what-you-think#2",
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

for (const [key, want] of CORPUS) {
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
 * EQUIVALENT MUTANTS — not covered because they cannot change behaviour, rather
 * than because no fixture was written:
 *
 *  - Dropping `underline` or `highlight` from MARKS. Markdown has no syntax for
 *    either, so no post can produce a text run carrying them; they are listed
 *    only so content arriving from Tina Cloud's editor is handled.
 *  - Removing the block-level bailout (`INLINE_TYPES`). Tina emits
 *    `invalid_markdown`, not `blockquote`, for a list or fence inside a quote,
 *    so a blockquote with block-level children is unreachable from markdown.
 */
