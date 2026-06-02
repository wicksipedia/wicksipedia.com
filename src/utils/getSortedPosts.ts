import type { PostEntry } from "@/lib/tina/posts";
import postFilter from "./postFilter";

const getSortedPosts = (posts: PostEntry[]) => {
	return posts
		.filter(postFilter)
		.sort(
			(a, b) =>
				Math.floor(
					new Date(b.data.modDatetime ?? b.data.pubDatetime).getTime() / 1000,
				) -
				Math.floor(
					new Date(a.data.modDatetime ?? a.data.pubDatetime).getTime() / 1000,
				),
		);
};

export default getSortedPosts;
