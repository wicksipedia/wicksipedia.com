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
import { sanitizeAuthorHtml } from "../src/lib/tina/sanitize-html.ts";
import { captionFor, isValidVideoId } from "../src/lib/tina/youtube.ts";
import { BODY_FIELD } from "./lib/body-field.mjs";

const BASE = "src/data/blog";

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
		// The WHATWG parser folds `\` to `/`, so this site-relative-looking path
		// is fetched from evil.example.
		"backslash cannot smuggle a host past the protocol-relative guard",
		'<a href="/\\evil.example/phish">x</a>',
		"html",
		"<a>x</a>",
	],
	[
		"backslash beacon in an img src is dropped",
		'<img src="/\\evil.example/beacon.gif">',
		"html",
		"<img>",
	],
	[
		"doubled backslash is dropped",
		'<a href="\\\\evil.example/x">x</a>',
		"html",
		"<a>x</a>",
	],
	[
		"protocol-relative link href is dropped",
		'<a href="//evil.example/">x</a>',
		"html",
		"<a>x</a>",
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

	[
		"oversized node is refused before parsing",
		`<div>${"a".repeat(70000)}</div>`,
		"html",
		"",
	],

	// --- iframe and style are no longer expressible from a post at all ---
	[
		"iframe is dropped outright, whatever its src",
		'<iframe src="https://www.youtube.com/embed/X"></iframe>',
		"html",
		"",
	],
	[
		"iframe from any other host is dropped",
		'<iframe src="https://evil.example/x"></iframe>',
		"html",
		"",
	],
	[
		"style attribute is dropped, so no overlay and no url() beacon",
		'<div style="position: fixed; inset: 0; background: url(https://evil.example/p.gif)">x</div>',
		"html",
		"<div>x</div>",
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

/**
 * The embed is a rich-text template with a `match`, so Tina's markdown parser
 * turns the shortcode into an mdxJsxFlowElement and RichText dispatches it by
 * name. Two things are worth pinning: that the parse still produces that node
 * with the right props, and the id/title validation that is now the only
 * boundary between a post and the embed markup.
 */
const EMBED_PARSE_CASES = [
	[
		"shortcode parses to a named node with props",
		'{{< youTubeEmbed videoId="SJtuU_6mags" title="Posturr demo" >}}',
		{
			name: "youTubeEmbed",
			props: { videoId: "SJtuU_6mags", title: "Posturr demo" },
		},
	],
	[
		"a different template name is not this block",
		'{{< notAnEmbed videoId="SJtuU_6mags" >}}',
		null,
	],
	[
		"raw jsx syntax is no longer how the block is written",
		'<youTubeEmbed videoId="SJtuU_6mags" />',
		null,
	],
];

const VIDEO_ID_CASES = [
	["a real id is accepted", "SJtuU_6mags", true],
	["too short is refused", "abc", false],
	["too long is refused", "SJtuU_6mags12", false],
	["a slash is refused", "../../etc/pas", false],
	["a quote is refused", 'a"onload=x', false],
	["a full url is refused", "https://evil", false],
	["trailing newline is refused", "SJtuU_6mags\n", false],
	["a unicode look-alike is refused", "SJtuU_6magѕ", false],
	["empty is refused", "", false],
	["a non-string is refused", undefined, false],
];

const CAPTION_CASES = [
	["a normal title is kept", "Posturr demo", "Posturr demo"],
	["control characters are stripped", "a\u0000b\nc", "a b c"],
	["an empty title falls back", "", "YouTube video"],
	["a missing title falls back", undefined, "YouTube video"],
	["a runaway title is bounded", "x".repeat(500), "x".repeat(200)],
];

let failed = 0;
let checked = 0;
for (const [name, markdown, want] of EMBED_PARSE_CASES) {
	checked++;
	const node = (parseMDX(markdown, BODY_FIELD, (s) => s).children ?? []).find(
		(n) => n.type === "mdxJsxFlowElement",
	);
	const got = node ? { name: node.name, props: node.props } : null;
	if (JSON.stringify(got) !== JSON.stringify(want)) {
		failed++;
		err(`FAIL: embed parse — ${name}`);
		err(`  input:    ${markdown}`);
		err(`  expected: ${JSON.stringify(want)}`);
		err(`  actual:   ${JSON.stringify(got)}`);
	}
}

for (const [name, id, want] of VIDEO_ID_CASES) {
	checked++;
	if (isValidVideoId(id) !== want) {
		failed++;
		err(`FAIL: video id — ${name} (${JSON.stringify(id)})`);
	}
}

for (const [name, title, want] of CAPTION_CASES) {
	checked++;
	const got = captionFor(title);
	if (got !== want) {
		failed++;
		err(`FAIL: caption — ${name}`);
		err(`  expected: ${JSON.stringify(want)}`);
		err(`  actual:   ${JSON.stringify(got)}`);
	}
}

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
const EXPECTED =
	CASES.length +
	EMBED_PARSE_CASES.length +
	VIDEO_ID_CASES.length +
	CAPTION_CASES.length;
if (checked !== EXPECTED) {
	err(`FAIL: ran ${checked} of ${EXPECTED} cases`);
	process.exit(1);
}

// Deep nesting used to overflow the stack inside `clean` and get rethrown as
// "a sanitiser bug, not bad input" — killing the build, from a post body. Depth
// is input. Asserted as properties rather than an exact string, because what
// matters is that it terminates and stays bounded, not the precise truncation.
{
	checked++;
	const deep = `${"<div>".repeat(3000)}x`;
	let out;
	try {
		out = sanitizeAuthorHtml(deep, "html");
	} catch (e) {
		out = null;
		failed++;
		err(
			`FAIL: deeply nested input threw ${e.constructor.name} instead of being bounded`,
		);
	}
	if (out !== null) {
		const depth = (out.match(/<div>/g) ?? []).length;
		if (depth === 0 || depth > 101) {
			failed++;
			err(`FAIL: depth limit did not bound the output — kept ${depth} levels`);
		}
		if (out.includes("x")) {
			failed++;
			err("FAIL: content past the depth limit was kept");
		}
	}
}

// A sanitiser defect must surface, not be swallowed into an empty string: the
// walk is inside the try now, and the catch rethrows with the node named.
{
	checked++;
	const brokenPolicy = "<div><constructor id=x>y</constructor></div>";
	let outcome;
	try {
		outcome = sanitizeAuthorHtml(brokenPolicy, "html");
	} catch (e) {
		outcome = `THREW: ${e.message}`;
	}
	if (outcome !== "<div></div>") {
		failed++;
		err("FAIL: inherited-member element must be dropped without throwing");
		err(`  actual: ${JSON.stringify(outcome)}`);
	}
}

// Every html node in the real corpus must survive the sanitiser unchanged;
// if one does not, a published post is about to lose content.
let corpusNodes = 0;
let corpusEmbeds = 0;
const collect = (node, dir) => {
	if (node.type === "html" || node.type === "html_inline") {
		corpusNodes++;
		const got = sanitizeAuthorHtml(node.value, node.type);
		// Attribute whitespace may be normalised; elements, attributes and text
		// may not change. That is the invariant that matters for published posts.
		// Exact comparison, for both inline and block nodes. structureOf() used to
		// relax this for blocks, but it compared using ultrahtml — the parser the
		// sanitiser dropped for tokenizing incorrectly — so it could not be
		// trusted to notice a difference parse5 would. With `style` and `iframe`
		// gone the only thing it existed to tolerate is gone too. If a future
		// block node normalises, this fails loudly and a human decides, which is
		// right: it means published markup changed.
		if (node.value !== got) {
			failed++;
			err(`FAIL: corpus ${dir} — sanitiser altered existing content`);
			err(`  before: ${JSON.stringify(node.value).slice(0, 200)}`);
			err(`  after:  ${JSON.stringify(got).slice(0, 200)}`);
		}
		if (sanitizeAuthorHtml(got, node.type) !== got) {
			failed++;
			err(`FAIL: corpus ${dir} — sanitiser is not idempotent`);
		}
	}
	if (node.type === "mdxJsxFlowElement" && node.name === "youTubeEmbed") {
		corpusEmbeds++;
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
		parseMDX(body, BODY_FIELD, (s) => s),
		dir,
	);
}

// A loop over an empty set passes identically to success. Refuse to pass here.
// The exemption at the embed branch above could go vacuous silently — if no
// corpus node were an embed, it would prove nothing while still passing.
if (corpusEmbeds === 0) {
	err(
		`FAIL: no embed block found under ${BASE} — the embed exemption proves nothing`,
	);
	process.exit(1);
}
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
	`OK: ${checked} cases, ${corpusNodes} corpus html nodes sanitised, ${corpusEmbeds} embed block(s) parsed as templates`,
);
