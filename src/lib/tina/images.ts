import type { ImageMetadata } from "astro";

/**
 * Colocated post images live at `src/data/blog/{slug}/{file}`. Every existing
 * post references them as `./file.png` — relative, resolved against the
 * post's own folder — which is what all 17 migrated posts actually contain.
 *
 * Tina's media manager can also write absolute `/blog/<slug>/<file>` refs for
 * images added post-migration (it has no post-folder context to resolve a
 * relative path against), so that form is handled here too even though no
 * current post uses it.
 *
 * A static build cannot serve files out of `src/`, so eagerly glob every blog
 * image and map the stored ref back to its `ImageMetadata`. That lets Astro's
 * <Image> / getImage() optimise it exactly as the MDX pipeline used to, so the
 * published page still serves `/_astro/*.webp`.
 *
 * Remote URLs and media-manager paths (`/uploads/...`) pass through untouched.
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

	const blogRef = ref.match(/^\/blog\/(.+\.\w+)$/);
	if (blogRef) {
		return blogImages[`/src/data/blog/${blogRef[1]}`]?.default ?? ref;
	}

	if (/^https?:\/\//i.test(ref) || ref.startsWith("/")) return ref;

	// Legacy `./file.png` refs, resolved against the post's own folder.
	const file = ref.replace(/^\.?\//, "");
	return blogImages[`/src/data/blog/${slug}/${file}`]?.default ?? ref;
}
