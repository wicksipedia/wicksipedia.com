import { requestWithMetadata } from "@tinacms/astro/data";
import type { TinaRichTextContent } from "@tinacms/astro/types";
import type { ImageMetadata } from "astro";
import { SITE } from "@/config";
import client from "../../../tina/__generated__/client";
import { resolveBlogImage } from "./images";

export const BLOG_PATH = "src/data/blog";

/**
 * Normalised post shape. Deliberately mirrors `CollectionEntry<"blog">`
 * (`id` / `filePath` / `data`) so existing utils and components — getSortedPosts,
 * getUniqueTags, getPostsByGroupCondition, getPath, Card, Datetime — keep working
 * against the Tina data layer with no behavioural change.
 */
export type PostData = {
	title: string;
	description: string;
	author: string;
	pubDatetime: Date;
	modDatetime: Date | null;
	tags: string[];
	/** Colocated images resolve to ImageMetadata (optimised); remote/public stay strings. */
	ogImage: ImageMetadata | string | undefined;
	featured: boolean;
	draft: boolean;
	canonicalURL?: string;
	hideEditPost?: boolean;
	timezone?: string;
	noindex?: boolean;
};

export type PostEntry = {
	id: string;
	slug: string;
	filePath: string;
	/** Tina relativePath, e.g. `git-and-diffs/index.mdx` — used to re-query a single post. */
	relativePath: string;
	collection: "blog";
	data: PostData;
	body: TinaRichTextContent | null;
};

/** Raw Tina `Blog` node (subset we consume). */
type BlogNode = {
	title: string;
	description: string;
	pubDatetime: string;
	modDatetime?: string | null;
	author?: string | null;
	ogImage?: string | null;
	tags?: Array<string | null> | null;
	featured?: boolean | null;
	draft?: boolean | null;
	canonicalURL?: string | null;
	hideEditPost?: boolean | null;
	timezone?: string | null;
	noindex?: boolean | null;
	body?: TinaRichTextContent | null;
	_sys: { relativePath: string };
};

function normalize(node: BlogNode): PostEntry {
	const relativePath = node._sys.relativePath;
	const slug = relativePath.replace(/\/index\.mdx?$/i, "");

	return {
		id: slug,
		slug,
		relativePath,
		filePath: `${BLOG_PATH}/${relativePath}`,
		collection: "blog",
		body: node.body ?? null,
		data: {
			title: node.title,
			description: node.description,
			author: node.author ?? SITE.author,
			pubDatetime: new Date(node.pubDatetime),
			modDatetime: node.modDatetime ? new Date(node.modDatetime) : null,
			tags: (node.tags?.filter(Boolean) as string[] | undefined)?.length
				? (node.tags?.filter(Boolean) as string[])
				: ["others"],
			ogImage: resolveBlogImage(slug, node.ogImage),
			featured: node.featured ?? false,
			draft: node.draft ?? false,
			canonicalURL: node.canonicalURL ?? undefined,
			hideEditPost: node.hideEditPost ?? undefined,
			timezone: node.timezone ?? undefined,
			noindex: node.noindex ?? undefined,
		},
	};
}

/** Every post, unfiltered. Draft/scheduled filtering lives in postFilter. */
export async function getAllPosts(): Promise<PostEntry[]> {
	const res = await client.queries.blogConnection({ first: 1000 });
	const edges = res.data.blogConnection.edges ?? [];
	return edges.flatMap((edge) =>
		edge?.node ? [normalize(edge.node as BlogNode)] : [],
	);
}

/** A single post by its Tina relativePath (e.g. `git-and-diffs/index.mdx`). */
export async function getPostByPath(relativePath: string): Promise<PostEntry> {
	const res = await client.queries.blog({ relativePath });
	return normalize(res.data.blog as BlogNode);
}

/**
 * Raw, metadata-tagged query for a single post — used by the visual-editing
 * island (the result carries the hidden Tina metadata that `tinaField()` reads,
 * which the normalized PostEntry intentionally strips). `slug` is the folder
 * slug (e.g. `git-and-diffs`); files are `{slug}/index.md`.
 */
export function getBlogRaw(slug: string) {
	return requestWithMetadata(
		client.queries.blog({ relativePath: `${slug}/index.md` }),
		{ priority: "primary" },
	);
}
