/**
 * The `page` collection — CMS-authored pages assembled from blocks.
 *
 * Routes are INFERRED from this collection rather than declared: Task 3.2's
 * `src/pages/[...slug].astro` builds `getStaticPaths()` from `listPages()`, so
 * creating a page in the admin publishes it with no code change. `home` is the
 * exception — it renders at `/` via `src/pages/index.astro`, so the catch-all
 * filters it out.
 */
import { requestWithMetadata } from "@tinacms/astro/data";
import client from "../../../tina/__generated__/client";

/**
 * One page document, metadata-tagged for visual editing.
 *
 * CALLERS MUST VALIDATE `slug`. It is interpolated straight into a
 * relativePath, and Tina *resolves* `..` rather than rejecting it — the same
 * property that made `/tina-island/blog?slug=../settings/index.json` reach
 * another collection before `isValidBlogSlug` existed. The static build is safe
 * by construction, because its only caller passes slugs that just came back
 * from `listPages()`. The moment a page slug comes off a URL — an island, an
 * endpoint — it needs an `isValidPageSlug` guard and fixtures in
 * `scripts/check-island-guard.mjs`, exactly as the blog and settings paths do.
 */
export const getPage = (slug: string) =>
	requestWithMetadata(client.queries.page({ relativePath: `${slug}.mdx` }), {
		priority: "primary",
	});

/**
 * Every page document. `src/pages/[...slug].astro` builds its routes from this,
 * so a page created in the CMS gets a route with no code change.
 *
 * Throws on an empty result for the same reason `getAllPosts` does: Tina reports
 * success on an empty collection, and a silently-empty list would drop every
 * page from the build while exiting 0.
 *
 * `first` and the `hasNextPage` assertion are the other half of that. Tina's
 * connection resolver defaults to a page size of **50**
 * (`@tinacms/graphql`'s `query()`: `let limit = 50`), so an unparameterised call
 * would quietly stop returning pages at the 51st — and because routes are
 * inferred here, that is a page vanishing from the site with a green build. The
 * explicit `first` moves the cliff; `hasNextPage` is what makes hitting it loud.
 *
 * `hasNextPage` specifically, and NOT `totalCount`. The resolver returns
 * `totalCount: edges.length` — the length of the same already-capped array it
 * hands back — so reconciling the two can never detect truncation, only an edge
 * whose node failed to hydrate. That is worth catching as well, but it is a
 * different fault, so it gets its own message. `hasNextPage` is set by the
 * database layer at the moment it stops early (`edges.length >= limit`), which
 * is the only honest signal that documents were left behind.
 */
export async function listPages() {
	const res = await client.queries.pageConnection({ first: 1000 });
	const connection = res.data.pageConnection;
	const pages = (connection.edges ?? []).flatMap((edge) =>
		edge?.node ? [edge.node] : [],
	);
	if (pages.length === 0) {
		throw new Error("listPages: Tina returned zero pages");
	}
	if (connection.pageInfo.hasNextPage) {
		throw new Error(
			`listPages: Tina truncated the page list at ${pages.length} — raise \`first\``,
		);
	}
	if (pages.length !== connection.totalCount) {
		throw new Error(
			`listPages: ${connection.totalCount - pages.length} of ${connection.totalCount} page documents failed to load`,
		);
	}
	return pages;
}

export type CmsPage = Awaited<ReturnType<typeof getPage>>["data"]["page"];
export type PageBlock = NonNullable<NonNullable<CmsPage["blocks"]>[number]>;

export type HeroBlock = Extract<PageBlock, { __typename: "PageBlocksHero" }>;
export type PostFeedBlock = Extract<
	PageBlock,
	{ __typename: "PageBlocksPostFeed" }
>;
export type ProseBlock = Extract<PageBlock, { __typename: "PageBlocksProse" }>;
export type GithubStatsBlock = Extract<
	PageBlock,
	{ __typename: "PageBlocksGithubStats" }
>;
