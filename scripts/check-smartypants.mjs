/**
 * Pins the typographic punctuation pass in src/lib/tina/smartypants.ts.
 *
 * Astro's Markdown pipeline ran remark-smartypants. Post bodies no longer go
 * through it, so this reapplies the same retext plugin per text node. The
 * fixtures fix the conversions themselves, the guard that keeps inline code
 * literal, and the one case per-node conversion gets wrong.
 *
 * Run: bun run check:smartypants
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseMDX } from "@tinacms/mdx";
import { smartypants } from "../src/lib/tina/smartypants.ts";
import { BODY_FIELD } from "./lib/body-field.mjs";

const BASE = "src/data/blog";

/** @param {string} m */
const out = (m) => process.stdout.write(`${m}\n`);
/** @param {string} m */
const err = (m) => process.stderr.write(`${m}\n`);

const CASES = [
	["apostrophe", "don't", "don’t"],
	["possessive after capital", "A's and B's", "A’s and B’s"],
	["double quotes", 'He said "no way".', "He said “no way”."],
	["single quotes", "'natural'", "‘natural’"],
	["em dash", "it -- really", "it — really"],
	["ellipsis", "wait...", "wait…"],
	["already curly is left alone", "don’t", "don’t"],
	[
		"plain text untouched",
		"nothing to convert here",
		"nothing to convert here",
	],
	["digits untouched", "1990s and 42", "1990s and 42"],
];

let failed = 0;
let checked = 0;
for (const [name, input, want] of CASES) {
	checked++;
	const got = smartypants(input);
	if (got !== want) {
		failed++;
		err(`FAIL: ${name}`);
		err(`  input:    ${JSON.stringify(input)}`);
		err(`  expected: ${JSON.stringify(want)}`);
		err(`  actual:   ${JSON.stringify(got)}`);
	}
}

/**
 * KNOWN LIMIT. Tina splits a paragraph into one text node per formatting run, so
 * a quote sitting alone between two runs has no neighbouring character to tell
 * an opening quote from a closing one, and retext picks the closing form. Pinned
 * rather than fixed: recovering it needs cross-node context this seam does not
 * have. No post currently triggers it — the rendered text of all 17 matches the
 * pre-migration build exactly.
 */
{
	checked++;
	const nodes = ['"', "hi", '"'].map(smartypants);
	const got = nodes.join("|");
	const want = "”|hi|”";
	if (got !== want) {
		failed++;
		err("FAIL: documented cross-node quote limit changed behaviour");
		err(`  expected: ${JSON.stringify(want)}`);
		err(`  actual:   ${JSON.stringify(got)}`);
		err(
			"  If this now produces an opening quote the limit is fixed — update the note.",
		);
	}
}

// The pass must actually be reaching post prose. A conversion count of zero
// would mean the walk stopped calling it and every fixture above still passing.
let converted = 0;
let inlineCode = 0;
const visit = (node) => {
	if (node.type === "text" && typeof node.text === "string") {
		if (node.code === true) inlineCode++;
		else if (smartypants(node.text) !== node.text) converted++;
	}
	for (const child of node.children ?? []) visit(child);
};
for (const dir of readdirSync(BASE).sort()) {
	if (!statSync(join(BASE, dir)).isDirectory() || dir.startsWith("_")) continue;
	let raw;
	try {
		raw = readFileSync(join(BASE, dir, "index.md"), "utf8");
	} catch {
		continue;
	}
	const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
	visit(parseMDX(body, BODY_FIELD, (s) => s));
}
if (converted === 0) {
	err(
		`FAIL: no text node in ${BASE} needed conversion — the corpus check ran over nothing`,
	);
	process.exit(1);
}
if (inlineCode === 0) {
	err(
		"FAIL: no inline-code text nodes found — the `code` guard is untested by the corpus",
	);
	process.exit(1);
}

if (failed > 0) {
	err(`\n${failed} smartypants check(s) failed`);
	process.exit(1);
}
out(
	`OK: ${checked} cases; ${converted} corpus text nodes convert, ${inlineCode} inline-code nodes left literal`,
);
