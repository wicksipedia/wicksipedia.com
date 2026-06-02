// Blog content is sourced through the TinaCMS data layer (see src/lib/tina/posts.ts),
// not Astro content collections. This file only re-exports BLOG_PATH for getPath().
export { BLOG_PATH } from "@/lib/tina/posts";

export const collections = {};
