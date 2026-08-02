import type { Template } from "tinacms";

/**
 * The GitHub activity cards (`src/components/GitHubStats.astro`). Everything it
 * shows is fetched from the GitHub API at build time, so the only editable part
 * is the heading above it — which is the `## GitHub stats` h2 the hand-written
 * about page carried.
 */
export const githubStatsBlockSchema: Template = {
	name: "githubStats",
	label: "GitHub Stats",
	fields: [
		{
			type: "string",
			name: "heading",
			label: "Heading",
			// Sits in the same form as the page-level field labelled "Page
			// Heading", which is the page's <h1>. Without this line an author has
			// no in-UI signal that the two are different things.
			description:
				"The <h2> above the stats cards — a section heading inside this block, not the page's main heading. Leave blank to show the cards with no heading.",
		},
	],
};
