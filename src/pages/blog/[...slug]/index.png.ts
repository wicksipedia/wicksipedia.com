import type { APIRoute } from "astro";
import { SITE } from "@/config";
import { getAllPosts, type PostEntry } from "@/lib/tina/posts";
import { generateOgImageForPost } from "@/utils/generateOgImages";
import { getPath } from "@/utils/getPath";

export async function getStaticPaths() {
	if (!SITE.dynamicOgImage) {
		return [];
	}

	const posts = (await getAllPosts()).filter(
		({ data }) => (!data.draft || import.meta.env.DEV) && !data.ogImage,
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
