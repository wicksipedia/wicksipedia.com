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
 * Finally, every image in a post folder must be REFERENCED by that post. This
 * one is about bytes, not correctness: `src/lib/tina/images.ts` maps stored refs
 * back to `ImageMetadata` through an EAGER `import.meta.glob`, and an eager
 * import is an emit — so every matching file ships whether or not a post links
 * to it. Astro's old MDX pipeline imported only what a post referenced, which is
 * why an orphan cost nothing before the migration and costs its full size now.
 * A leftover 5.23 MB GIF was being served to nobody when this check was written.
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
import matter from "gray-matter";
import { BLOG_IMAGE_ROOT, blogImageKey } from "../src/lib/tina/image-ref.ts";
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

/** The module whose glob decides which files actually ship. */
const IMAGES_MODULE = "src/lib/tina/images.ts";

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
 * The extensions the eager glob in `images.ts` actually emits, read from the
 * glob itself.
 *
 * Not written out here as a list: an orphan check that guessed the extensions
 * would stop covering a format the moment somebody added one to the glob, and it
 * would do so silently — the new format's orphans would simply not be looked at.
 * Reading the literal also pins the ROOT, so a glob repointed away from
 * `src/data/blog` fails loudly instead of leaving this scanning a directory
 * nothing imports from.
 *
 * A parse failure here is a BROKEN CHECK, not broken content, and is reported as
 * one.
 */
function shippedImageExtensions() {
	const source = readFileSync(IMAGES_MODULE, "utf8");
	const glob = source.match(/"(\/[^"]*?)\/\*\*\/\*\.\{([^}]+)\}"/);
	if (!glob) {
		err(`FAIL: no blog image glob found in ${IMAGES_MODULE}`);
		err("  This check reads the glob to learn which files ship. If the glob");
		err("  moved or changed shape, update the pattern here to match it.");
		process.exit(1);
	}
	const [, root, extensions] = glob;
	if (root !== BLOG_IMAGE_ROOT) {
		err(
			`FAIL: ${IMAGES_MODULE} globs "${root}" but image-ref.ts resolves refs under "${BLOG_IMAGE_ROOT}"`,
		);
		err("  Stored refs would map to keys the glob never produced, so every");
		err("  post image would silently fail to resolve.");
		process.exit(1);
	}
	const exts = new Set(
		extensions
			.split(",")
			.map((ext) => ext.trim().toLowerCase())
			.filter(Boolean)
			.map((ext) => `.${ext}`),
	);
	if (exts.size === 0) {
		err(`FAIL: the image glob in ${IMAGES_MODULE} lists no extensions`);
		process.exit(1);
	}
	return exts;
}

const SHIPPED_IMAGE_EXTENSIONS = shippedImageExtensions();

/**
 * Known refs with known destinations, so `blogImageKey` is exercised whatever
 * the corpus contains.
 *
 * Same reasoning as the heading fixtures: all 17 posts use one ref form, so a
 * resolver that handled only that form — or one that resolved nothing at all —
 * would be indistinguishable from a working one if the corpus were the only
 * evidence. A resolver returning `undefined` for everything is the dangerous
 * mutant here: it would report every image an orphan, which is loud, but one
 * returning a constant key would report zero orphans forever, which is not.
 */
const IMAGE_REF_FIXTURES = [
	{
		slug: "a-post",
		ref: "./cover.png",
		key: `${BLOG_IMAGE_ROOT}/a-post/cover.png`,
	},
	{
		slug: "a-post",
		ref: "cover.png",
		key: `${BLOG_IMAGE_ROOT}/a-post/cover.png`,
	},
	{
		slug: "a-post",
		ref: "nested/shot.png",
		key: `${BLOG_IMAGE_ROOT}/a-post/nested/shot.png`,
	},
	// Tina's media manager writes this form; the slug in the ref wins.
	{
		slug: "a-post",
		ref: "/blog/other-post/cover.png",
		key: `${BLOG_IMAGE_ROOT}/other-post/cover.png`,
	},
	{ slug: "a-post", ref: "https://example.com/cover.png", key: undefined },
	{ slug: "a-post", ref: "/uploads/avatar.png", key: undefined },
	{ slug: "a-post", ref: "", key: undefined },
	{ slug: "a-post", ref: undefined, key: undefined },
];

// A fixture set where nothing resolves proves only that the resolver is a stub;
// one where nothing is rejected proves it cannot tell a post image from a remote
// URL. Both would pass this corpus.
if (!IMAGE_REF_FIXTURES.some((fixture) => fixture.key !== undefined)) {
	err(
		"FAIL: no image-ref fixture expects a resolved key — the resolver is untested",
	);
	process.exit(1);
}
if (!IMAGE_REF_FIXTURES.some((fixture) => fixture.key === undefined)) {
	err(
		"FAIL: no image-ref fixture expects a non-post ref — the resolver is untested",
	);
	process.exit(1);
}

let imageRefFixtureRuns = 0;
for (const fixture of IMAGE_REF_FIXTURES) {
	const actual = blogImageKey(fixture.slug, fixture.ref);
	if (actual !== fixture.key) {
		err(
			`FAIL: blogImageKey(${JSON.stringify(fixture.slug)}, ${JSON.stringify(fixture.ref)}) returned ${JSON.stringify(actual)}, expected ${JSON.stringify(fixture.key)}`,
		);
		process.exit(1);
	}
	imageRefFixtureRuns++;
}
if (imageRefFixtureRuns !== IMAGE_REF_FIXTURES.length) {
	err(
		`FAIL: ran ${imageRefFixtureRuns} of ${IMAGE_REF_FIXTURES.length} image-ref fixtures`,
	);
	process.exit(1);
}

/**
 * Every field an editor can put an image ref in, derived rather than written as
 * `["ogImage"]` — the same reason `richTextFieldsIn` below is a derivation. A
 * second image field added to the collection would otherwise let its target go
 * unreferenced-looking, and the check would report a real cover as an orphan.
 */
const imageFieldNames = blogCollection.fields
	.filter((field) => field.type === "image")
	.map((field) => field.name);

if (imageFieldNames.length === 0) {
	err(
		`FAIL: the ${blogCollection.name} collection declares no image field — the orphan check cannot see cover images`,
	);
	process.exit(1);
}

/** Every `img` node's url in a parsed body, depth-first. */
function collectImageRefs(node, into = []) {
	if (node?.type === "img" && typeof node.url === "string") into.push(node.url);
	for (const child of node?.children ?? []) collectImageRefs(child, into);
	return into;
}

/** Every file under `dir`, recursively, as paths relative to it. */
function filesUnder(dir, prefix = "") {
	const found = [];
	for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true })) {
		const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
		if (entry.isDirectory()) found.push(...filesUnder(dir, rel));
		else found.push(rel);
	}
	return found;
}

/** Glob keys every post points at, filled in as bodies are parsed below. */
const referencedImages = new Set();

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
let postsScannedForImages = 0;

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

	// Which images this post points at. Both halves are taken from the PARSED
	// document rather than from the file's text: the frontmatter through
	// `gray-matter`, which is the parser `@tinacms/graphql` reads these documents
	// with, and the body through the `img` nodes the renderer actually walks. A
	// filename that appears only in prose, or in a comment, is not a reference.
	const frontmatter = matter(raw).data;
	for (const name of imageFieldNames) {
		const value = frontmatter[name];
		if (typeof value !== "string") continue;
		const key = blogImageKey(dir, value);
		if (key) referencedImages.add(key);
	}
	for (const url of collectImageRefs(ast)) {
		// Resolved corpus-wide, not per-post: `/blog/<other>/<file>` is a real
		// reference to another post's image, and marking it referenced here is
		// what `resolveBlogImage` does at build time.
		const key = blogImageKey(dir, url);
		if (key) referencedImages.add(key);
	}
	postsScannedForImages++;
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

// INPUT-DERIVED, unlike the reconciliation above, and the reason this corpus
// gets a floor the pages corpus cannot have: the posts hold 126 headings, so
// zero means the walk stopped finding them rather than that there were none.
// It catches the mutant the count-only assertion cannot — a `collectHeadings`
// that no longer recurses still visits every body, so `bodiesHeadingScanned`
// stays at 17 while `headingsSeen` collapses.
if (headingsSeen === 0) {
	err(`FAIL: walked ${bodiesHeadingScanned} post bodies and found 0 headings`);
	err("  The corpus has 126. A scan finding none is a scan that is not");
	err("  descending into the tree, not a corpus that grew quiet.");
	process.exit(1);
}

// Same reconciliation as the heading walk, for the same reason: "0 orphans" is
// what a working scan prints AND what a scan that never ran prints. STRUCTURAL —
// both numbers come from the one loop, so no post makes this fire.
if (postsScannedForImages !== checked) {
	err(
		`FAIL: collected image refs from ${postsScannedForImages} of ${checked} posts`,
	);
	err("  Every parsed post must contribute its refs, or the images belonging");
	err("  to the ones skipped are reported as orphans.");
	process.exit(1);
}

/**
 * The orphan scan.
 *
 * `images.ts` globs eagerly, so an unreferenced file in a post folder is emitted
 * into `dist/` and served to nobody. This walks every post folder, keeps the
 * files the glob would match, and requires each to be pointed at by some post's
 * frontmatter or body.
 */
let imagesInspected = 0;
let postFoldersWalked = 0;
const orphans = [];

for (const dir of dirs) {
	postFoldersWalked++;
	for (const rel of filesUnder(join(BASE, dir))) {
		const dot = rel.lastIndexOf(".");
		const ext = dot === -1 ? "" : rel.slice(dot).toLowerCase();
		if (!SHIPPED_IMAGE_EXTENSIONS.has(ext)) continue;
		imagesInspected++;
		const key = `${BLOG_IMAGE_ROOT}/${dir}/${rel}`;
		if (referencedImages.has(key)) continue;
		orphans.push({
			path: join(BASE, dir, rel),
			bytes: statSync(join(BASE, dir, rel)).size,
		});
	}
}

if (postFoldersWalked !== dirs.length) {
	err(`FAIL: walked ${postFoldersWalked} of ${dirs.length} post folders`);
	process.exit(1);
}

// INPUT-DERIVED. The corpus holds 26 images; zero means the walk stopped finding
// them — a mistyped extension set, a `filesUnder` that no longer recurses — not
// a corpus that went imageless. Without this, deleting the walk prints "0
// orphans" and passes.
if (imagesInspected === 0) {
	err(`FAIL: walked ${postFoldersWalked} post folders and found 0 images`);
	err(
		`  Extensions looked for: ${[...SHIPPED_IMAGE_EXTENSIONS].sort().join(" ")}`,
	);
	err("  A scan finding none is a broken scan, not an imageless corpus.");
	process.exit(1);
}

// Likewise for the other side of the comparison: every post has a cover, so an
// empty reference set means ref collection broke, and every image would be
// reported as an orphan with a confident-looking total.
if (referencedImages.size === 0) {
	err(`FAIL: ${checked} posts yielded 0 image references`);
	err("  Every post sets a cover, so this is the ref collection failing, not");
	err("  a corpus that stopped using images.");
	process.exit(1);
}

if (orphans.length > 0) {
	const wasted = orphans.reduce((sum, orphan) => sum + orphan.bytes, 0);
	err(
		`\nFAIL: ${orphans.length} image(s) in post folders are referenced by no post`,
	);
	for (const orphan of orphans.sort((a, b) => b.bytes - a.bytes)) {
		err(`  ${orphan.path} — ${orphan.bytes.toLocaleString("en-US")} B`);
	}
	err(
		`  ${wasted.toLocaleString("en-US")} B total, all of which SHIPS: the glob in`,
	);
	err(
		`  ${IMAGES_MODULE} is eager, so importing is emitting. Delete the file,`,
	);
	err("  or reference it from its post.");
	process.exit(1);
}

out(
	`OK: ${checked} posts parse cleanly; ${schemaFieldsChecked} rich-text field(s) restrict headings to ${[...ALLOWED_HEADING_LEVELS].join("/")}, ${fixtureRuns} heading-level fixture run(s) agree, and ${bodiesHeadingScanned} scanned body/bodies hold ${headingsSeen} conforming heading(s)`,
);
out(
	`OK: ${imagesInspected} image(s) across ${postFoldersWalked} post folder(s) are all referenced; ${referencedImages.size} distinct ref(s) resolved, ${imageRefFixtureRuns} image-ref fixture run(s) agree`,
);
