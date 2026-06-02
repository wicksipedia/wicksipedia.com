import type { Collection } from "tinacms";

// Phase 0 scaffold: a single throwaway collection to prove the pipeline.
// Real collections (blog, global) arrive in later phases as sibling files.
export const pageCollection: Collection = {
	name: "page",
	label: "Pages",
	path: "content/pages",
	format: "md",
	fields: [
		{
			type: "string",
			name: "title",
			label: "Title",
			isTitle: true,
			required: true,
		},
		{
			type: "rich-text",
			name: "body",
			label: "Body",
			isBody: true,
		},
	],
};
