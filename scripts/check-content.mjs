/**
 * Every blog post body must parse into Tina's rich-text AST without producing
 * an `invalid_markdown` node — one such node fails the entire document, and the
 * post renders as raw text in a <pre> instead of prose.
 *
 * Run: bun run check:content
 */
import { parseMDX } from "@tinacms/mdx";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const BASE = "src/data/blog";
const FIELD = { type: "rich-text", name: "body", parser: { type: "markdown" } };

const dirs = readdirSync(BASE).filter((d) =>
	statSync(join(BASE, d)).isDirectory() && !d.startsWith("_"),
);

// A loop over an empty set passes identically to success. Refuse to pass here.
if (dirs.length === 0) {
	console.error(`FAIL: no post directories found under ${BASE}`);
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
		console.error(`FAIL: ${dir} has no index.md`);
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
		console.error(`FAIL: ${dir}`);
		for (const node of invalid) {
			console.error(`  line ${node.position?.start?.line}: ${node.message}`);
		}
	}
}

if (checked !== dirs.length) {
	console.error(`FAIL: checked ${checked} of ${dirs.length} posts`);
	process.exit(1);
}

if (failed > 0) {
	console.error(`\n${failed} of ${checked} posts failed to parse`);
	process.exit(1);
}

console.log(`OK: ${checked} posts parse cleanly`);
