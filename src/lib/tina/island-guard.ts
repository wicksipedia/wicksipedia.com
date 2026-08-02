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
 * only by the index lookup failing, not by any check on the path. That was fine
 * while `blog` was the only collection and stopped being fine in Task 2.1, which
 * added `settings`; Task 3.1 adds `page`. The allowlist below is what stands in
 * the way now, so its cross-collection cases in `scripts/check-island-guard.mjs`
 * are load-bearing rather than hypothetical.
 *
 * So: an allowlist, not a denylist. One folder segment, lowercase kebab — the
 * shape Tina's filename UI produces and the shape all 17 posts already have.
 * Anything else is refused without being interpreted.
 */

/**
 * One path segment: lowercase letters, digits and hyphens. No separators.
 *
 * Bounded at 120 characters. Unbounded, `?slug=` plus a megabyte of `a` passes
 * validation and becomes a megabyte-long relativePath handed to the datalayer;
 * the longest real slug is 40. No `m` flag, deliberately — under `/m` the `$`
 * anchors to a *line* end, so everything after the first newline goes
 * unvalidated and `about\n../settings/index` would be accepted. The control
 * character fixtures in `scripts/check-island-guard.mjs` are what make that a
 * checked property rather than a comment.
 */
export const BLOG_SLUG_PATTERN = /^[a-z0-9-]{1,120}$/;

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
 * One path segment for a `page` document: lowercase letters, digits, hyphens.
 *
 * Deliberately a second constant rather than a reuse of BLOG_SLUG_PATTERN. The
 * two allowlists describe different things — a post *folder* under
 * `src/data/blog`, and a page *file* under `content/pages` — and the page one is
 * pinned to what `pageCollection.ui.filename.slugify` can actually emit
 * (`tina/collections/page.ts`: `[^a-z0-9]+` collapsed to `-`, ends trimmed,
 * `untitled` for an empty result). Sharing one regex would silently widen
 * whichever guard the *other* collection later needed to loosen.
 *
 * Same 120-character bound and same absence of an `m` flag as
 * BLOG_SLUG_PATTERN, for the same two reasons.
 */
export const PAGE_SLUG_PATTERN = /^[a-z0-9-]{1,120}$/;

/**
 * True only for a page slug safe to interpolate into a Tina relativePath.
 *
 * `getPage` builds `${slug}.mdx`, and Tina resolves `..` inside a relativePath
 * rather than rejecting it — the same property that let
 * `/tina-island/blog?slug=../settings/index.json` reach another collection
 * before `isValidBlogSlug` existed. There are now three collections to escape
 * between, so the cross-collection cases in `scripts/check-island-guard.mjs`
 * are load-bearing rather than hypothetical.
 */
export function isValidPageSlug(
	slug: string | null | undefined,
): slug is string {
	return typeof slug === "string" && PAGE_SLUG_PATTERN.test(slug);
}

/**
 * The one document the `settings` collection holds, and the only relativePath
 * the settings islands may ever address.
 *
 * The collection is `global` with create and delete disabled, so there is
 * exactly one document and its name is a constant — there is no editorial
 * reason for this ever to come from a URL. Pinning it as an exact-match guard
 * rather than a bare string literal is what makes that a *checked* property:
 * the moment someone gives the settings island a `?path=` parameter, the guard
 * is already in the call path and refuses anything but this value.
 *
 * This matters now in a way it did not in Task 1.x. Tina resolves `..` inside a
 * relativePath rather than rejecting it, and until this collection existed the
 * only thing preventing escape from `blog` was that there was nowhere to escape
 * to. There is now.
 */
export const SETTINGS_RELATIVE_PATH = "index.json";

/**
 * True only for the settings collection's single document.
 *
 * Exact match, deliberately — not a pattern. Traversal (`../blog/…`), a
 * neighbouring collection's document, a different extension and the empty
 * string are all refused without being interpreted.
 */
export function isValidSettingsPath(
	relativePath: string | null | undefined,
): relativePath is string {
	return relativePath === SETTINGS_RELATIVE_PATH;
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
