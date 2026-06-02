/**
 * Single on-demand endpoint that serves every island refetch the Tina bridge
 * sends. The path (`/tina-island/blog`, …) selects an entry from the registry
 * in src/lib/islands.ts. `prerender = false` so the Cloudflare adapter renders
 * it as a Worker route; everything else stays statically prerendered.
 */
import { experimental_createIslandRoute } from "@tinacms/astro/experimental";
import type { APIRoute } from "astro";
import { islands } from "@/lib/islands";

export const prerender = false;
export const ALL: APIRoute = experimental_createIslandRoute(islands);
