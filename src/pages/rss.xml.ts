import rss from "@astrojs/rss";
import { SITE } from "@/config";
import { getAllPosts } from "@/lib/tina/posts";
import { getPath } from "@/utils/getPath";
import getSortedPosts from "@/utils/getSortedPosts";

export async function GET() {
	const posts = await getAllPosts();
	const sortedPosts = getSortedPosts(posts);
	return rss({
		title: SITE.title,
		description: SITE.desc,
		site: SITE.website,
		items: sortedPosts.map(({ data, id, filePath }) => ({
			link: getPath(id, filePath),
			title: data.title,
			description: data.description,
			pubDate: new Date(data.modDatetime ?? data.pubDatetime),
		})),
	});
}
