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

	// --- prototype-chain: a plain object would answer these truthy from
	// Object.prototype and defeat default-deny ---
	[
		"element named after an inherited object member is dropped",
		"<div><constructor>hello</constructor></div>",
		"html",
		"<div></div>",
	],
	[
		"inherited-member element with an attribute is dropped, not thrown on",
		"<div><constructor id=x>y</constructor></div>",
		"html",
		"<div></div>",
	],
	[
		"inherited-member inline tag is dropped",
		"<constructor>",
		"html_inline",
		"",
	],
	[
		// Not a valid tag-name start, so parse5 keeps it as text and the escaper
		// neutralises it. Safe by a different route than the allowlist.
		"prototype-polluting tag name is escaped as text",
		"<div><__proto__>x</__proto__></div>",
		"html",
		"<div>&lt;__proto__&gt;x</div>",
	],

	// --- parser-level bypasses: a `/` where whitespace is expected made the
	// previous regex tokenizer fall through and emit these verbatim ---
	[
		"slash before attributes does not smuggle a script",
		'<div>\n<script/ src="https://evil.example/x.js"></script>\n</div>',
		"html",
		"<div>\n\n</div>",
	],
	[
		"slash before attributes does not smuggle an onerror",
		"<div><img/ src=x onerror=alert(1)></div>",
		"html",
		'<div><img src="x"></div>',
	],
	[
		"svg with slash-onload is dropped",
		"<div><svg/onload=alert(1)></div>",
		"html",
		"<div></div>",
	],
	[
		"unterminated tag cannot run off the end of the document",
		"<div><img src=x onerror=alert(1);//",
		"html",
		"<div></div>",
	],
	// --- url and style policy ---
	[
		"protocol-relative iframe src is dropped",
		'<iframe src="//evil.example/"></iframe>',
		"html",
		"<iframe></iframe>",
	],
	[
		"protocol-relative link href is dropped",
		'<a href="//evil.example/">x</a>',
		"html",
		"<a>x</a>",
	],
	[
		"schemeless iframe src is dropped",
		'<iframe src="/local/page"></iframe>',
		"html",
		"<iframe></iframe>",
	],
	[
		"position:fixed overlay is stripped from style",
		'<div style="position: fixed; top: 0; height: 100%;">x</div>',
		"html",
		'<div style="top: 0; height: 100%;">x</div>',
	],
	[
		"url() beacon is stripped from style",
		'<div style="background: url(https://evil.example/p.gif); height: 10px;">x</div>',
		"html",
		'<div style="height: 10px;">x</div>',
	],
	[
		// `border` IS an allowed property, so only the url() guard can catch this.
		// Without it the fixture passes on the property allowlist alone.
		"url() in an allowed style property is dropped",
		'<div style="border: url(https://evil.example/p.gif); width: 10px;">x</div>',
		"html",
		'<div style="width: 10px;">x</div>',
	],
	[
		"unknown style property is dropped",
		'<div style="behavior: url(#x); width: 10px;">x</div>',
		"html",
		'<div style="width: 10px;">x</div>',
	],
	[
		"text is escaped, never copied through",
		"<div>a &lt; b &amp; c</div>",
		"html",
		"<div>a &lt; b &amp; c</div>",
	],
	[
		"target and rel are not author-controllable",
		'<a href="https://example.com" target="_blank" rel="opener">x</a>',
		"html",
		'<a href="https://example.com">x</a>',
	],
	[
		"srcset is not an allowed attribute",
		'<img src="/a.png" srcset="//evil.example/b.png 2x">',
		"html",
		'<img src="/a.png">',
	],

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
