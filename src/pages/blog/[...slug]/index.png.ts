import type { APIRoute } from "astro";
import { SITE } from "@/config";
import { getAllPosts, type PostEntry } from "@/lib/tina/posts";
import { generateOgImageForPost } from "@/utils/generateOgImages";
import { getPath } from "@/utils/getPath";
import postFilter from "@/utils/postFilter";

export async function getStaticPaths() {
	if (!SITE.dynamicOgImage) {
		return [];
	}

	// postFilter, not a hand-rolled draft check. This route used to test
	// `!data.draft || import.meta.env.DEV`, which covered drafts but said nothing
	// about pubDatetime — so a future-dated post still emitted
	// /blog/<slug>/index.png as a public asset with its unpublished title and
	// tags rendered into the image, days or weeks before the post existed.
	// Reusing postFilter keeps SITE.scheduledPostMargin defined exactly once and
	// keeps this route's visibility rule identical to the post page's, which is
	// the only way the two stay in step. It preserves the DEV pass-through, so
	// previewing an unpublished post's OG image locally still works.
	const posts = (await getAllPosts()).filter(
		(post) => postFilter(post) && !post.data.ogImage,
	);

	return posts.map((post) => ({
		params: { slug: getPath(post.id, post.filePath, false) },
		props: post,
	}));
}

export const GET: APIRoute = async ({ props }) => {
	if (!SITE.dynamicOgImage) {
		return new Response(null, {
			status: 404,
			statusText: "Not found",
		});
	}

	const buffer = await generateOgImageForPost(props as PostEntry);
	return new Response(new Uint8Array(buffer), {
		headers: { "Content-Type": "image/png" },
	});
};
