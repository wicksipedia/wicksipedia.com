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
 * `first` and the `totalCount` reconciliation are the other half of that. Tina's
 * connection resolver defaults to a page size of **50**
 * (`@tinacms/graphql`'s `query()`: `let limit = 50`), so an unparameterised call
 * would quietly stop returning pages at the 51st — and because routes are
 * inferred here, that is a page vanishing from the site with a green build. The
 * explicit `first` moves the cliff, and comparing against `totalCount` means
 * hitting it fails loudly instead of truncating.
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
	if (pages.length !== connection.totalCount) {
		throw new Error(
			`listPages: Tina returned ${pages.length} of ${connection.totalCount} pages — the connection is truncating`,
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
