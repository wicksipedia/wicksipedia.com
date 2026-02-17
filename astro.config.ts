import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import {
	transformerNotationDiff,
	transformerNotationHighlight,
	transformerNotationWordHighlight,
} from "@shikijs/transformers";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig, envField, fontProviders } from "astro/config";
import remarkCollapse from "remark-collapse";
import remarkToc from "remark-toc";
import { SITE } from "./src/config";
import { transformerFileName } from "./src/utils/transformers/fileName";

// https://astro.build/config
export default defineConfig({
	site: SITE.website,
	output: "static", // Explicitly set to static mode for Cloudflare Workers

	integrations: [
		sitemap({
			filter: (page) => SITE.showArchives || !page.endsWith("/archives"),
		}),
		react(),
		mdx(),
	],

	markdown: {
		remarkPlugins: [remarkToc, [remarkCollapse, { test: "Table of contents" }]],
		shikiConfig: {
			// For more themes, visit https://shiki.style/themes
			themes: { light: "min-light", dark: "night-owl" },
			defaultColor: false,
			wrap: false,
			transformers: [
				transformerFileName({ style: "v2", hideDot: false }),
				transformerNotationHighlight(),
				transformerNotationWordHighlight(),
				transformerNotationDiff({ matchAlgorithm: "v3" }),
			],
		},
	},

	vite: {
		// This will be fixed in Astro 6 with Vite 7 support
		// See: https://github.com/withastro/astro/issues/14030
		plugins: [tailwindcss(), basicSsl()],
		optimizeDeps: {
			exclude: ["@resvg/resvg-js"],
		},
		server: {
			cors: true, // Allow cross-origin requests (giscus iframe fetches theme CSS)
		},
	},

	image: {
		responsiveStyles: true,
		layout: "constrained",
		service: {
			entrypoint: "astro/assets/services/sharp",
			config: {
				limitInputPixels: false, // Disable pixel limit to pass through large images
			},
		},
	},

	env: {
		schema: {
			PUBLIC_GOOGLE_SITE_VERIFICATION: envField.string({
				access: "public",
				context: "client",
				optional: true,
			}),
		},
	},

	experimental: {
		preserveScriptOrder: true,
		fonts: [
			{
				name: "Google Sans Code",
				cssVariable: "--font-google-sans-code",
				provider: fontProviders.google(),
				fallbacks: ["monospace"],
				weights: [300, 400, 500, 600, 700],
				styles: ["normal", "italic"],
			},
			{
				name: "Source Serif 4",
				cssVariable: "--font-source-serif",
				provider: fontProviders.google(),
				fallbacks: ["Georgia", "serif"],
				weights: [400, 600, 700],
				styles: ["normal", "italic"],
			},
		],
	},
});
