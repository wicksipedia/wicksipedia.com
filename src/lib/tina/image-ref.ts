/**
 * Where a stored image ref points, with no dependency on Vite or Astro.
 *
 * `images.ts` cannot answer this question outside a build: it opens with an
 * `import.meta.glob`, which throws under plain Node. `scripts/check-content.mjs`
 * needs exactly the same answer to tell a referenced post image from an orphan,
 * and an orphan is not free — that glob is `eager`, so Astro emits every file it
 * matches whether or not a post links to it.
 *
 * So the mapping lives here, in a leaf module with no imports, for the reason
 * `heading-text.ts` gives for the same shape: two implementations of one rule is
 * two things that can drift, and the one that drifts is the one nobody is
 * looking at. Node's type stripping loads this file directly from the `.mjs`.
 *
 * @see images.ts for the glob this feeds, and `resolveUploadImage` for the
 * media-manager refs deliberately excluded below.
 */

/** Root of the eager glob in `images.ts`. Keys are absolute from project root. */
export const BLOG_IMAGE_ROOT = "/src/data/blog";

/**
 * The `blogImages` glob key a ref resolves to, or `undefined` when the ref is
 * not a colocated post image at all.
 *
 * `undefined` covers three genuinely different things that all mean "not a file
 * in this post's folder": a remote `https://` URL, a media-manager `/uploads/`
 * ref (whose own root is `src/assets/uploads`, handled by `resolveUploadImage`),
 * and any other absolute path, which a static build serves out of `public/`.
 * Callers that need to tell those apart check the ref themselves — this function
 * answers one question.
 *
 * @param slug the post folder a relative ref resolves against. Unused for the
 *   absolute `/blog/<slug>/<file>` form, which carries its own.
 */
export function blogImageKey(
	slug: string,
	ref?: string | null,
): string | undefined {
	if (!ref) return undefined;

	// Tina's media manager writes this form for images added post-migration: it
	// has no post-folder context to build a relative path from.
	const blogRef = ref.match(/^\/blog\/(.+\.\w+)$/);
	if (blogRef) return `${BLOG_IMAGE_ROOT}/${blogRef[1]}`;

	if (/^https?:\/\//i.test(ref) || ref.startsWith("/")) return undefined;

	// Legacy `./file.png`, resolved against the post's own folder — the form all
	// 17 migrated posts actually contain.
	return `${BLOG_IMAGE_ROOT}/${slug}/${ref.replace(/^\.?\//, "")}`;
}
