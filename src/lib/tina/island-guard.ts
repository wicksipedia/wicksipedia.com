/**
 * Slug validation for the on-demand island route.
 *
 * Deliberately dependency-free so `scripts/check-island-guard.mjs` can import
 * it from plain Node. Anything that reaches for `@/config` or
 * `import.meta.env` drags in Vite-only globals and stops being unit-testable,
 * which is how a security guard ends up with no failing test behind it.
 *
 * The island route takes `slug` straight from an unauthenticated query string
 * and interpolates it into a Tina `relativePath` (`${slug}/index.md`). Tina
 * resolves `..` segments rather than rejecting them, so `../blog/git-and-diffs`
 * currently reaches the real document — escape from the collection is prevented
 * only by the index lookup failing, not by any check on the path. That is fine
 * with a single collection and stops being fine the moment a second one exists
 * (Task 2.1 adds `settings`, Task 3.1 adds `page`).
 *
 * So: an allowlist, not a denylist. One folder segment, lowercase kebab — the
 * shape Tina's filename UI produces and the shape all 17 posts already have.
 * Anything else is refused without being interpreted.
 */

/** One path segment: lowercase letters, digits and hyphens. No separators. */
export const BLOG_SLUG_PATTERN = /^[a-z0-9-]+$/;

/**
 * True only for a slug safe to interpolate into a Tina relativePath.
 *
 * Rejects, among everything else: `..` traversal, absolute paths, any encoded
 * or literal separator (URLSearchParams has already percent-decoded by the time
 * a value gets here, so `%2F` arrives as `/` and is caught), and the empty
 * string.
 */
export function isValidBlogSlug(
	slug: string | null | undefined,
): slug is string {
	return typeof slug === "string" && BLOG_SLUG_PATTERN.test(slug);
}

/**
 * Own-property lookup for a registry keyed by an untrusted URL path segment.
 *
 * A bare `registry[name]` on an object literal resolves `valueOf`, `__proto__`,
 * `hasOwnProperty`, `constructor` and friends to inherited functions. Every one
 * of those is truthy, so a "did we find an entry?" test passes and whatever
 * happens next gets a `Function` where it expected a config — an unauthenticated
 * 500 on a dozen guessable paths, and an existence oracle for free.
 *
 * Giving the registry a null prototype fixes it too, and both registries here do
 * that. This exists so the guarantee does not *depend* on remembering to: it
 * holds for a plain literal as well, which is what the next registry someone
 * adds will be.
 */
export function resolveIslandEntry<T>(
	registry: Record<string, T>,
	name: string,
): T | undefined {
	return Object.hasOwn(registry, name) ? registry[name] : undefined;
}
