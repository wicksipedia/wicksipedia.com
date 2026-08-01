/**
 * Every blog post body must parse into Tina's rich-text AST without producing
 * an `invalid_markdown` node — one such node fails the entire document, and the
 * post renders as raw text in a <pre> instead of prose.
 *
 * Run: bun run check:content
 *
 * Progress is reported through process.stdout/stderr rather than `console`,
 * which Biome bans repo-wide. This script only needs a stream, not an
 * exemption.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseMDX } from "@tinacms/mdx";

const BASE = "src/data/blog";
const FIELD = { type: "rich-text", name: "body", parser: { type: "markdown" } };

/** @param {string} message */
const out = (message) => process.stdout.write(`${message}\n`);
/** @param {string} message */
const err = (message) => process.stderr.write(`${message}\n`);

const dirs = readdirSync(BASE).filter(
	(d) => statSync(join(BASE, d)).isDirectory() && !d.startsWith("_"),
);

// A loop over an empty set passes identically to success. Refuse to pass here.
if (dirs.length === 0) {
	err(`FAIL: no post directories found under ${BASE}`);
	process.exit(1);
}

let checked = 0;
let failed = 0;

for (const dir of dirs) {
	const file = join(BASE, dir, "index.md");
	let raw;
	try {
		raw = readFileSync(file, "utf8");
	} catch {
		err(`FAIL: ${dir} has no index.md`);
		failed++;
		continue;
	}
	const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
	const ast = parseMDX(body, FIELD, (s) => s);
	const invalid = (ast.children ?? []).filter(
		(node) => node.type === "invalid_markdown",
	);
	checked++;
	if (invalid.length > 0) {
		failed++;
		err(`FAIL: ${dir}`);
		for (const node of invalid) {
			err(`  line ${node.position?.start?.line}: ${node.message}`);
		}
	}
}

if (checked !== dirs.length) {
	err(`FAIL: checked ${checked} of ${dirs.length} posts`);
	process.exit(1);
}

if (failed > 0) {
	err(`\n${failed} of ${checked} posts failed to parse`);
	process.exit(1);
}

out(`OK: ${checked} posts parse cleanly`);
