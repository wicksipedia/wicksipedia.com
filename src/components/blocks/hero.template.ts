import type { Template } from "tinacms";

/**
 * The homepage masthead — name, quote tagline, job title, employer link and
 * avatar. Colocated with the component that renders it so schema and rendering
 * change together.
 *
 * The seed values in `content/pages/home.mdx` are the literal strings
 * `src/pages/index.astro` rendered before the page became CMS-driven; the
 * avatar lives under Tina's media root (`src/assets/uploads`, stored as
 * `/uploads/<file>`) rather than `src/assets/images` so an editor can swap it.
 * The media root moved out of `public/` in Task 3.3 so that <Image> can
 * optimise it — see `tina/config.ts`.
 *
 * `alt` is optional and blank on the seed document ON PURPOSE — see the comment
 * in `Hero.astro` for why `alt=""` is the correct answer there. It exists
 * because the two things that make it correct are both editable: a hero with no
 * `name` renders an image with no adjacent text, and `avatar` can be swapped for
 * something that is not a portrait at all.
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
		{
			type: "string",
			name: "alt",
			label: "Avatar Alt Text",
			description:
				"What a screen reader says in place of the image. Leave blank when the image is a portrait of the person in Name above — the name is already read out, so alt text repeats it. Fill it in when this Hero has no Name, or when the image is a logo, a screenshot, or anything else that means something on its own.",
		},
	],
};
