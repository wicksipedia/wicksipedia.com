import type { Template } from "tinacms";

/**
 * A feed of blog posts: one lead post given hero treatment, then a grid of the
 * rest, then a link out to the full archive. The posts themselves come from the
 * `blog` collection — this block only carries the chrome around them, so a page
 * cannot pin or reorder individual posts from here.
 *
 * `limit` counts the grid only, not the lead post; the seed value matches
 * `SITE.postPerIndex`, which is what the hand-written homepage sliced with.
 */
export const postFeedBlockSchema: Template = {
	name: "postFeed",
	label: "Post Feed",
	fields: [
		{ type: "string", name: "label", label: "Section Label" },
		{
			type: "number",
			name: "limit",
			label: "Posts in grid",
			description: "Excludes the lead post shown above the grid.",
		},
		{ type: "string", name: "allPostsLabel", label: "All-posts Link Label" },
		{ type: "string", name: "allPostsHref", label: "All-posts Link URL" },
	],
};
