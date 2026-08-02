/**
 * One dynamic endpoint handling every island refetch the bridge sends. The URL
 * path (`/tina-island/blog`, `/tina-island/blogHero`, …) selects an entry from
 * the registry in `src/lib/islands.ts`.
 *
 * This endpoint is public and unauthenticated, so the visibility gate runs
 * *before* the library handler. That ordering is the whole fix: the library
 * renders first and can only report failure as a 500, and its `X-Tina-Prime`
 * branch serialises the entire document — every frontmatter field, the body and
 * the GraphQL query — into the response. Refusing up front means an unpublished
 * document is never loaded, never rendered, and never serialised.
 */
import { experimental_createIslandRoute } from "@tinacms/astro/experimental";
import type { APIRoute } from "astro";
import { islandGates, islands } from "@/lib/islands";
import { resolveIslandEntry } from "@/lib/tina/island-guard";

export const prerender = false;

const render = experimental_createIslandRoute(islands);

/** Generic, identical for every refusal — never an existence oracle. */
const notFound = () => new Response("Not Found", { status: 404 });

export const ALL: APIRoute = async (context) => {
	// Method first, so a non-POST never costs a content-backend round trip. The
	// library's own guard answers these (405) without loading anything, and
	// running the gate ahead of it would let any verb force a Tina query.
	if (context.request.method !== "POST") return render(context);

	// Unknown island, or a known island with no declared gate: refuse. Falling
	// through to `render` here would serve a new editable region with no
	// visibility check at all. `resolveIslandEntry` does the own-property check
	// that keeps `/tina-island/valueOf` and `__proto__` from resolving to
	// inherited members; both registries also carry a null prototype, so this
	// is belt and braces rather than the only thing holding.
	const name = context.params.name ?? "";
	const gate = resolveIslandEntry(islandGates, name);
	if (!gate) return notFound();

	const refusal = await gate(context.request, context.url.searchParams);
	if (refusal) {
		// The caller only ever sees a generic 404 — this is the one place the
		// reason exists, and without it a misconfigured deployment is
		// indistinguishable from a post that legitimately is not published.
		// biome-ignore lint/suspicious/noConsole: server-side diagnostic only.
		console.error(`[tina-island] refused ${name}: ${refusal}`);
		return notFound();
	}

	return render(context);
};
