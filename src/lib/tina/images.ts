import type { ImageMetadata } from "astro";
import { blogImageKey } from "./image-ref";

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
 *
 * `eager` has a cost that is not obvious: an import is an emit, so EVERY file
 * this pattern matches ships, referenced or not. Astro's old MDX pipeline
 * imported only what a post linked to, so an orphaned image in a post folder was
 * free before the migration and is not now — a leftover 5.23 MB GIF was being
 * served to nobody. Keeping the glob eager is deliberate (it is what maps a
 * stored ref back to `ImageMetadata` at all); `scripts/check-content.mjs` covers
 * the cost by refusing to let an unreferenced image exist in the first place.
 *
 * The literal below is read by that check — both its root and its extension
 * list — so keep it a plain string. Vite requires that anyway.
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

	// Which file in which post folder — shared with the orphan check through
	// `image-ref.ts`, so the two cannot disagree about what a ref points at.
	const key = blogImageKey(slug, ref);
	if (key) return blogImages[key]?.default ?? ref;

	// Media-manager refs reach here from post and page BODIES — RichText hands
	// every `img` node to BlogImage.astro, whatever its source. Before Task 3.3
	// they were served straight out of `public/uploads`; now they are under
	// `src/`, so returning the ref unchanged below would emit an `<img>`
	// pointing at a URL the build no longer writes. No committed body uses one
	// today, which is why this is a hole and not a bug report.
	if (ref.startsWith("/uploads/")) return resolveUploadImage(ref);

	// Remote URLs and any other absolute path — served from `public/`, or not
	// ours at all. Unchanged, as before.
	return ref;
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
