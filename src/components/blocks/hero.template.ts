import type { Template } from "tinacms";

/**
 * The homepage masthead — name, quote tagline, job title, employer link and
 * avatar. Colocated with the component that renders it so schema and rendering
 * change together.
 *
 * The seed values in `content/pages/home.mdx` are the literal strings
 * `src/pages/index.astro` rendered before the page became CMS-driven; the
 * avatar lives under Tina's media root (`public/uploads`) rather than
 * `src/assets/images` so an editor can swap it.
 */
export const heroBlockSchema: Template = {
	name: "hero",
	label: "Hero",
	fields: [
		{ type: "string", name: "name", label: "Name" },
		{
			type: "string",
			name: "tagline",
			label: "Tagline",
			ui: { component: "textarea" },
		},
		{ type: "string", name: "jobTitle", label: "Job Title" },
		{ type: "string", name: "organization", label: "Organisation" },
		{ type: "string", name: "organizationUrl", label: "Organisation URL" },
		{ type: "image", name: "avatar", label: "Avatar" },
	],
};
