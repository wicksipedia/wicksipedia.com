/**
 * Island registry — the single source of truth for every editable region the
 * Tina bridge can refresh. Each entry maps a slug under `/tina-island/...` to a
 * fetcher, a component, and a wrapper. The dynamic `[name].ts` route reads this,
 * so adding an editable region only ever means adding one entry here.
 *
 * SECURITY. `/tina-island/[name]` is an unauthenticated public POST endpoint on
 * the production Worker, and it renders whatever document the query string names.
 * The static build applies `postFilter` in `getStaticPaths`, so a draft or a
 * future-dated post simply has no page. The island path bypassed all of that and
 * rendered the document anyway — a draft body, title and description were
 * readable from `/tina-island/blog?slug=<draft>` while `/blog/<draft>` returned
 * 404. `islandGates` below closes that: every island must declare a gate, and
 * `[name].ts` refuses the request before any render when the gate says no.
 *
 * Fail closed on purpose, in three ways:
 *   - an island with no gate entry is refused, so adding a region without
 *     thinking about visibility breaks loudly instead of leaking quietly;
 *   - an unparseable slug is refused before it is interpolated into a path;
 *   - a document that fails to load at all is refused rather than rendered
 *     empty, which is what the pre-fix behaviour did (`requestWithMetadata`
 *     swallows query errors and returns `{}`).
 */
import type { IslandRegistry } from "@tinacms/astro/experimental";
import Footer from "@/components/Footer.astro";
import Header from "@/components/Header.astro";
import BlogBody from "@/components/islands/BlogBody.astro";
import PostHero from "@/components/islands/PostHero.astro";
import { isValidBlogSlug } from "@/lib/tina/island-guard";
import {
	type BlogDocumentSource,
	type BlogNode,
	normalize,
	queryBlogDocument,
	tagBlogDocument,
} from "@/lib/tina/posts";
import {
	querySettingsDocument,
	type SettingsDocumentSource,
	tagSettingsDocument,
} from "@/lib/tina/settings";
import postFilter from "@/utils/postFilter";

// biome-ignore lint/suspicious/noExplicitAny: registry data is loosely typed
const blogPost = (data: any) => ({ post: data.data?.blog });

// biome-ignore lint/suspicious/noExplicitAny: registry data is loosely typed
const settingsProps = (data: any) => ({
	settings: data.data?.settings ?? null,
});

/**
 * One Tina query per request, shared between the visibility gate and the render.
 *
 * The gate has to read the document to know whether it is a draft, and the
 * island then has to hand that *same* document to `requestWithMetadata` — which
 * must run inside the forms-store scope, so it cannot simply be moved into the
 * gate. Caching the promise keyed on the Request object means both get one
 * network round trip. Keyed weakly so nothing outlives the request.
 */
const documentCache = new WeakMap<Request, Map<string, BlogDocumentSource>>();

function blogSource(request: Request, slug: string): BlogDocumentSource {
	// Defence in depth. Today the gate has already validated this slug, and the
	// registry's `fetch` re-reads the same param from the same URL, so the two
	// cannot disagree. Asserting here means a future island whose gate reads a
	// different parameter cannot quietly query on an unvalidated string.
	//
	// Note what this does and does not promise. Thrown from the gate it is
	// caught below and logged; thrown from the registry's `fetch` the library
	// catches it and answers 500. Either way the query never happens — but it
	// is not a loud failure, so do not rely on it to surface a mistake.
	if (!isValidBlogSlug(slug)) {
		throw new Error("blogSource: refused an unvalidated slug");
	}
	let bySlug = documentCache.get(request);
	if (!bySlug) {
		bySlug = new Map();
		documentCache.set(request, bySlug);
	}
	const cached = bySlug.get(slug);
	if (cached) return cached;
	const source = queryBlogDocument(slug);
	bySlug.set(slug, source);
	return source;
}

/**
 * Same one-query-per-request trick for the settings singleton: the gate has to
 * establish the document loads, and the island then hands the *same* promise to
 * `requestWithMetadata`, which must run inside the forms-store scope.
 *
 * Note what is deliberately absent: this takes no slug, reads no search param,
 * and interpolates nothing. `querySettingsDocument` addresses one constant
 * relativePath and refuses anything else, so there is no string on the wire
 * that can steer the settings island at another collection's document.
 */
const settingsCache = new WeakMap<Request, SettingsDocumentSource>();

function settingsSource(request: Request): SettingsDocumentSource {
	const cached = settingsCache.get(request);
	if (cached) return cached;
	const source = querySettingsDocument();
	settingsCache.set(request, source);
	return source;
}

/**
 * Decides whether an island request may be served at all. Returns `null` to
 * allow; any string is the reason for a 404 (kept server-side — the response
 * body stays generic so this never becomes an oracle).
 */
export type IslandGate = (
	request: Request,
	params: URLSearchParams,
) => Promise<string | null>;

const blogGate: IslandGate = async (request, params) => {
	const slug = params.get("slug");
	if (!isValidBlogSlug(slug)) return "invalid slug";

	// Everything that touches the document stays inside one try. normalize()
	// reads `_sys` and postFilter() parses a date, so a malformed document
	// throws — outside the try that would escape as an uncaught 500 and make the
	// endpoint an existence oracle, which is exactly the property this file is
	// trying to hold.
	try {
		const result = await blogSource(request, slug);
		const node = result?.data?.blog as BlogNode | undefined;
		// Missing document, or the content backend is unreachable. Either way we
		// cannot establish that this post is public, so we do not render it.
		if (!node) return "document unavailable";

		// Reuse postFilter rather than re-deriving the rule. It owns
		// SITE.scheduledPostMargin, and a second copy of a 15-minute constant is
		// exactly how the two drift apart. It also intentionally lets drafts and
		// scheduled posts through when import.meta.env.DEV is true — matching
		// that is deliberate, because `blog/[...slug]/index.astro` filters with
		// the same function, so under `astro dev` a draft genuinely does have a
		// working page and gating the island would break previewing it. DEV is
		// false in the Cloudflare Worker bundle, so production is closed.
		if (!postFilter(normalize(node))) return "post is not published";
	} catch (error) {
		// A refused request and a broken deployment both answer 404, which is
		// right for the client and useless for whoever is on call. Without this
		// line, codegen dropping `_sys` (normalize reads `_sys.relativePath`)
		// would 404 every island request and kill the admin preview with no
		// server-side signal at all. Cloudflare observability is enabled in
		// wrangler.jsonc, so this lands somewhere it can be read. The response
		// body stays generic, so nothing here reaches the caller.
		// biome-ignore lint/suspicious/noConsole: server-side diagnostic only
		console.error("[tina-island] gate could not resolve document:", error);
		return "document unavailable";
	}

	return null;
};

/**
 * Site chrome. There is no per-document visibility question to answer here —
 * the header nav and footer socials are rendered on all 59 public pages, so
 * serving them from the island endpoint discloses nothing the site does not
 * already publish. The gate is not a formality though: it refuses when the
 * document cannot be loaded, so a broken content backend renders no header at
 * all rather than an empty one, and it leaves a server-side line saying why.
 */
const settingsGate: IslandGate = async (request) => {
	try {
		const result = await settingsSource(request);
		if (!result?.data?.settings) return "document unavailable";
	} catch (error) {
		// Same reasoning as blogGate: a refused request and a broken deployment
		// both answer 404, and without this line they are indistinguishable to
		// whoever is on call. Nothing here reaches the caller.
		// biome-ignore lint/suspicious/noConsole: server-side diagnostic only
		console.error(
			"[tina-island] settings gate could not load document:",
			error,
		);
		return "document unavailable";
	}
	return null;
};

const gates: Record<string, IslandGate> = {
	blog: blogGate,
	blogHero: blogGate,
	settings: settingsGate,
	"settings-footer": settingsGate,
};

/**
 * Gate per island name. `[name].ts` refuses any island missing from this map,
 * so a new editable region cannot ship without a visibility decision.
 *
 * Null-prototype on purpose: `name` comes straight off the URL path, and a
 * plain object literal would resolve `/tina-island/valueOf`, `__proto__`,
 * `hasOwnProperty` and friends to inherited functions. Every one of those is
 * truthy, so the lookup would pass the "is there a gate?" test and then throw
 * when called — an unauthenticated 500 on a dozen guessable paths.
 *
 * `setPrototypeOf` rather than `Object.assign(Object.create(null), …)`: the
 * latter drops the contextual type on the literal, so the entries stop being
 * checked against the registry type and their callbacks silently become `any`.
 */
export const islandGates: Record<string, IslandGate> = Object.setPrototypeOf(
	gates,
	null,
);

const registry: IslandRegistry = {
	// Post body (rich text) — full live in-place preview.
	blog: {
		fetch: (request, params) =>
			tagBlogDocument(blogSource(request, params.get("slug") ?? "")),
		component: BlogBody,
		wrapper: { tag: "div" },
		propsFromData: blogPost,
	},
	// Hero metadata (title / description / date / tags) — same document, so it
	// refreshes alongside the body when those fields change.
	blogHero: {
		fetch: (request, params) =>
			tagBlogDocument(blogSource(request, params.get("slug") ?? "")),
		component: PostHero,
		wrapper: { tag: "div" },
		propsFromData: blogPost,
	},
	// Header nav and footer socials — one document, two regions, so both refresh
	// together when a nav label or a social URL changes.
	//
	// `display: contents` on the wrapper is load-bearing, not cosmetic. The page
	// body is a full-height flex column (see global.css), and both regions depend
	// on being *direct* flex children of it: the header is stickied to the top of
	// the viewport, which constrains it to its parent's box, and the footer is
	// pushed down by an auto top margin, which needs a flex parent. An ordinary
	// generated `<div>` around either would silently unstick the header and stop
	// the footer sitting at the bottom of short pages. A `contents` box is not
	// generated at all, so the layout is the one that shipped before the island.
	settings: {
		fetch: (request) => tagSettingsDocument(settingsSource(request)),
		component: Header,
		wrapper: { tag: "div", className: "contents" },
		propsFromData: settingsProps,
	},
	"settings-footer": {
		fetch: (request) => tagSettingsDocument(settingsSource(request)),
		component: Footer,
		wrapper: { tag: "div", className: "contents" },
		propsFromData: settingsProps,
	},
};

/**
 * Null-prototype for the same reason as `islandGates`. This one is handed to
 * `experimental_createIslandRoute`, which does a bare `islands[params.name]`
 * (see `@tinacms/astro/src/island-route.ts`) — so the library still carries the
 * prototype bug, and this is what makes it unreachable rather than merely hard
 * to reach. Without it, the route ordering in `[name].ts` is the only thing
 * standing in the way, and that is one refactor from being wrong.
 */
export const islands: IslandRegistry = Object.setPrototypeOf(registry, null);
