/**
 * Pins the author-HTML allowlist in src/lib/tina/sanitize-html.ts.
 *
 * RichText renders `html` / `html_inline` nodes unescaped, so this sanitiser is
 * the only thing between a post body and script execution on every visitor once
 * Tina Cloud allows publishing without a commit. It is default-deny, so the
 * cases below fix both halves: attacks must be neutralised, and the raw HTML the
 * real posts depend on must survive untouched.
 *
 * Run: bun run check:sanitize
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseMDX } from "@tinacms/mdx";
import { ELEMENT_NODE, parse } from "ultrahtml";
import { sanitizeAuthorHtml } from "../src/lib/tina/sanitize-html.ts";

const BASE = "src/data/blog";
const FIELD = { type: "rich-text", name: "body", parser: { type: "markdown" } };

/** @param {string} m */
const out = (m) => process.stdout.write(`${m}\n`);
/** @param {string} m */
const err = (m) => process.stderr.write(`${m}\n`);

/** [name, input, type, expected] */
const CASES = [
	// --- attacks: must be neutralised ---
	["script block is dropped", "<script>alert(1)</script>", "html", ""],
	[
		"script nested in an allowed element is dropped",
		"<div><script>alert(1)</script></div>",
		"html",
		"<div></div>",
	],
	[
		"script text does not leak as content",
		"<div><script>document.cookie</script></div>",
		"html",
		"<div></div>",
	],
	[
		"event handler attribute is dropped",
		'<div onclick="steal()">hi</div>',
		"html",
		"<div>hi</div>",
	],
	[
		"onerror on img is dropped",
		'<img src="/x.png" onerror="alert(1)">',
		"html",
		'<img src="/x.png">',
	],
	[
		"javascript: href is dropped",
		'<a href="javascript:alert(1)">x</a>',
		"html",
		"<a>x</a>",
	],
	[
		"data: href is dropped",
		'<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
		"html",
		"<a>x</a>",
	],
	["style element is dropped", "<style>body{display:none}</style>", "html", ""],
	[
		"iframe from an unlisted host is dropped",
		'<iframe src="https://evil.example/x"></iframe>',
		"html",
		"<iframe></iframe>",
	],
	["object/embed are dropped", '<object data="x.swf"></object>', "html", ""],
	[
		"form is dropped",
		'<form action="/steal"><input name="p"></form>',
		"html",
		"",
	],
	[
		"inline tag with attributes is dropped",
		'<span onclick="x()">',
		"html_inline",
		"",
	],
	["unknown inline tag is dropped", "<script>", "html_inline", ""],
	[
		"inline tag that is really an attack is dropped",
		"<img src=x onerror=alert(1)>",
		"html_inline",
		"",
	],
	["comment is dropped", "<!-- <script>alert(1)</script> -->", "html", ""],

	// --- legitimate content the posts depend on: must survive ---
	["opening cite passes through unchanged", "<cite>", "html_inline", "<cite>"],
	[
		"closing cite passes through unchanged",
		"</cite>",
		"html_inline",
		"</cite>",
	],
	["opening kbd passes through unchanged", "<kbd>", "html_inline", "<kbd>"],
	["closing kbd passes through unchanged", "</kbd>", "html_inline", "</kbd>"],
	[
		"youtube embed survives with its attributes",
		'<div style="position: relative;"><iframe src="https://www.youtube.com/embed/X" title="v" frameborder="0" allow="accelerometer" allowfullscreen></iframe></div>',
		"html",
		'<div style="position: relative;"><iframe src="https://www.youtube.com/embed/X" title="v" frameborder="0" allow="accelerometer" allowfullscreen></iframe></div>',
	],
	[
		"relative link survives",
		'<a href="/blog/x">y</a>',
		"html",
		'<a href="/blog/x">y</a>',
	],
	[
		"https link survives",
		'<a href="https://example.com">y</a>',
		"html",
		'<a href="https://example.com">y</a>',
	],
];

let failed = 0;
let checked = 0;
for (const [name, input, type, want] of CASES) {
	checked++;
	const got = sanitizeAuthorHtml(input, type);
	if (got !== want) {
		failed++;
		err(`FAIL: ${name}`);
		err(`  input:    ${input}`);
		err(`  expected: ${JSON.stringify(want)}`);
		err(`  actual:   ${JSON.stringify(got)}`);
	}
}
if (checked !== CASES.length) {
	err(`FAIL: ran ${checked} of ${CASES.length} cases`);
	process.exit(1);
}

/** Elements, their attributes and text content — ignoring source formatting. */
function structureOf(html) {
	const parts = [];
	const visit = (n) => {
		if (n.type === ELEMENT_NODE) {
			const attrs = Object.entries(n.attributes ?? {})
				.map(([k, v]) => `${k.toLowerCase()}=${v}`)
				.sort()
				.join(",");
			parts.push(`<${n.name.toLowerCase()} ${attrs}>`);
		} else if (typeof n.value === "string" && n.value.trim()) {
			parts.push(n.value.trim().replace(/\s+/g, " "));
		}
		for (const c of n.children ?? []) visit(c);
	};
	visit(parse(html));
	return parts.join("|");
}

// Every html node in the real corpus must survive the sanitiser unchanged;
// if one does not, a published post is about to lose content.
let corpusNodes = 0;
const collect = (node, dir) => {
	if (node.type === "html" || node.type === "html_inline") {
		corpusNodes++;
		const got = sanitizeAuthorHtml(node.value, node.type);
		// Attribute whitespace may be normalised; elements, attributes and text
		// may not change. That is the invariant that matters for published posts.
		// Inline nodes are single tags returned verbatim, so they must match
		// exactly; blocks are re-serialised, so compare structure not formatting.
		const before =
			node.type === "html_inline" ? node.value : structureOf(node.value);
		const after = node.type === "html_inline" ? got : structureOf(got);
		if (before !== after) {
			failed++;
			err(`FAIL: corpus ${dir} — sanitiser altered existing content`);
			err(`  before: ${before.slice(0, 200)}`);
			err(`  after:  ${after.slice(0, 200)}`);
		}
		if (sanitizeAuthorHtml(got, node.type) !== got) {
			failed++;
			err(`FAIL: corpus ${dir} — sanitiser is not idempotent`);
		}
	}
	for (const child of node.children ?? []) collect(child, dir);
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
	collect(
		parseMDX(body, FIELD, (s) => s),
		dir,
	);
}

// A loop over an empty set passes identically to success. Refuse to pass here.
if (corpusNodes === 0) {
	err(
		`FAIL: no html nodes found under ${BASE} — the corpus check ran over nothing`,
	);
	process.exit(1);
}

if (failed > 0) {
	err(`\n${failed} sanitiser check(s) failed`);
	process.exit(1);
}
out(
	`OK: ${checked} cases and ${corpusNodes} corpus html nodes sanitise correctly`,
);
