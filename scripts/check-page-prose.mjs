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
 * files. Four things are asserted rather than hoped for:
 *
 *   1. at least one page, and at least one prose body, was found;
 *   2. every page file that exists was parsed;
 *   3. no body authors an `<h1>` — see the heading section below;
 *   4. Vale's own trailing "in N files" count equals the number of files
 *      written. That is the assertion that fails if the `.vale.ini` section
 *      guarding the scratch directory is ever removed — without it, Vale
 *      silently matches nothing and exits 0, which is the exact failure this
 *      script was written to replace.
 *
 * THE HEADING RULE. `src/lib/tina/pages.ts` guarantees a page has exactly one
 * `<h1>` and that nothing precedes it — but it reasons about the BLOCK LIST, so
 * anything that is not a block escapes it. A prose body can author `# Title`,
 * `Heading.astro` renders whatever level the AST carries, and the page has two
 * `<h1>`s. `prose.template.ts` closes the admin route by restricting the
 * editor's heading levels; that is UI-only by Tina's own documentation, and both
 * committed page documents were seeded by hand, so it is asserted here too.
 *
 * The fixtures below are not decoration. The committed corpus contains no
 * headings at all, so the corpus scan on its own is a loop over an empty set —
 * which passes identically to a scan that works. The fixtures put a known `#`
 * through the same parser and the same predicate, and the suite refuses to run
 * unless at least one of them is rejected and at least one accepted.
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

/**
 * Heading levels a block body may author. `h1` is the PAGE's heading — see the
 * heading section in this file's header, and `primaryHeroIndex` in
 * `src/lib/tina/pages.ts` for the invariant this is the other half of.
 *
 * Kept in step with `prose.template.ts`'s `overrides.headingLevels` by the
 * assertion below rather than by hand, so restricting the editor further (or
 * loosening it) cannot leave the two disagreeing about what is legal.
 */
const ALLOWED_HEADING_LEVELS = new Set(["h2", "h3", "h4", "h5", "h6"]);

const proseHeadingLevels =
	proseBlockSchema.fields?.find((field) => field.name === "body")?.overrides
		?.headingLevels ?? [];
if (proseHeadingLevels.length === 0) {
	err("FAIL: prose.body declares no overrides.headingLevels — the admin's");
	err("  heading dropdown still offers Heading 1. See prose.template.ts.");
	process.exit(1);
}
const schemaDisagreement = [
	...proseHeadingLevels.filter((level) => !ALLOWED_HEADING_LEVELS.has(level)),
	...[...ALLOWED_HEADING_LEVELS].filter(
		(level) => !proseHeadingLevels.includes(level),
	),
];
if (schemaDisagreement.length > 0) {
	err(
		`FAIL: prose.body allows [${proseHeadingLevels.join(", ")}] but this check enforces [${[...ALLOWED_HEADING_LEVELS].join(", ")}]`,
	);
	err(`  disagreeing on: ${schemaDisagreement.join(", ")}`);
	process.exit(1);
}

/**
 * The concatenated text of a node's subtree. Tina's rich-text nodes carry no
 * `position`, so the heading's own words are the only way to point an author at
 * the one that is wrong.
 */
function nodeText(node) {
	if (typeof node?.text === "string") return node.text;
	return (node?.children ?? []).map(nodeText).join("");
}

/** Every heading node in a body, depth-first, in document order. */
function collectHeadings(node, into = []) {
	if (typeof node?.type === "string" && /^h[1-6]$/.test(node.type)) {
		into.push({ level: node.type, text: nodeText(node).trim() });
	}
	for (const child of node?.children ?? []) collectHeadings(child, into);
	return into;
}

/** Which of a body's headings a block must not have authored. */
const disallowedHeadings = (headings) =>
	headings.filter((heading) => !ALLOWED_HEADING_LEVELS.has(heading.level));

/**
 * Known bodies with known headings, so the two functions above are exercised
 * whatever the corpus happens to contain. `setext` is here because `Title\n===`
 * is an h1 that contains no `#` — a check that grepped for the character would
 * pass it, and Tina's parser does emit `h1` for it (measured).
 */
const HEADING_FIXTURES = [
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
// corpus of two heading-free documents identically to a working check.
if (!HEADING_FIXTURES.some((fixture) => fixture.bad.length > 0)) {
	err("FAIL: no heading fixture expects a rejection — check cannot go red");
	process.exit(1);
}
if (
	!HEADING_FIXTURES.some(
		(fixture) => fixture.levels.length > 0 && fixture.bad.length === 0,
	)
) {
	err("FAIL: no heading fixture expects an accepted heading — check is a stub");
	process.exit(1);
}

const files = readdirSync(PAGES_BASE).filter(
	(entry) => entry.endsWith(".mdx") || entry.endsWith(".md"),
);
if (files.length === 0) {
	err(`FAIL: no page documents found under ${PAGES_BASE} — check is vacuous`);
	process.exit(1);
}

// Run the fixtures through every parser the corpus actually uses, so they can
// never end up measuring a format the site does not have. `richTextField` reads
// the format off the filename, exactly as it does for a real document.
const corpusExtensions = [...new Set(files.map((file) => extname(file)))];
let fixtureRuns = 0;
for (const extension of corpusExtensions) {
	const field = richTextField(`fixture${extension}`, "prose", "body");
	for (const fixture of HEADING_FIXTURES) {
		const found = collectHeadings(parseMDX(fixture.body, field, (v) => v));
		const levels = found.map((heading) => heading.level);
		const bad = disallowedHeadings(found).map((heading) => heading.level);
		if (levels.join(",") !== fixture.levels.join(",")) {
			err(
				`FAIL: heading fixture "${fixture.name}" (${extension}) parsed to [${levels.join(", ")}], expected [${fixture.levels.join(", ")}]`,
			);
			process.exit(1);
		}
		if (bad.join(",") !== fixture.bad.join(",")) {
			err(
				`FAIL: heading fixture "${fixture.name}" (${extension}) rejected [${bad.join(", ")}], expected [${fixture.bad.join(", ")}]`,
			);
			process.exit(1);
		}
		fixtureRuns++;
	}
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
	let headingsSeen = 0;
	let headingFailures = 0;
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

				// The `<h1>` belongs to the page. A body that authors one gives the
				// document two, from outside the block list `primaryHeroIndex` can
				// see. The schema stops the admin offering it; this stops a
				// hand-edited file, which is how both of these documents were made.
				const headings = collectHeadings(ast);
				headingsSeen += headings.length;
				for (const heading of disallowedHeadings(headings)) {
					headingFailures++;
					err(
						`FAIL: ${PAGES_BASE}/${file} → blocks[${index}].${field}: <${heading.level}> ${JSON.stringify(heading.text)} is not allowed in a block body`,
					);
					err(
						`  Allowed: ${[...ALLOWED_HEADING_LEVELS].join(", ")}. The <h1> is the page's own heading —`,
					);
					err(
						"  set it in Page Heading (or the Hero block's Name), not in the body.",
					);
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

	if (headingFailures > 0) {
		err(`\n${headingFailures} disallowed heading(s) in page block bodies`);
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
			`OK: ${bodiesLinted} page prose bodies (${words} words) from ${pagesParsed} page(s) and ${blocksSeen} block(s) parse without invalid_markdown and lint clean (${emptyBodies} empty rich-text field(s) skipped); ${fixtureRuns} heading-level fixture run(s) and ${headingsSeen} corpus heading(s) are all within ${[...ALLOWED_HEADING_LEVELS].join("/")}; Vale confirms it read ${valeRead} file(s)`,
		);
	}
} finally {
	rmSync(SCRATCH, { recursive: true, force: true });
}

process.exit(exitCode);
