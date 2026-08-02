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
 * Remote URLs pass through untouched. Media-manager paths (`/uploads/...`) used
 * to as well — they lived in `public/`, which Astro copies verbatim — and are
 * now handled by `resolveUploadImage` below for exactly the same reason blog
 * images are handled here.
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

	// Media-manager refs reach here from post and page BODIES — RichText hands
	// every `img` node to BlogImage.astro, whatever its source. Before Task 3.3
	// they were served straight out of `public/uploads`; now they are under
	// `src/`, so falling through to the `startsWith("/")` bail below would emit
	// an `<img>` pointing at a URL the build no longer writes. No committed body
	// uses one today, which is why this is a hole and not a bug report.
	if (ref.startsWith("/uploads/")) return resolveUploadImage(ref);

	if (/^https?:\/\//i.test(ref) || ref.startsWith("/")) return ref;

	// Legacy `./file.png` refs, resolved against the post's own folder.
	const file = ref.replace(/^\.?\//, "");
	return blogImages[`/src/data/blog/${slug}/${file}`]?.default ?? ref;
}

/**
 * Images an editor uploaded through Tina's media manager.
 *
 * They are stored as `/uploads/<file>` — Tina builds that ref from `mediaRoot`
 * alone — and they now live at `src/assets/uploads/<file>`, because
 * `media.tina.publicFolder` moved from `public` to `src/assets`. `public/` is
 * copied verbatim, so an avatar uploaded there shipped at its full source size
 * whatever the viewport; under `src/` the same file goes through <Image>.
 *
 * Same shape and same reason as `resolveBlogImage`: a static build cannot serve
 * files out of `src/`, so glob the directory eagerly and map the stored ref back
 * to its `ImageMetadata`. An unresolved ref falls through as the string it
 * already was, so a document pointing at a file nobody uploaded still renders
 * (as a broken `<img>`) rather than failing the build — and callers put it
 * through `sanitizeImageSrc`, because at that point it is an unvalidated URL
 * straight from the content source.
 *
 * No `slug` argument: `mediaRoot` is one flat namespace for the whole site,
 * unlike the per-post folders `resolveBlogImage` has to resolve against.
 */
const uploadImages = import.meta.glob<{ default: ImageMetadata }>(
	"/src/assets/uploads/**/*.{png,PNG,jpg,JPG,jpeg,JPEG,webp,WEBP,gif,GIF,svg,SVG,avif,AVIF}",
	{ eager: true },
);

export function resolveUploadImage(
	ref?: string | null,
): ImageMetadata | string | undefined {
	if (!ref) return undefined;

	const uploadRef = ref.match(/^\/uploads\/(.+\.\w+)$/);
	if (!uploadRef) return ref;

	return uploadImages[`/src/assets/uploads/${uploadRef[1]}`]?.default ?? ref;
}
