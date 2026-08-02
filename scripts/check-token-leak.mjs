#!/usr/bin/env node
/**
 * Fails the build if TINA_TOKEN reaches anything a browser can fetch.
 *
 * WHY THIS EXISTS, AND WHAT IT DOES *NOT* CLAIM
 *
 * `tinacms build --content=local` generates `tina/__generated__/client.ts`
 * carrying the literal token, because the client it emits has to authenticate
 * against TinaCloud at runtime. That client is imported by
 * `src/pages/tina-island/[name].ts`, which is `prerender = false` — so the
 * token is bundled into `dist/server`, the Cloudflare Worker script.
 *
 * That was a deliberate decision (see plan Task 4.0): the Worker script is
 * server-side and is not served to browsers, and keeping the token out of it
 * entirely would mean constructing the Tina client per-request from a secret
 * binding rather than importing it. So this check does NOT assert the token is
 * absent from `dist/server`. It reports what it finds there and moves on.
 *
 * What it *does* assert is the failure that would actually matter: the token
 * appearing anywhere under `dist/client`, which is published as static assets
 * and fetchable by anyone. A single stray `import.meta.env` reference, a
 * mis-scoped `PUBLIC_` prefix, or a future component importing the generated
 * client from a prerendered page would put it there, and nothing else in this
 * repo would notice.
 *
 * ANTI-VACUITY. Three ways this could pass while measuring nothing, all closed:
 *   - no token in the environment (a local build) — reported explicitly as
 *     SKIPPED with the reason, never as a pass;
 *   - `dist/client` missing or empty — hard failure, because a check that
 *     scanned zero files is indistinguishable from a clean one;
 *   - a token too short to be distinctive — refused, since a 4-character
 *     needle would match half the bundle and "found nothing" would be luck.
 *
 * This repo has produced eleven checks that passed while measuring nothing.
 * Every number this prints is a count of something actually examined.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Progress goes through process.stdout/stderr rather than `console`, matching
// every other check script in this directory — see scripts/check-content.mjs:34.
const out = (message) => process.stdout.write(`${message}\n`);
const err = (message) => process.stderr.write(`${message}\n`);

const CLIENT_DIR = "dist/client";
const SERVER_DIR = "dist/server";
// Shorter than this and the needle stops being distinctive enough for a
// "not found" to mean anything. Real Tina tokens are far longer.
const MIN_TOKEN_LENGTH = 12;

const token = process.env.TINA_TOKEN ?? "";

if (token === "") {
	out(
		"SKIPPED: TINA_TOKEN is not set, so there is no value to search for. " +
			"This is expected for `bun run build:local` and for local builds; it is " +
			"NOT a pass. The credentialed build on Cloudflare is where this check " +
			"does its work.",
	);
	process.exit(0);
}

if (token.length < MIN_TOKEN_LENGTH) {
	err(
		`FAIL: TINA_TOKEN is ${token.length} characters, under the ${MIN_TOKEN_LENGTH}-character ` +
			"minimum this check needs to be meaningful. A needle that short would match " +
			"incidental bytes, so a clean result would prove nothing. Refusing to " +
			"report a pass it has not earned.",
	);
	process.exit(1);
}

/** Every file under `dir`, recursively. */
function filesUnder(dir) {
	const found = [];
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) found.push(...filesUnder(path));
		else found.push(path);
	}
	return found;
}

/**
 * Search as BYTES, not as a decoded string. A token could land in a file this
 * check cannot decode as UTF-8 — an image, a source map, a compressed asset —
 * and `readFileSync(path, "utf8")` would silently replace the bytes it could
 * not decode, which is exactly how a needle goes missing.
 */
const needle = Buffer.from(token, "utf8");

if (!existsSync(CLIENT_DIR)) {
	err(
		`FAIL: ${CLIENT_DIR} does not exist. Run a build first — a token check ` +
			"over a missing directory is not a pass.",
	);
	process.exit(1);
}

const clientFiles = filesUnder(CLIENT_DIR);
if (clientFiles.length === 0) {
	err(`FAIL: ${CLIENT_DIR} contains no files, so nothing was searched.`);
	process.exit(1);
}

let bytesScanned = 0;
const hits = [];
for (const path of clientFiles) {
	const buf = readFileSync(path);
	bytesScanned += buf.length;
	if (buf.includes(needle)) hits.push(path);
}

// Reported, not asserted — see the header. Knowing whether it is there keeps
// the accepted trade-off visible instead of quietly drifting.
let serverHits = 0;
let serverFiles = 0;
if (existsSync(SERVER_DIR)) {
	for (const path of filesUnder(SERVER_DIR)) {
		serverFiles++;
		if (readFileSync(path).includes(needle)) serverHits++;
	}
}

if (hits.length > 0) {
	err(
		`FAIL: TINA_TOKEN appears in ${hits.length} browser-fetchable file(s) under ${CLIENT_DIR}:`,
	);
	for (const path of hits) err(`  ${path}`);
	err(
		"\nThese are published as static assets. Anyone can fetch them. Do not " +
			"deploy this build.",
	);
	process.exit(1);
}

const mb = (bytesScanned / 1048576).toFixed(1);
out(
	`OK: TINA_TOKEN absent from all ${clientFiles.length} browser-fetchable file(s) ` +
		`under ${CLIENT_DIR} (${mb} MB scanned as bytes). ` +
		`Present in ${serverHits} of ${serverFiles} ${SERVER_DIR} file(s) — expected, ` +
		"and accepted: that is the Worker script, which is not served to browsers. " +
		"See plan Task 4.0.",
);
