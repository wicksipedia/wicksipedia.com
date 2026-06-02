/**
 * Island registry — the single source of truth for every editable region the
 * Tina bridge can refresh. Each entry maps a slug under `/tina-island/...` to a
 * fetcher + component + wrapper. The dynamic `[name].ts` route reads this, so
 * adding an editable region only ever means adding one entry here.
 */
import type { IslandRegistry } from "@tinacms/astro/experimental";
import BlogBody from "@/components/islands/BlogBody.astro";
import { getBlogRaw } from "@/lib/tina/posts";

export const islands: IslandRegistry = {
	blog: {
		fetch: (_request, params) => getBlogRaw(params.get("slug") ?? ""),
		component: BlogBody,
		wrapper: { tag: "div" },
		propsFromData: (data) => ({
			// biome-ignore lint/suspicious/noExplicitAny: registry data is loosely typed
			post: (data as any).data?.blog,
		}),
	},
};
