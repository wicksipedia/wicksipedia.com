import type { ImageMetadata } from "astro";

/**
 * Colocated post images live at `src/data/blog/{slug}/{file}` and are referenced
 * from frontmatter/body as `./file.png`. Tina stores those refs verbatim, but a
 * static build won't serve files out of `src/`. We eagerly glob every blog image
 * so a `./`-relative ref can be resolved back to its `ImageMetadata` — which lets
 * Astro's <Image> / getImage() optimise it exactly as the MDX pipeline used to.
 *
 * Refs that are absolute URLs or site-root paths (`/uploads/...`, e.g. images
 * added via Tina's media manager) are returned as-is.
 */
const blogImages = import.meta.glob<{ default: ImageMetadata }>(
	"/src/data/blog/**/*.{png,PNG,jpg,JPG,jpeg,JPEG,webp,WEBP,gif,GIF,svg,SVG,avif,AVIF}",
	{ eager: true },
);

export function resolveBlogImage(
	slug: string,
	ref?: string | null,
): ImageMetadata | string | undefined {
	if (!ref) return undefined;
	// Remote or already-public (Tina media manager) — serve verbatim.
	if (/^https?:\/\//i.test(ref) || ref.startsWith("/")) return ref;
	const file = ref.replace(/^\.?\//, "");
	const key = `/src/data/blog/${slug}/${file}`;
	return blogImages[key]?.default ?? ref;
}
