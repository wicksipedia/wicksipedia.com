/**
 * Every blog post body must parse into Tina's rich-text AST without producing
 * an `invalid_markdown` node — one such node fails the entire document, and the
 * post renders as raw text in a <pre> instead of prose.
 *
 * It must also not author an `<h1>`. `PostDetails.astro` renders the post title
 * as the page's one `<h1>` (via `PostHero.astro`), so a `# Heading` in a body
 * gives the document two, and the second one is not the post. The blog body is a
 * rich-text field, and a rich-text field with no `overrides.headingLevels`
 * offers "Heading 1" in its dropdown, its "Turn into" menu, its slash menu and
 * its `# ` autoformat shortcut — one click from the admin. `tina/collections/
 * blog.ts` closes that route; the override is UI-only by Tina's own
 * documentation, and all 17 posts were migrated by script rather than typed into
 * the admin, so the corpus is asserted here as well.
 *
 * The predicate, the allowed levels and the fixtures live in
 * `scripts/lib/headings.mjs`, shared with `check-page-prose.mjs`, which enforces
 * the same rule over page block bodies. The fixtures matter more than usual
 * here: the corpus holds 126 headings and ZERO offenders, so a scan that was
 * deleted outright prints exactly what a working scan prints. The fixtures prove
 * the predicate can go red, and the scanned-body count is reconciled against the
 * posts checked so the walk cannot quietly cover nothing.
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
import { blogCollection } from "../tina/collections/blog.ts";
import { BODY_FIELD } from "./lib/body-field.mjs";
import {
	ALLOWED_HEADING_LEVELS,
	assertRestrictsHeadingLevels,
	collectHeadings,
	disallowedHeadings,
	reportHeadingRuleError,
	runHeadingFixtures,
} from "./lib/headings.mjs";

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

/**
 * Every rich-text field the blog collection can hold, including the ones inside
 * a field's `templates`.
 *
 * Derived rather than written as `["body"]` for the reason
 * `check-page-prose.mjs` gives for deriving its own set from all four block
 * templates: a rich-text field added later — a pull-quote template, a callout —
 * would otherwise ship with "Heading 1" still on offer, and the h1 would surface
 * only once somebody authored one. `body` is the only one today, which is
 * exactly when a derivation is cheap to add.
 *
 * @param {readonly object[] | undefined} fields
 * @param {string[]} path
 * @returns {Array<[string, object]>} `[label, field]`
 */
function richTextFieldsIn(fields, path = []) {
	const found = [];
	for (const field of fields ?? []) {
		const here = [...path, field.name];
		if (field.type === "rich-text") found.push([here.join("."), field]);
		if (Array.isArray(field.fields)) {
			found.push(...richTextFieldsIn(field.fields, here));
		}
		for (const template of field.templates ?? []) {
			found.push(
				...richTextFieldsIn(template.fields, [...here, template.name]),
			);
		}
	}
	return found;
}

const blogRichTextFields = richTextFieldsIn(blogCollection.fields, [
	blogCollection.name,
]);

// The schema half of the h1 rule, over every rich-text field rather than
// `body` by name. Zero of them means the assertion below is a loop over an
// empty set — the failure this branch has shipped nine times.
if (blogRichTextFields.length === 0) {
	err(
		`FAIL: the ${blogCollection.name} collection declares no rich-text field — the heading check is vacuous`,
	);
	process.exit(1);
}

let schemaFieldsChecked = 0;
let fixtureRuns = 0;
try {
	for (const [label, field] of blogRichTextFields) {
		assertRestrictsHeadingLevels(label, field);
		schemaFieldsChecked++;
	}
	// The fixtures run against BODY_FIELD, which carries the parser derived from
	// the collection's own `format` — so they exercise the same parser the corpus
	// scan below uses, not a guessed one.
	fixtureRuns = runHeadingFixtures(BODY_FIELD, blogCollection.format ?? "md");
} catch (error) {
	reportHeadingRuleError(error, err);
}

let checked = 0;
let failed = 0;
let headingsSeen = 0;
let bodiesHeadingScanned = 0;
let headingFailures = 0;

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

	// The `<h1>` is the post title, rendered by `PostHero.astro`. A body that
	// authors one gives the document two, and the second is not the post — the
	// same failure `check-page-prose.mjs` guards for pages, arriving here through
	// a field whose editor offered "Heading 1" until this task.
	const headings = collectHeadings(ast);
	headingsSeen += headings.length;
	bodiesHeadingScanned++;
	for (const heading of disallowedHeadings(headings)) {
		headingFailures++;
		err(
			`FAIL: ${dir} — <${heading.level}> ${JSON.stringify(heading.text)} is not allowed in a post body`,
		);
		err(
			`  Allowed: ${[...ALLOWED_HEADING_LEVELS].join(", ")}. The <h1> is the post title, which`,
		);
		err("  PostDetails.astro renders from frontmatter. Use ## for a section.");
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

if (headingFailures > 0) {
	err(`\n${headingFailures} disallowed heading(s) in post bodies`);
	process.exit(1);
}

// The corpus holds 126 headings and ZERO offenders, so "0 disallowed" is what a
// WORKING scan prints and also what deleting the scan prints. Reconciling the
// bodies walked against the posts checked is what tells those apart.
//
// STRUCTURAL, not input-driven — and the next reader should know which
// instrument this is. Both numbers are computed by the one loop above, so they
// can only diverge on a code change; no post, however written, makes this fire.
// It is the same category as the fixture guards in `lib/headings.mjs`, and it
// buys the one thing the fixtures cannot: evidence that the scan ran over the
// real corpus rather than over nothing.
if (bodiesHeadingScanned !== checked) {
	err(
		`FAIL: scanned ${bodiesHeadingScanned} of ${checked} post bodies for headings`,
	);
	err("  Every parsed body must be walked, or the h1 rule is unenforced for");
	err("  the ones that were skipped.");
	process.exit(1);
}

out(
	`OK: ${checked} posts parse cleanly; ${schemaFieldsChecked} rich-text field(s) restrict headings to ${[...ALLOWED_HEADING_LEVELS].join("/")}, ${fixtureRuns} heading-level fixture run(s) agree, and ${bodiesHeadingScanned} scanned body/bodies hold ${headingsSeen} conforming heading(s)`,
);
