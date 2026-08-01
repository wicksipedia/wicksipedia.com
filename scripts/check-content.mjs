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
import { BODY_FIELD } from "./lib/body-field.mjs";

const BASE = "src/data/blog";

/**
 * Ceiling on a raw post body.
 *
 * parseMDX is superlinear on some inline runs — a body of `[` characters takes
 * 273ms at 32 KB and 972ms at 64 KB, roughly quadratic — so a large enough body
 * is a build-time denial of service before any of it reaches the sanitiser.
 * MAX_HTML_LENGTH cannot help: it is per-`html`-node and applies after the parse
 * that would already have hung.
 *
 * The largest real post is 12 KB, so this is five times the biggest thing anyone
 * has written here. It bounds the parse rather than expressing an editorial
 * opinion, and a post that trips it should be split rather than have the cap
 * raised.
 */
const MAX_BODY_LENGTH = 64 * 1024;

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
	// Checked before parsing, because the parse is the expensive part.
	if (body.length > MAX_BODY_LENGTH) {
		failed++;
		err(
			`FAIL: ${dir} — body is ${body.length} characters, over the ${MAX_BODY_LENGTH} limit`,
		);
		err("  parseMDX is superlinear on some inline runs, so an oversized body");
		err("  is a build-time denial of service. Split the post.");
		checked++;
		continue;
	}
	const ast = parseMDX(body, BODY_FIELD, (s) => s);
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
