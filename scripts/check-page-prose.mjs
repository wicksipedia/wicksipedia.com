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
 * files. Five things are asserted rather than hoped for:
 *
 *   1. at least one page, and at least one prose body, was found;
 *   2. every page file that exists was parsed;
 *   3. no body authors an `<h1>` — see the heading section below;
 *   4. every page renders an `<h1>` whose accessible name is non-empty;
 *   5. Vale's own trailing "in N files" count equals the number of files
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
 * The predicate, the allowed levels and the fixtures live in
 * `scripts/lib/headings.mjs`, shared with `check-content.mjs`, which enforces
 * the same rule over post bodies. The fixtures are not decoration: the committed
 * corpus contains no headings at all, so the corpus scan on its own is a loop
 * over an empty set — which passes identically to a scan that works. The
 * fixtures put a known `#` through the same parser and the same predicate, and
 * the suite refuses to run unless at least one of them is rejected and at least
 * one accepted.
 *
 * NON-EMPTY, not merely present. A count of `<h1>` elements cannot see the
 * failure this check shipped with: `name: "   "` on a leading hero made the
 * runtime suppress the page heading and render `<h1>   </h1>`, one `<h1>` with
 * no accessible name, while this file trimmed the same value away and reported
 * the `seoTitle` the runtime never reached. The check and the runtime now share
 * `hasHeadingText` (`src/lib/tina/heading-text.ts`) so they cannot spell the
 * test differently again, and the hero template and its name field are read off
 * `heroBlockSchema` so renaming either fails loudly instead of quietly matching
 * nothing.
 *
 * The set of FIELDS to lint is derived from the block schemas rather than
 * hardcoded to `prose.body`, so a rich-text field added to any of the templates
 * below is covered the day it lands instead of the day someone remembers this
 * file.
 *
 * The set of TEMPLATES is not derived from anything — it is four literal
 * imports, and nothing reconciles it with `tina/collections/page.ts`. That used
 * to be silent: a block whose `_template` was absent got an empty field list,
 * `blocksSeen` incremented, `bodiesLinted` did not, and every reconciliation in
 * this file still held. A fifth block template with a rich-text field would
 * have shipped with no heading restriction, no corpus scan and no Vale lint,
 * and this suite would have exited 0 while the header above claimed the
 * opposite. An unknown `_template` is now a hard failure, so the CONTENT
 * reconciles the list: the first page using a new block fails until its schema
 * is imported here.
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
import { hasHeadingText, headingText } from "../src/lib/tina/heading-text.ts";
import { parserForFormat } from "./lib/body-field.mjs";
import {
	ALLOWED_HEADING_LEVELS,
	assertRestrictsHeadingLevels,
	collectHeadings,
	disallowedHeadings,
	reportHeadingRuleError,
	runHeadingFixtures,
} from "./lib/headings.mjs";

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
 * The heading rule itself — the allowed levels, the AST walk, the fixtures and
 * the schema assertion — lives in `scripts/lib/headings.mjs`, because
 * `check-content.mjs` enforces the same rule over post bodies and two copies of
 * "what counts as an h1" is two things that can drift.
 *
 * EVERY rich-text field on every block template is asserted, not just
 * `prose.body`. `richTextFields` above derives what gets linted and
 * heading-checked from all four templates on purpose — the file header brags
 * about it. Asserting the schema restriction on one field BY NAME would leave
 * that asymmetry open: a rich-text field added to `hero`, `postFeed` or
 * `githubStats` would be heading-checked here while its editor still offered
 * "Heading 1", and the h1 would surface only once somebody authored one. Same
 * derivation, same set.
 */
let schemaFieldsChecked = 0;
try {
	for (const template of TEMPLATES) {
		for (const field of template.fields ?? []) {
			if (field.type !== "rich-text") continue;
			schemaFieldsChecked++;
			assertRestrictsHeadingLevels(`${template.name}.${field.name}`, field);
		}
	}
} catch (error) {
	reportHeadingRuleError(error, err);
}

/**
 * Which block template owns the page's `<h1>`, and the field that holds its
 * text. Two different instruments, and it is worth knowing which is which:
 *
 *   - the TEMPLATE NAME is genuinely DERIVED. Rename `heroBlockSchema.name` and
 *     `HERO_TEMPLATE` follows it, so the comparison below keeps matching.
 *   - the FIELD NAME is still the literal `"name"`. What the lookup adds is an
 *     EXISTENCE ASSERTION: rename the field and `find()` returns undefined and
 *     the guard exits 1. It does not survive the rename; it refuses to run
 *     through it.
 *
 * Either spelled bare would turn this into a silent no-op the day the schema
 * moved: `_template === "hero"` would simply stop matching, every page would
 * take the `seoTitle` fallback branch, and the check would keep printing that
 * all of them render exactly one `<h1>` with an accessible name. Loud on a
 * rename is the same principle the rest of this file applies to
 * `richTextFields`.
 */
const HERO_TEMPLATE = heroBlockSchema.name;
const HERO_NAME_FIELD = (heroBlockSchema.fields ?? []).find(
	(field) => field.name === "name",
)?.name;
if (!HERO_TEMPLATE || !HERO_NAME_FIELD) {
	err(
		`FAIL: hero block schema has no ${HERO_TEMPLATE ? "`name` field" : "template name"} —`,
	);
	err("  the page-heading guard below would match nothing and pass silently.");
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
try {
	for (const extension of corpusExtensions) {
		fixtureRuns += runHeadingFixtures(
			richTextField(`fixture${extension}`, "prose", "body"),
			extension,
		);
	}
} catch (error) {
	reportHeadingRuleError(error, err);
}
// `corpusExtensions` is derived from a `files` list already asserted non-empty,
// so this cannot be zero without the loop above being edited — a structural
// assertion, not an input-driven one, and cheap next to what it rules out.
if (fixtureRuns === 0) {
	err("FAIL: ran no heading fixtures — the h1 predicate is unexercised");
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
	let headingsSeen = 0;
	let bodiesHeadingScanned = 0;
	let headingFailures = 0;
	let pagesWithHeading = 0;
	let words = 0;
	/** @type {Array<[string, string]>} scratch file → source location */
	const provenance = [];

	for (const file of files) {
		const raw = readFileSync(join(PAGES_BASE, file), "utf8");
		const { data } = matter(raw);
		pagesParsed++;
		const slug = file.slice(0, -extname(file).length);
		const blocks = Array.isArray(data.blocks) ? data.blocks : [];

		// ZERO <h1> is the other way a page loses its heading, and it arrives by
		// the same hand-edit path this whole file exists for.
		// `PageBlocks.astro` falls back `heading || seoTitle`, and the doc comments
		// there and in `pages.ts` both say seoTitle "is `required: true`, so this is
		// never empty". But `required` is FORM validation: the generated GraphQL
		// type is `String!`, which forbids null and says nothing about "". A
		// hand-written `seoTitle: ""` on a page whose first block is not a named
		// hero renders a document whose first heading is an <h2> and whose <h1>
		// count is 0 — worse than the two-<h1> case the rest of this guards.
		//
		// Mirrors `primaryHeroIndex`: only `blocks[0]`, only a non-blank `name`.
		// "Mirrors" is now literal — `hasHeadingText` is the same function the
		// runtime calls, imported from `src/lib/tina/heading-text.ts`. It used to
		// be a hand-written `.trim() !== ""` beside a runtime `Boolean(name)`, and
		// the gap between them was a real hole: `name: "   "` made the runtime
		// suppress the page heading and render `<h1>   </h1>` while this check
		// reported the `seoTitle` it never reached. One <h1> by count, no
		// accessible name, and this line printed OK.
		const firstBlock = blocks[0];
		const heroOwnsHeading =
			firstBlock?._template === HERO_TEMPLATE &&
			hasHeadingText(firstBlock[HERO_NAME_FIELD]);
		const pageHeading = heroOwnsHeading
			? headingText(firstBlock[HERO_NAME_FIELD])
			: headingText(data.heading) || headingText(data.seoTitle);
		if (pageHeading !== "") {
			pagesWithHeading++;
		} else {
			err(
				`FAIL: ${PAGES_BASE}/${file} would render no <h1> with an accessible name`,
			);
			err(
				`  Its first block is not a ${HERO_TEMPLATE} with a ${HERO_NAME_FIELD}, and both Page Heading`,
			);
			err(
				"  and Meta Title are blank or whitespace. `required: true` is a form rule,",
			);
			err(
				"  not a content one, and it does not reject a field containing only spaces.",
			);
			process.exit(1);
		}

		for (const [index, block] of blocks.entries()) {
			blocksSeen++;
			// `?? []` used to live on the lookup below, which made an unrecognised
			// block a SILENT SKIP — see the TEMPLATES paragraph at the top. Every
			// count in this file stayed consistent while the block went unlinted,
			// so nothing could notice. Now it stops the run.
			if (!richTextFields.has(block?._template)) {
				err(
					`FAIL: ${PAGES_BASE}/${file} → blocks[${index}] has _template ${JSON.stringify(block?._template)}, which this check has no schema for`,
				);
				err(`  Known templates: ${[...richTextFields.keys()].join(", ")}`);
				err(
					"  Import its schema into TEMPLATES here. Until then its rich-text fields",
				);
				err(
					"  get no heading restriction, no corpus scan and no Vale lint, and this",
				);
				err("  suite would exit 0 having skipped the block entirely.");
				process.exit(1);
			}
			const fields = richTextFields.get(block._template);
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
				bodiesHeadingScanned++;
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

	// The corpus legitimately contains zero headings today, so "0 disallowed" is
	// what a WORKING scan prints and also what deleting the scan prints. Counting
	// the bodies it walked, and reconciling against the bodies extracted, is what
	// tells those apart.
	//
	// SAME REASON AS THE VALE COUNT BELOW, WEAKER INSTRUMENT — and the next
	// reader should know which one they are holding. The Vale assertion compares
	// a number this script computed against one an EXTERNAL PROCESS produced, so
	// the two can diverge on real input: a `.vale.ini` that stops matching the
	// scratch directory makes it fire with nothing else changed. Both numbers
	// here are computed by the same loop in the same file, so they can only
	// diverge on a code change. That makes this a STRUCTURAL assertion — the same
	// category as the `HEADING_FIXTURES` guards in `lib/headings.mjs` and the
	// `declaredRichTextFields.length === 0` exit above: it cannot catch bad
	// content, only a check that has quietly stopped being a check. Kept for
	// exactly that, and worth its four lines, because "walked nothing" is the
	// failure this branch has shipped nine times.
	if (bodiesHeadingScanned !== bodiesLinted) {
		err(
			`FAIL: scanned ${bodiesHeadingScanned} of ${bodiesLinted} prose body/bodies for headings`,
		);
		err("  Every extracted body must be walked, or the h1 rule is unenforced");
		err("  for the ones that were skipped.");
		process.exit(1);
	}

	// Likewise, and likewise structural: the zero-<h1> guard runs per page, so
	// prove it saw every page rather than short-circuiting past some.
	if (pagesWithHeading !== pagesParsed) {
		err(
			`FAIL: confirmed a heading for ${pagesWithHeading} of ${pagesParsed} page(s)`,
		);
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
			`OK: ${bodiesLinted} page prose bodies (${words} words) from ${pagesParsed} page(s) and ${blocksSeen} block(s) parse without invalid_markdown and lint clean (${emptyBodies} empty rich-text field(s) skipped); ${schemaFieldsChecked} rich-text field(s) restrict headings to ${[...ALLOWED_HEADING_LEVELS].join("/")}, ${fixtureRuns} heading-level fixture run(s) agree, and ${bodiesHeadingScanned} scanned body/bodies hold ${headingsSeen} conforming heading(s); all ${pagesWithHeading} page(s) render exactly one <h1> with a non-empty accessible name; Vale confirms it read ${valeRead} file(s)`,
		);
	}
} finally {
	rmSync(SCRATCH, { recursive: true, force: true });
}

process.exit(exitCode);
