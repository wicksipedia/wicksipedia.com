/**
 * What counts as a heading an author actually wrote.
 *
 * Three call sites decide whether a page has a heading — `primaryHeroIndex`
 * (`src/lib/tina/pages.ts`), `PageBlocks.astro`, and `Hero.astro` — and
 * `scripts/check-page-prose.mjs` asserts the result. They disagreed once, in the
 * gap between `Boolean(name)` and `name.trim() !== ""`: a hand-written
 * `name: "   "` made the runtime suppress the page heading and render
 * `<h1>   </h1>`, while the check trimmed it away and reported the page's
 * `seoTitle` as the heading. One `<h1>` by count, no accessible name, green
 * check. Measured in a built page.
 *
 * So the test lives once, and everything that needs it — including the check —
 * imports THIS. That is why the module has no imports of its own: it is loaded
 * by `.astro` files through Vite, and by a `.mjs` script through Node's own type
 * stripping, which resolves nothing. `src/lib/tina/pages.ts` cannot be shared
 * the same way (it pulls `tina/__generated__/client`), which is the whole reason
 * the two definitions were separate in the first place.
 */

/** An author-supplied heading, with insignificant whitespace removed. */
export const headingText = (value?: string | null): string =>
	(value ?? "").trim();

/** Whether an author-supplied heading says anything a reader could hear. */
export const hasHeadingText = (value?: string | null): boolean =>
	headingText(value) !== "";
