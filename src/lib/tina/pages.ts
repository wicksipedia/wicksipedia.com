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
import { isValidPageSlug } from "@/lib/tina/island-guard";
import client from "../../../tina/__generated__/client";

/**
 * Untagged Tina query for one page document.
 *
 * Split from `getPage` the same way `queryBlogDocument` is split from the blog
 * getters: the island's gate has to read the document to decide whether to
 * serve it, and the island then has to hand the *same* promise to
 * `requestWithMetadata`, which must run inside the forms-store scope. One
 * network round trip, two consumers.
 *
 * The guard is not advisory. `slug` is interpolated straight into a
 * relativePath and Tina *resolves* `..` rather than rejecting it — the property
 * that made `/tina-island/blog?slug=../settings/index.json` reach another
 * collection before `isValidBlogSlug` existed. `content/pages/../settings/` is a
 * real directory, so this is not hypothetical.
 *
 * It also fires on the static build, where slugs come from `listPages()` and
 * always pass — unless someone names a page document something Tina's own
 * `slugify` cannot produce (`filename.readonly` is false, so `My_Page` is
 * typeable). Failing the build there is deliberate: such a page would render
 * fine statically and 404 on every island refresh, which is exactly the kind of
 * half-working state that ships unnoticed.
 */
export function queryPageDocument(slug: string) {
	if (!isValidPageSlug(slug)) {
		throw new Error(
			`queryPageDocument: refused page slug ${JSON.stringify(slug)}`,
		);
	}
	return client.queries.page({ relativePath: `${slug}.mdx` });
}

/** The in-flight (or settled) result of `queryPageDocument`. */
export type PageDocumentSource = ReturnType<typeof queryPageDocument>;

/**
 * Attach the hidden Tina metadata `tinaField()` reads. Must be called inside the
 * island route's forms-store scope — that is what registers the form the admin
 * builds its page editor from.
 *
 * `priority: "primary"` because on these two routes the page document IS what
 * the page is about, so it is the form the admin should open on.
 */
export function tagPageDocument(source: PageDocumentSource) {
	return requestWithMetadata(source, { priority: "primary" });
}

/** One page document, metadata-tagged for visual editing. */
export const getPage = (slug: string) =>
	tagPageDocument(queryPageDocument(slug));

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

/** The page's blocks with the nulls Tina can emit for a partial list removed. */
export function pageBlocks(page?: CmsPage | null): PageBlock[] {
	return (page?.blocks ?? []).filter((block): block is PageBlock =>
		Boolean(block),
	);
}

/**
 * Index of the hero block that owns the page's `<h1>`, or -1 if there is none.
 *
 * Exported so `PageBlocks.astro` (which decides whether to render a page-level
 * `<h1>` at all) and `Blocks.astro` (which tells each hero whether it is the
 * one) cannot disagree. Two components computing "is there a hero?" separately
 * is exactly how a page ends up with two `<h1>`s or none.
 *
 * The rule this supports, in full:
 *
 *   - no hero        → the page renders `<h1>{heading || seoTitle}</h1>`.
 *     `seoTitle` is `required: true`, so this is never empty.
 *   - one hero       → the hero renders the `<h1>`; the page renders none,
 *     wherever in the block list the hero sits. Keying on `blocks[0]` instead
 *     would give two `<h1>`s for a page whose hero is not first.
 *   - several heroes → only the first renders `<h1>`; the rest render `<h2>`,
 *     because a second masthead is a section heading, not a second page title.
 *
 * A hero with a BLANK `name` is not counted, and `Hero.astro` renders no
 * heading element for it. `name` is not `required` — a hero used as a plain
 * image band is a legitimate thing to author — and without this the page would
 * suppress its own heading in favour of an empty `<h1></h1>`: a page with no
 * accessible heading at all, which is worse than either case this rule exists
 * to prevent. Deliberately fixed here rather than by making the field required,
 * so the rendering stays correct for documents that already exist.
 *
 * So the count is exactly one for every block arrangement the CMS can produce,
 * without asking the author to know any of this.
 */
export function primaryHeroIndex(blocks: PageBlock[]): number {
	return blocks.findIndex(
		(block) => block.__typename === "PageBlocksHero" && Boolean(block.name),
	);
}

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
