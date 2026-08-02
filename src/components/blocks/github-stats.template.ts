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
	fields: [{ type: "string", name: "heading", label: "Heading" }],
};
