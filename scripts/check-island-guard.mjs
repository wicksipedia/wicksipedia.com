/**
 * Pins the slug allowlist guarding the public island endpoint.
 *
 * `/tina-island/[name]?slug=…` takes `slug` from an unauthenticated query
 * string and interpolates it into a Tina relativePath. Tina *resolves* `..`
 * rather than rejecting it, so before this guard `../blog/git-and-diffs`
 * reached the real document; escape from the collection was prevented by the
 * index lookup failing, not by any check. Task 2.1 added the second collection
 * (`settings`) and Task 3.1 the third (`page`), so there is now somewhere to
 * escape *to* — the cross-collection cases below are load-bearing rather than
 * hypothetical.
 *
 * The `page` island takes its slug off the URL exactly as `blog` does
 * (`/tina-island/page?slug=about`), and `getPage` interpolates it into
 * `${slug}.mdx`. `isValidPageSlug` is the guard on that path and gets the same
 * treatment here, cross-collection cases included.
 *
 * The settings islands take the other approach to the same problem: they read
 * no URL parameter at all and address one constant relativePath, checked by
 * `isValidSettingsPath`. That guard is exercised here too, so the property
 * survives someone later giving the island a `?path=`.
 *
 * Cases go through a real URLSearchParams, because that is what the route
 * hands the guard — percent-decoding has already happened by then, which is
 * why `%2F` has to be tested as a query string and not as a bare literal.
 *
 * The visibility half of the gate (draft / scheduled posts) is NOT covered
 * here: it calls postFilter, which reads `import.meta.env.DEV` and so cannot be
 * imported outside Vite. It is proven end-to-end against the built Worker
 * instead — see the Task 1.6 report.
 *
 * Run: bun run check:island-guard
 */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
	isValidBlogSlug,
	isValidPageSlug,
	isValidSettingsPath,
	resolveIslandEntry,
	SETTINGS_RELATIVE_PATH,
} from "../src/lib/tina/island-guard.ts";

const BASE = "src/data/blog";
const PAGES_BASE = "content/pages";

/** @param {string} m */
const out = (m) => process.stdout.write(`${m}\n`);
/** @param {string} m */
const err = (m) => process.stderr.write(`${m}\n`);

/**
 * Each case is a raw query string, exactly as it would arrive on the wire. The
 * optional fourth element tags a case as belonging to the cross-collection
 * group, whose size is asserted below.
 * @type {Array<[string, string, boolean] | [string, string, boolean, "x"]>}
 */
const CASES = [
	// --- the four the audit asked for -------------------------------------
	["parent traversal", "slug=../blog/git-and-diffs", false],
	["traversal mid-path", "slug=git-and-diffs/../git-and-diffs", false],
	["absolute path", "slug=/etc/passwd", false],
	["url-encoded separator", "slug=blog%2Fgit-and-diffs", false],
	["url-encoded traversal", "slug=..%2Fgit-and-diffs", false],
	["empty slug", "slug=", false],
	["slug absent entirely", "other=1", false],

	// --- neighbouring shapes that must also stay out ----------------------
	["bare dot-dot", "slug=..", false],
	["backslash separator", "slug=..\\git-and-diffs", false],
	// Isolates the backslash: no dot, no forward slash, so this is the only
	// case that fails if `\` is ever added to the allowlist. The library's own
	// path handling normalises `\` to `/`, so it is a separator here too.
	["bare backslash", "slug=a\\b", false],
	["url-encoded backslash", "slug=a%5Cb", false],
	["null byte", "slug=git-and-diffs%00.md", false],
	["uppercase", "slug=Git-And-Diffs", false],
	["underscore", "slug=git_and_diffs", false],
	["dot in slug", "slug=index.md", false],
	["leading space", "slug=%20git-and-diffs", false],
	["wildcard", "slug=*", false],
	["nested folder", "slug=a/b", false],

	// --- reaching the OTHER collection (Task 2.1 made these reachable) -----
	// Tagged `x` rather than detected by substring: `slug=index.json` belongs to
	// this group and does not contain the word "settings", and a substring test
	// would quietly stop counting it.
	["hop to settings", "slug=../settings/index.json", false, "x"],
	["hop to settings, encoded", "slug=..%2Fsettings%2Findex.json", false, "x"],
	[
		"out to the content root",
		"slug=../../content/settings/index.json",
		false,
		"x",
	],
	["settings as a subfolder", "slug=settings/index.json", false, "x"],
	["bare settings document", "slug=index.json", false, "x"],

	// --- shapes that must keep working ------------------------------------
	["plain kebab slug", "slug=git-and-diffs", true],
	["digits in slug", "slug=aspire-sqlclient-7-missing-azure-provider", true],
	["single character", "slug=a", true],
];

let failed = 0;
let checked = 0;

for (const [name, query, want] of CASES) {
	checked++;
	const got = isValidBlogSlug(new URLSearchParams(query).get("slug"));
	if (got !== want) {
		failed++;
		err(`FAIL: ${name}`);
		err(`  query:    ${JSON.stringify(query)}`);
		err(`  expected: ${want ? "accepted" : "rejected"}`);
		err(`  actual:   ${got ? "accepted" : "rejected"}`);
	}
}

// A guard tight enough to reject everything would pass every case above and
// take the whole blog offline, so hold it against the real corpus too.
const slugs = readdirSync(BASE).filter((entry) =>
	statSync(join(BASE, entry)).isDirectory(),
);

// An empty corpus would make the loop below vacuously true, which is
// indistinguishable from success. It is never what anyone intended.
if (slugs.length === 0) {
	err(`FAIL: no post directories found under ${BASE} — check is vacuous`);
	process.exit(1);
}

let corpusChecked = 0;
for (const slug of slugs) {
	corpusChecked++;
	if (!isValidBlogSlug(slug)) {
		failed++;
		err(`FAIL: real post slug rejected by the guard: ${slug}`);
	}
}

// Likewise: a rewritten CASES table that accidentally dropped its negatives
// would report a clean run having proved nothing.
const negatives = CASES.filter(([, , want]) => !want).length;
const positives = CASES.length - negatives;
if (negatives < 10 || positives < 3) {
	err(
		`FAIL: case table lost coverage (${negatives} reject / ${positives} accept)`,
	);
	process.exit(1);
}

// The cross-collection cases are the ones that stopped being theoretical when
// `settings` landed. Losing them would leave a table that still looks thorough.
const crossCollection = CASES.filter(([, , , group]) => group === "x").length;
if (crossCollection < 5) {
	err(`FAIL: only ${crossCollection} cross-collection cases left in the table`);
	process.exit(1);
}

/**
 * The `page` island reads `?slug=` off the URL and `getPage` interpolates it
 * into `${slug}.mdx`, so it needs the same allowlist treatment as `blog`.
 *
 * The cross-collection group is tagged `x` for the same reason as above: the
 * shapes that reach *out* of `content/pages` do not all contain a giveaway
 * substring, and a substring test would quietly stop counting them.
 * @type {Array<[string, string, boolean] | [string, string, boolean, "x"]>}
 */
const PAGE_CASES = [
	// --- traversal and separators -----------------------------------------
	["parent traversal", "slug=../pages/about", false],
	["traversal mid-path", "slug=about/../about", false],
	["absolute path", "slug=/etc/passwd", false],
	["url-encoded separator", "slug=pages%2Fabout", false],
	["url-encoded traversal", "slug=..%2Fabout", false],
	["bare dot-dot", "slug=..", false],
	["backslash separator", "slug=..\\about", false],
	["bare backslash", "slug=a\\b", false],
	["url-encoded backslash", "slug=a%5Cb", false],
	["null byte", "slug=about%00.mdx", false],
	["empty slug", "slug=", false],
	["slug absent entirely", "other=1", false],
	["uppercase", "slug=About", false],
	["underscore", "slug=about_us", false],
	// `getPage` appends `.mdx` itself; a slug carrying its own extension is
	// either a typo or an attempt to address a different file.
	["dot in slug", "slug=about.mdx", false],
	["leading space", "slug=%20about", false],
	["wildcard", "slug=*", false],
	["nested folder", "slug=a/b", false],

	// --- reaching the OTHER collections -----------------------------------
	// `content/pages/../settings/index.json` is a real path on disk: the
	// settings collection sits at `content/settings`, one directory up from
	// this collection's root. This group is not theoretical.
	["hop to settings", "slug=../settings/index", false, "x"],
	["hop to settings, encoded", "slug=..%2Fsettings%2Findex", false, "x"],
	[
		"hop to the blog collection",
		"slug=../../src/data/blog/git-and-diffs/index",
		false,
		"x",
	],
	["out to the content root", "slug=../../content/settings/index", false, "x"],
	["settings as a subfolder", "slug=settings/index", false, "x"],
	["bare settings document", "slug=index.json", false, "x"],

	// --- shapes that must keep working ------------------------------------
	["plain page slug", "slug=about", true],
	["hyphenated slug", "slug=about-me", true],
	["digits in slug", "slug=case-study-2", true],
	["single character", "slug=a", true],
	// What `pageCollection.ui.filename.slugify` emits for a title that
	// slugifies to nothing, and for a title colliding with a reserved route.
	["the untitled fallback", "slug=untitled", true],
	["a reserved-route rename", "slug=blog-page", true],
];

let pageChecked = 0;
for (const [name, query, want] of PAGE_CASES) {
	pageChecked++;
	const got = isValidPageSlug(new URLSearchParams(query).get("slug"));
	if (got !== want) {
		failed++;
		err(`FAIL: page slug "${name}"`);
		err(`  query:    ${JSON.stringify(query)}`);
		err(`  expected: ${want ? "accepted" : "rejected"}`);
		err(`  actual:   ${got ? "accepted" : "rejected"}`);
	}
}

const pageNegatives = PAGE_CASES.filter(([, , want]) => !want).length;
const pagePositives = PAGE_CASES.length - pageNegatives;
if (pageNegatives < 20 || pagePositives < 5) {
	err(
		`FAIL: page case table lost coverage (${pageNegatives} reject / ${pagePositives} accept)`,
	);
	process.exit(1);
}

const pageCrossCollection = PAGE_CASES.filter(([, , , g]) => g === "x").length;
if (pageCrossCollection < 6) {
	err(
		`FAIL: only ${pageCrossCollection} cross-collection page cases left in the table`,
	);
	process.exit(1);
}

// Same reason as the blog corpus: a guard tight enough to reject everything
// passes every case above and takes every CMS page off the site. Routes are
// INFERRED from this collection, so a rejected slug is a missing route.
const pageSlugs = readdirSync(PAGES_BASE)
	.filter((entry) => entry.endsWith(".mdx"))
	.map((entry) => entry.slice(0, -".mdx".length));

// An empty collection would make the loop below vacuously true. `listPages`
// throws on the same condition at build time; this is the unit-level half.
if (pageSlugs.length === 0) {
	err(`FAIL: no page documents found under ${PAGES_BASE} — check is vacuous`);
	process.exit(1);
}

let pageCorpusChecked = 0;
for (const slug of pageSlugs) {
	pageCorpusChecked++;
	if (!isValidPageSlug(slug)) {
		failed++;
		err(`FAIL: real page slug rejected by the guard: ${slug}`);
	}
}

/**
 * The settings islands never read a URL parameter — they address one constant
 * document. `isValidSettingsPath` is what keeps that true if someone later
 * wires a `?path=` to it, so hold it against the same hostile shapes.
 * @type {Array<[string, unknown, boolean]>}
 */
const SETTINGS_CASES = [
	["the one real document", SETTINGS_RELATIVE_PATH, true],
	["hop to a post", "../src/data/blog/git-and-diffs/index.md", false],
	["hop to the blog collection", "../blog/git-and-diffs/index.md", false],
	["traversal mid-path", "settings/../../index.json", false],
	["absolute path", "/etc/passwd", false],
	["a neighbouring json", "other.json", false],
	["same name, nested", "settings/index.json", false],
	["extension swap", "index.md", false],
	["empty string", "", false],
	["null", null, false],
	["undefined", undefined, false],
];

let settingsChecked = 0;
for (const [name, path, want] of SETTINGS_CASES) {
	settingsChecked++;
	const got = isValidSettingsPath(path);
	if (got !== want) {
		failed++;
		err(`FAIL: settings path "${name}"`);
		err(`  value:    ${JSON.stringify(path)}`);
		err(`  expected: ${want ? "accepted" : "rejected"}`);
		err(`  actual:   ${got ? "accepted" : "rejected"}`);
	}
}

if (SETTINGS_CASES.filter(([, , want]) => !want).length < 8) {
	err("FAIL: settings path table lost its rejection cases");
	process.exit(1);
}

/**
 * The island *name* is the other untrusted path segment. A bare
 * `registry[name]` on an object literal resolves these to inherited functions —
 * truthy, so a "did we find an entry?" test passes and the caller gets a
 * Function where it expected a config. That was an unauthenticated 500 on every
 * one of these paths.
 *
 * Both registries in src/lib/islands.ts now also carry a null prototype, which
 * closes it independently. Testing `resolveIslandEntry` against a *plain object
 * literal* is deliberate: it pins the guarantee that survives someone adding a
 * third registry the ordinary way.
 */
const PROTOTYPE_KEYS = [
	"__proto__",
	"constructor",
	"prototype",
	"valueOf",
	"toString",
	"toLocaleString",
	"hasOwnProperty",
	"isPrototypeOf",
	"propertyIsEnumerable",
	"__defineGetter__",
	"__defineSetter__",
	"__lookupGetter__",
	"__lookupSetter__",
];

const literalRegistry = {
	blog: "GATE_A",
	blogHero: "GATE_B",
	settings: "GATE_C",
	"settings-footer": "GATE_D",
};
const nullProtoRegistry = Object.assign(Object.create(null), literalRegistry);

let protoChecked = 0;
for (const registry of [literalRegistry, nullProtoRegistry]) {
	const shape =
		Object.getPrototypeOf(registry) === null ? "null-proto" : "literal";

	for (const key of PROTOTYPE_KEYS) {
		protoChecked++;
		const got = resolveIslandEntry(registry, key);
		if (got !== undefined) {
			failed++;
			err(`FAIL: island name "${key}" resolved on a ${shape} registry`);
			err(`  got: ${typeof got}`);
		}
	}

	// And the real entries must still resolve, or the guard is merely tight.
	for (const [key, want] of Object.entries(literalRegistry)) {
		protoChecked++;
		const got = resolveIslandEntry(registry, key);
		if (got !== want) {
			failed++;
			err(`FAIL: real island "${key}" did not resolve on a ${shape} registry`);
		}
	}
}

// The literal registry is the load-bearing half of the case above: if a future
// edit makes it null-prototype, these cases stop proving anything about
// `resolveIslandEntry` and start proving something about Object.create(null).
if (Object.getPrototypeOf(literalRegistry) === null) {
	err("FAIL: the literal fixture is no longer a plain object literal");
	process.exit(1);
}

/**
 * The island name is not the only untrusted key looked up in an object. Since
 * Task 2.1 the footer's icon is chosen by `SOCIAL_ICONS[social.icon]`, where
 * `icon` is a CMS string: `"constructor"` would resolve to `Object`, pass the
 * "did we find an icon?" test, and hand Astro a non-component — an
 * unauthenticated 500 when rendered from `/tina-island/settings-footer`.
 *
 * `src/constants.ts` cannot be imported here (it pulls in `.svg` components
 * through Vite), so this pins the *lookup shape* `Socials.astro` uses, against
 * a plain literal keyed the same way. Same standing as the registry fixture
 * above: it proves the pattern, not that file.
 */
const ICON_KEYS = ["github", "linkedin", "x", "facebook", "mail"];
const literalIcons = Object.fromEntries(ICON_KEYS.map((k) => [k, `ICON_${k}`]));

let iconChecked = 0;
for (const key of PROTOTYPE_KEYS) {
	iconChecked++;
	if (resolveIslandEntry(literalIcons, key) !== undefined) {
		failed++;
		err(`FAIL: social icon name "${key}" resolved on a literal icon map`);
	}
}
for (const key of ICON_KEYS) {
	iconChecked++;
	if (resolveIslandEntry(literalIcons, key) !== `ICON_${key}`) {
		failed++;
		err(`FAIL: real social icon "${key}" did not resolve`);
	}
}
if (Object.getPrototypeOf(literalIcons) === null) {
	err("FAIL: the icon fixture is no longer a plain object literal");
	process.exit(1);
}

if (failed > 0) {
	err(`\n${failed} island-guard check(s) failed`);
	process.exit(1);
}

out(
	`OK: ${checked} blog slug cases (${negatives} rejected, ${positives} accepted, ${crossCollection} cross-collection), ${corpusChecked} corpus slugs accepted, ${pageChecked} page slug cases (${pageNegatives} rejected, ${pagePositives} accepted, ${pageCrossCollection} cross-collection), ${pageCorpusChecked} corpus page slugs accepted, ${settingsChecked} settings-path cases, ${protoChecked} island-name cases, ${iconChecked} icon-name cases`,
);
