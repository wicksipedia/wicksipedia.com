/**
 * Lints the prose inside `content/pages/*.mdx` — the copy that used to live in
 * `src/pages/about.mdx` and was covered by `vale src/data/blog/` only because
 * everything prose-shaped happened to live under that path.
 *
 * WHY THIS SCRIPT EXISTS AND A `.vale.ini` SECTION DOES NOT DO THE JOB.
 * Adding `[content/pages/**\/*.mdx]` to `.vale.ini` reports "0 errors in 2
 * files" — and keeps reporting it after you paste `leverage` and `delve` into
 * the prose. The bodies live inside YAML frontmatter (`blocks[].body`), and
 * Vale lints the *document body*, which for these files is empty. The green run
 * means nothing was read. Measured, not assumed.
 *
 * So the bodies are extracted, written out as real Markdown, and linted as
 * files. Three things are asserted rather than hoped for:
 *
 *   1. at least one page, and at least one prose body, was found;
 *   2. every page file that exists was parsed;
 *   3. Vale's own trailing "in N files" count equals the number of files
 *      written. That is the assertion that fails if the `.vale.ini` section
 *      guarding the scratch directory is ever removed — without it, Vale
 *      silently matches nothing and exits 0, which is the exact failure this
 *      script was written to replace.
 *
 * The set of fields to lint is derived from the block schemas rather than
 * hardcoded to `prose.body`, so a rich-text field added to any block is covered
 * the day it lands instead of the day someone remembers this file.
 *
 * `gray-matter` is the parser `@tinacms/graphql` reads these documents with, so
 * the check sees the same frontmatter the CMS does.
 *
 * Run: bun run check:page-prose
 */

import { execFileSync } from "node:child_process";
import {
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { extname, join } from "node:path";
import { parseMDX } from "@tinacms/mdx";
import matter from "gray-matter";
import { githubStatsBlockSchema } from "../src/components/blocks/github-stats.template.ts";
import { heroBlockSchema } from "../src/components/blocks/hero.template.ts";
import { postFeedBlockSchema } from "../src/components/blocks/post-feed.template.ts";
import { proseBlockSchema } from "../src/components/blocks/prose.template.ts";
import { parserForFormat } from "./lib/body-field.mjs";

const PAGES_BASE = "content/pages";
/** Scratch directory. `.vale.ini` has a section matching this path — see above. */
const SCRATCH = ".vale-tmp";

/** @param {string} m */
const out = (m) => process.stdout.write(`${m}\n`);
/** @param {string} m */
const err = (m) => process.stderr.write(`${m}\n`);

/** Every block template the `page` collection can hold. */
const TEMPLATES = [
	heroBlockSchema,
	postFeedBlockSchema,
	proseBlockSchema,
	githubStatsBlockSchema,
];

// A Map, not an object literal: `_template` comes out of a content file, and a
// literal would resolve `constructor` / `toString` to inherited members. Same
// class of hole as the three already closed on this branch.
const richTextFields = new Map(
	TEMPLATES.map((template) => [
		template.name,
		(template.fields ?? [])
			.filter((field) => field.type === "rich-text")
			.map((field) => field.name),
	]),
);

// If no template declares a rich-text field, every loop below is vacuous and
// the script reports success having linted nothing.
/**
 * The rich-text field object Tina would parse this body with, carrying the
 * parser the collection's format implies.
 *
 * Guessing `markdown` would be measuring a document the build never renders:
 * the two parsers genuinely disagree, and `<img src=x onerror=alert(1)>` is an
 * `html` node under one and a whole-body `invalid_markdown` under the other.
 *
 * The format is taken from the document's own extension rather than by
 * importing `tina/collections/page.ts` — that file imports its block templates
 * without file extensions, which Vite resolves and Node's ESM loader does not.
 * Reading the extension is not a guess: it is the same thing Tina derives the
 * parser from, and it cannot drift silently, because a collection that changed
 * format would rename its documents and the glob below would find none, which
 * trips the vacuity guard.
 *
 * @param {string} file @param {string} templateName @param {string} fieldName
 */
function richTextField(file, templateName, fieldName) {
	const template = TEMPLATES.find((t) => t.name === templateName);
	const field = (template?.fields ?? []).find((f) => f.name === fieldName);
	if (!field) {
		throw new Error(
			`no rich-text field ${templateName}.${fieldName} in the block schemas`,
		);
	}
	const format = extname(file).slice(1);
	return { ...field, parser: { type: parserForFormat(format, "page") } };
}

const declaredRichTextFields = [...richTextFields.values()].flat();
if (declaredRichTextFields.length === 0) {
	err("FAIL: no block template declares a rich-text field — check is vacuous");
	process.exit(1);
}

const files = readdirSync(PAGES_BASE).filter(
	(entry) => entry.endsWith(".mdx") || entry.endsWith(".md"),
);
if (files.length === 0) {
	err(`FAIL: no page documents found under ${PAGES_BASE} — check is vacuous`);
	process.exit(1);
}

rmSync(SCRATCH, { recursive: true, force: true });
mkdirSync(SCRATCH, { recursive: true });

let exitCode = 0;
try {
	let pagesParsed = 0;
	let blocksSeen = 0;
	let bodiesLinted = 0;
	let emptyBodies = 0;
	let parseFailures = 0;
	let words = 0;
	/** @type {Array<[string, string]>} scratch file → source location */
	const provenance = [];

	for (const file of files) {
		const raw = readFileSync(join(PAGES_BASE, file), "utf8");
		const { data } = matter(raw);
		pagesParsed++;
		const slug = file.slice(0, -extname(file).length);
		const blocks = Array.isArray(data.blocks) ? data.blocks : [];

		for (const [index, block] of blocks.entries()) {
			blocksSeen++;
			const fields = richTextFields.get(block?._template) ?? [];
			for (const field of fields) {
				const body = block?.[field];
				if (typeof body !== "string" || body.trim() === "") {
					emptyBodies++;
					continue;
				}
				// The other half of "actually linted": a body Tina cannot parse
				// becomes ONE `invalid_markdown` node and the whole block renders
				// as escaped source inside a <pre> — silently, with a green build.
				// Measured: `<img src=x onerror=alert(1)>` in a page body does
				// exactly this. `check-content.mjs` has caught the same failure for
				// posts since Task 1.2; pages had nothing.
				const ast = parseMDX(
					body,
					richTextField(file, block._template, field),
					(v) => v,
				);
				const invalid = (ast.children ?? []).filter(
					(node) => node.type === "invalid_markdown",
				);
				if (invalid.length > 0) {
					parseFailures++;
					err(
						`FAIL: ${PAGES_BASE}/${file} → blocks[${index}].${field} does not parse`,
					);
					for (const node of invalid) {
						err(`  line ${node.position?.start?.line}: ${node.message}`);
					}
					err("  The whole block renders as escaped source in a <pre>.");
				}

				const name = `${slug}__blocks-${index}-${field}.md`;
				writeFileSync(join(SCRATCH, name), `${body.trim()}\n`, "utf8");
				provenance.push([
					name,
					`${PAGES_BASE}/${file} → blocks[${index}].${field}`,
				]);
				bodiesLinted++;
				words += body.trim().split(/\s+/).filter(Boolean).length;
			}
		}
	}

	if (pagesParsed !== files.length) {
		err(`FAIL: parsed ${pagesParsed} of ${files.length} page documents`);
		process.exit(1);
	}

	// The whole point. A run that extracted nothing passes Vale identically to a
	// run that extracted clean prose.
	if (bodiesLinted === 0) {
		err(
			`FAIL: found 0 prose bodies across ${pagesParsed} page(s) and ${blocksSeen} block(s)`,
		);
		err(`  rich-text fields looked for: ${declaredRichTextFields.join(", ")}`);
		err("  Vale would report success over an empty set. Refusing to.");
		process.exit(1);
	}

	if (parseFailures > 0) {
		err(`\n${parseFailures} page prose body/bodies failed to parse`);
		process.exit(1);
	}

	let valeOutput = "";
	let valeFailed = false;
	try {
		valeOutput = execFileSync("vale", ["--minAlertLevel=error", SCRATCH], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		});
	} catch (error) {
		valeFailed = true;
		valeOutput = `${error.stdout ?? ""}${error.stderr ?? ""}`;
	}

	// Vale's trailing summary is the only place it says how much it read. This
	// is the assertion that catches a `.vale.ini` that no longer matches the
	// scratch path: Vale exits 0 having linted nothing at all.
	const seen = /in (\d+) files?\./.exec(valeOutput);
	if (!seen) {
		err("FAIL: could not read Vale's file count from its output");
		err(valeOutput);
		process.exit(1);
	}
	const valeRead = Number(seen[1]);
	if (valeRead !== bodiesLinted) {
		err(`FAIL: wrote ${bodiesLinted} prose file(s) but Vale read ${valeRead}.`);
		err(
			`  ${SCRATCH}/ is matched by a section in .vale.ini; if that section is`,
		);
		err("  gone, Vale skips the files and reports success over nothing.");
		err(valeOutput);
		process.exit(1);
	}

	if (valeFailed) {
		err(valeOutput);
		err("Prose errors above. Line numbers are relative to the extracted body:");
		for (const [name, source] of provenance) err(`  ${name}  ←  ${source}`);
		exitCode = 1;
	} else {
		out(
			`OK: ${bodiesLinted} page prose bodies (${words} words) from ${pagesParsed} page(s) and ${blocksSeen} block(s) parse without invalid_markdown and lint clean (${emptyBodies} empty rich-text field(s) skipped); Vale confirms it read ${valeRead} file(s)`,
		);
	}
} finally {
	rmSync(SCRATCH, { recursive: true, force: true });
}

process.exit(exitCode);
