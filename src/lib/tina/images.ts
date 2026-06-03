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

	// Posts store colocated images as `/blog/<slug>/<file>` (so the Tina editor
	// can load them). Map those back to the source file so Astro still optimises
	// them on the site; the raw URL is only used by the editor / dev middleware.
	const blogRef = ref.match(/^\/blog\/(.+\.\w+)$/);
	if (blogRef) {
		return blogImages[`/src/data/blog/${blogRef[1]}`]?.default ?? ref;
	}

	// Remote or other public/media-manager paths — serve verbatim.
	if (/^https?:\/\//i.test(ref) || ref.startsWith("/")) return ref;

	// Legacy `./file.png` relative refs (resolved against the post's folder).
	const file = ref.replace(/^\.?\//, "");
	return blogImages[`/src/data/blog/${slug}/${file}`]?.default ?? ref;
}
