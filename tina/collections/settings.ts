import type { Collection } from "tinacms";

// One global document holding the editable chrome: the profile shown in the
// sidebar, header nav and social links.
// Technical site metadata (canonical URL, description, timezone, pagination)
// stays in src/config.ts — it feeds RSS/OG/sitemap and is not editorial.
//
// `icon` is a fixed option list, not free text: the value selects an imported
// SVG component from SOCIAL_ICONS in src/constants.ts, so an unknown string
// renders nothing. Adding an option here without adding the matching import
// there is the one way to break the footer from the CMS.
export const settingsCollection: Collection = {
	name: "settings",
	label: "Site Settings",
	path: "content/settings",
	format: "json",
	ui: {
		global: true,
		allowedActions: { create: false, delete: false },
	},
	fields: [
		{
			type: "object",
			name: "profile",
			label: "Profile",
			description: "Shown in the sidebar on every page.",
			fields: [
				{ type: "string", name: "name", label: "Name", required: true },
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
						"Leave blank when the avatar is a portrait beside the name.",
				},
			],
		},
		{
			type: "object",
			name: "nav",
			label: "Header Navigation",
			list: true,
			ui: { itemProps: (item) => ({ label: item?.title ?? "Link" }) },
			fields: [
				{ type: "string", name: "title", label: "Label", required: true },
				{ type: "string", name: "href", label: "URL", required: true },
			],
		},
		{
			type: "object",
			name: "socials",
			label: "Social Links",
			list: true,
			ui: { itemProps: (item) => ({ label: item?.name ?? "Social" }) },
			fields: [
				{ type: "string", name: "name", label: "Name", required: true },
				{ type: "string", name: "href", label: "URL", required: true },
				{
					type: "string",
					name: "icon",
					label: "Icon",
					options: ["github", "linkedin", "x", "facebook", "mail"],
					required: true,
				},
			],
		},
	],
};
