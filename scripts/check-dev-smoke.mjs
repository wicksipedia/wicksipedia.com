/**
 * Loads real pages from a real `bun run dev` and asserts they rendered.
 *
 * Every other gate in `.claude/agent-workflow.json` is build-time. That is
 * exactly how `imageService: "compile"` came to wire `/_image` to an endpoint
 * whose first line is `import { env } from "cloudflare:workers"` — a module that
 * does not exist in Node — and survived eleven tasks and six reviewers. The
 * build never runs with `command === "dev"`, so no build-time check can reach
 * the branch that was broken. Nobody had loaded a page in dev.
 *
 * What it asserts, per URL: the expected status, and that the body carries none
 * of the error markers a dev-time render failure leaves behind. Status alone is
 * not enough — Vite answers 200 and injects an error overlay into the body, so a
 * page that is nothing but a stack trace is a 200.
 *
 * `/_image` is checked LAST and separately, against a URL taken from the
 * homepage's own `src`/`srcset` rather than a hand-written one. It is the
 * endpoint that was broken, and a hand-written URL would only prove that some
 * `/_image` request works, not that the ones this site actually emits do.
 *
 * ── WHAT THIS GATE CANNOT PROVE ───────────────────────────────────────────
 *
 * It is not a browser. It fetches documents; it does not execute them, apply a
 * content policy, or load sub-resources. The admin being served over https while
 * TinaCMS's dev server is http on :4001 made `/admin/index.html` return a
 * perfectly good 200 whose every script the browser then refused as active mixed
 * content — the CMS was completely unusable and THIS GATE WOULD HAVE PASSED.
 *
 * `checkAdminScriptSchemes` is the narrow, machine-checkable part of that:
 * whether the admin's script URLs are the same scheme as the page serving them.
 * It would have caught that specific failure. It does not make this a browser,
 * and clicking through `/admin` stays a human job.
 *
 * Run: bun run check:dev-smoke
 */

import { spawn } from "node:child_process";
import { connect } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

// Plain http, deliberately: `basicSsl()` was removed because an https admin page
// cannot load TinaCMS's http dev server on :4001. See astro.config.ts.
const ORIGIN = "http://localhost:4321";
const BOOT_TIMEOUT_MS = 180_000;

/**
 * Markers a dev render failure leaves in a 200 response.
 *
 * `cloudflare:workers` and `FailedToLoadModuleSSR` are the specific failure this
 * gate was written for; the overlay elements are the general case, since Vite
 * reports most SSR errors by injecting one rather than by changing the status.
 */
const ERROR_MARKERS = [
	"FailedToLoadModuleSSR",
	"cloudflare:workers",
	"Could not import",
	"vite-error-overlay",
	"astro-error-overlay",
	// Both spellings on purpose: the element was `astro-dev-overlay` in Astro 3
	// and is `astro-dev-toolbar` now. Matching only the old name would have made
	// the general-case half of this list quietly inert.
	"astro-dev-overlay",
	"astro-dev-toolbar",
];

/** @type {Array<{path: string, status: number, why: string}>} */
const PAGES = [
	{
		path: "/",
		status: 200,
		why: "hero avatar is an <Image>, so it hits /_image",
	},
	{ path: "/about", status: 200, why: "CMS page rendered from Tina blocks" },
	{
		path: "/blog/git-and-diffs",
		status: 200,
		why: "post with body images, the RichText + BlogImage path",
	},
	{ path: "/admin/index.html", status: 200, why: "TinaCMS admin SPA" },
	// Documented in CLAUDE.md: `/admin` redirects, `/admin/` 404s under
	// trailingSlash "never". Pinned so the documented behaviour stays true.
	{ path: "/admin", status: 302, why: "tinaAdminDevRedirect()" },
	// Reaches Astro's `/_image` endpoint module with no `href` to work on.
	//
	// 500 IS the healthy status: no `href` means `parseURL` returns undefined and
	// the endpoint throws into its own catch. What distinguishes healthy from
	// broken here is the BODY — under the `cloudflare:workers` endpoint the module
	// never loads and the 500 carries `FailedToLoadModuleSSR` instead. Measured
	// both ways.
	//
	// Kept alongside the real derivative check below rather than folded into it:
	// this one fails on a body marker and that one on status/content-type, so they
	// go red for different reasons and a change that defeats one is unlikely to
	// defeat both.
	{
		path: "/_image",
		status: 500,
		why: "proves the endpoint module itself loads under Node",
	},
];

/** @param {string} message */
const out = (message) => process.stdout.write(`${message}\n`);
/** @param {string} message */
const err = (message) => process.stderr.write(`${message}\n`);

// A gate that checks nothing passes identically to one that checks everything.
if (PAGES.length === 0) {
	err("FAIL: no URLs configured — this gate would pass without measuring");
	process.exit(1);
}

const server = spawn("bun", ["run", "dev"], {
	// Its own process group, so the whole `tinacms dev` -> `astro dev` tree can be
	// killed together. Without this a failed run strands a daemon holding 4321 and
	// the NEXT run silently attaches to it.
	detached: true,
	stdio: ["ignore", "pipe", "pipe"],
});

let serverLog = "";
server.stdout?.on("data", (chunk) => {
	serverLog += chunk;
});
server.stderr?.on("data", (chunk) => {
	serverLog += chunk;
});

let shuttingDown = false;
async function shutdown() {
	if (shuttingDown) return;
	shuttingDown = true;
	// `astro dev` DAEMONISES, so killing the process group is not sufficient on
	// its own — the daemon survives and keeps the port. `astro dev stop` is what
	// actually stops it, and it is scoped to this project by `.astro/dev.json`.
	await new Promise((resolve) => {
		const stop = spawn("bunx", ["astro", "dev", "stop"], { stdio: "ignore" });
		stop.on("close", resolve);
		stop.on("error", resolve);
	});
	try {
		// `exitCode === null` means it has not been reaped, so the pid is still
		// ours. Without it a recycled pid could in principle be signalled.
		if (server.pid && server.exitCode === null) {
			process.kill(-server.pid, "SIGTERM");
		}
	} catch {
		// Already gone. Nothing to do.
	}
	// Killing the processes is not the same as the ports being free, and the gap
	// is long enough to matter: a `bun run build` started straight after this
	// returned died with "Datalayer server is busy on port 9007" while Tina was
	// still letting go of it. Measured, not hypothetical — it cost a build.
	await waitForPortsFree();
}

/**
 * Blocks until nothing is listening on the ports this gate occupies.
 *
 * 4321 is Astro, 4001 is Tina's GraphQL server and 9007 its datalayer (pinned by
 * the `dev`/`build` scripts because another tool on this machine holds 9000).
 * A caller running a build next needs all three, so releasing them is part of
 * shutting down, not an afterthought.
 */
async function waitForPortsFree(
	ports = [4321, 4001, 9007],
	timeoutMs = 30_000,
) {
	const isFree = (port) =>
		new Promise((resolve) => {
			const socket = connect({ port, host: "127.0.0.1" });
			const done = (free) => {
				socket.destroy();
				resolve(free);
			};
			socket.once("connect", () => done(false));
			socket.once("error", () => done(true));
			socket.setTimeout(1000, () => done(true));
		});

	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const free = await Promise.all(ports.map(isFree));
		if (free.every(Boolean)) return true;
		await delay(250);
	}
	// Not a failure of the thing under test, but the next command will fail
	// mysteriously, so say it out loud rather than exiting quietly.
	err(`WARNING: ports still busy after shutdown: ${ports.join(", ")}`);
	return false;
}

// Covers a crash or a Ctrl-C in this script, not just the happy path — a red run
// must not leave a server behind either.
process.on("exit", () => {
	try {
		if (server.pid && !shuttingDown) process.kill(-server.pid, "SIGTERM");
	} catch {
		// Already gone.
	}
});
for (const signal of ["SIGINT", "SIGTERM"]) {
	process.on(signal, async () => {
		await shutdown();
		process.exit(1);
	});
}

/** Waits for the server to answer, rather than guessing at a sleep. */
async function waitForServer() {
	const deadline = Date.now() + BOOT_TIMEOUT_MS;
	while (Date.now() < deadline) {
		if (server.exitCode !== null) return false;
		try {
			const response = await fetch(ORIGIN, { redirect: "manual" });
			if (response.status > 0) return true;
		} catch {
			// Not listening yet.
		}
		await delay(500);
	}
	return false;
}

let failures = 0;
let urlsChecked = 0;

/**
 * @param {string} path
 * @param {number} expected
 * @returns {Promise<string|undefined>} the body, when it passed
 */
async function checkPage(path, expected) {
	let response;
	try {
		response = await fetch(`${ORIGIN}${path}`, { redirect: "manual" });
	} catch (error) {
		failures++;
		err(`FAIL ${path} — request threw: ${error.message}`);
		return undefined;
	}
	urlsChecked++;
	const body = await response.text();
	if (response.status !== expected) {
		failures++;
		err(`FAIL ${path} — expected ${expected}, got ${response.status}`);
		return undefined;
	}
	const found = ERROR_MARKERS.filter((marker) => body.includes(marker));
	if (found.length > 0) {
		failures++;
		err(
			`FAIL ${path} — ${response.status} but the body contains: ${found.join(", ")}`,
		);
		return undefined;
	}
	out(`  ok  ${response.status} ${path}`);
	return body;
}

/**
 * Every script URL the admin document pulls in, as written in the HTML.
 *
 * Both forms matter: TinaCMS's admin loads `@vite/client` and `src/main.tsx`
 * through `<script src>`, and `@react-refresh` through a bare `import` inside an
 * inline module. Only the first would be caught by reading `src` attributes.
 *
 * Deliberately NOT every absolute URL in the document — the admin's own
 * "failed loading assets" placeholder embeds an `https://tina.io` help link,
 * which is not a script and must not be flagged.
 *
 * @param {string} html
 */
function scriptUrlsIn(html) {
	const urls = [];
	for (const [, url] of html.matchAll(
		/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi,
	)) {
		urls.push(url);
	}
	for (const [, url] of html.matchAll(
		/\bimport\b[^'"\n]*?['"]([a-z]+:\/\/[^'"]+)['"]/gi,
	)) {
		urls.push(url);
	}
	return urls;
}

/**
 * Active mixed content, as far as it is visible without a browser.
 *
 * An https page may not load http scripts; browsers block them outright and the
 * document still returns 200, so this is invisible to a status check. That is
 * precisely how the admin shipped broken.
 *
 * @param {string} html
 */
function checkAdminScriptSchemes(html) {
	const pageProtocol = new URL(ORIGIN).protocol;
	const scripts = scriptUrlsIn(html);
	if (scripts.length === 0) {
		failures++;
		err("FAIL /admin/index.html — no script URLs found");
		err("  The admin is a SPA; a copy of it with no scripts is not a working");
		err("  admin, and an empty list here would make the scheme check vacuous.");
		return;
	}
	const downgraded = scripts.filter((url) => {
		if (!/^[a-z]+:\/\//i.test(url)) return false; // relative: same scheme by definition
		return new URL(url).protocol !== pageProtocol;
	});
	if (downgraded.length > 0) {
		failures++;
		err(
			`FAIL /admin/index.html — ${downgraded.length} script(s) are not ${pageProtocol}//`,
		);
		for (const url of downgraded) err(`    ${url}`);
		err("  A browser BLOCKS these as active mixed content and the admin never");
		err("  boots, while the document itself still returns 200. This is why");
		err("  basicSsl() was removed — see astro.config.ts.");
		return;
	}
	out(`  ok  ${scripts.length} admin script URL(s) are ${pageProtocol}//`);
}

try {
	out("Starting `bun run dev`…");
	if (!(await waitForServer())) {
		err(
			`FAIL: dev server did not answer on ${ORIGIN} within ${BOOT_TIMEOUT_MS}ms`,
		);
		err(serverLog.split("\n").slice(-25).join("\n"));
		await shutdown();
		process.exit(1);
	}

	let homepage;
	for (const page of PAGES) {
		const body = await checkPage(page.path, page.status);
		if (page.path === "/") homepage = body;
		if (page.path === "/admin/index.html" && body) {
			checkAdminScriptSchemes(body);
		}
	}

	// The endpoint this gate exists for. Taken from the homepage's own markup so
	// it is a URL the site really emits.
	if (homepage) {
		const match = homepage.match(/\/_image\?[^"' ]+/);
		if (!match) {
			failures++;
			err("FAIL: the homepage emitted no /_image URL");
			err("  Every page here renders an <Image>, so finding none means the");
			err("  page rendered without its images, not that none were needed.");
		} else {
			const imageUrl = match[0].replaceAll("&amp;", "&");
			let response;
			try {
				response = await fetch(`${ORIGIN}${imageUrl}`);
				urlsChecked++;
				const type = response.headers.get("content-type") ?? "";
				const bytes = (await response.arrayBuffer()).byteLength;
				if (
					response.status !== 200 ||
					!type.startsWith("image/") ||
					bytes === 0
				) {
					failures++;
					err(
						`FAIL /_image — ${response.status} ${type} ${bytes} B (expected 200, image/*, non-empty)`,
					);
					err(
						'  This is the endpoint `imageService: "compile"` mis-wires in dev.',
					);
				} else {
					out(
						`  ok  200 /_image (${type}, ${bytes.toLocaleString("en-US")} B)`,
					);
				}
			} catch (error) {
				failures++;
				urlsChecked++;
				err(`FAIL /_image — request threw: ${error.message}`);
			}
		}
	}
} finally {
	await shutdown();
}

// Structural: a loop that ran over nothing reports zero failures, which is what
// success looks like. This is the assertion that tells those apart.
if (urlsChecked === 0) {
	err("FAIL: checked 0 URLs");
	process.exit(1);
}

if (failures > 0) {
	err(`\n${failures} of ${urlsChecked} dev URL(s) failed`);
	process.exit(1);
}

out(
	`OK: ${urlsChecked} dev URL(s) rendered with none of: ${ERROR_MARKERS.join(", ")}`,
);
