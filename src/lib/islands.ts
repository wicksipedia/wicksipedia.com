/**
 * Island registry — the single source of truth for every editable region the
 * Tina bridge can refresh. Each entry maps a slug under `/tina-island/...` to a
 * fetcher + component + wrapper. The dynamic `[name].ts` route reads this, so
 * adding an editable region only ever means adding one entry here.
 */
import type { IslandRegistry } from "@tinacms/astro/experimental";
import BlogBody from "@/components/islands/BlogBody.astro";
import HeroMeta from "@/components/islands/HeroMeta.astro";
import { getBlogRaw } from "@/lib/tina/posts";

// biome-ignore lint/suspicious/noExplicitAny: registry data is loosely typed
const blogPost = (data: any) => ({ post: data.data?.blog });

export const islands: IslandRegistry = {
	// Post body (rich text) — full live in-place preview.
	blog: {
		fetch: (_request, params) => getBlogRaw(params.get("slug") ?? ""),
		component: BlogBody,
		wrapper: { tag: "div" },
		propsFromData: blogPost,
	},
	// Hero metadata (title / description / date / tags) — same post doc, so it
	// refreshes alongside the body when those fields are edited.
	blogHero: {
		fetch: (_request, params) => getBlogRaw(params.get("slug") ?? ""),
		component: HeroMeta,
		wrapper: { tag: "div" },
		propsFromData: blogPost,
	},
};
