import { unified } from "@astrojs/markdown-remark";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import {
	transformerNotationDiff,
	transformerNotationHighlight,
	transformerNotationWordHighlight,
} from "@shikijs/transformers";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig, envField, fontProviders } from "astro/config";
import { SITE } from "./src/config";
import { transformerFileName } from "./src/utils/transformers/fileName";

export default defineConfig({
	site: SITE.website,
	trailingSlash: "never",
	output: "static",

	integrations: [
		sitemap({
			filter: (page) => {
				if (!SITE.showArchives && page.endsWith("/archives")) return false;
				if (page.includes("/tags")) return false;
				if (page.endsWith("/search")) return false;
				if (/\/blog\/\d+$/.test(page)) return false;
				return true;
			},
		}),
		mdx(),
	],

	markdown: {
		// Astro 7 defaults to the Sätteri processor. This site's code blocks rely
		// on the remark/rehype pipeline's shikiConfig (dual themes + notation
		// transformers), so pin the old processor explicitly. Phase 1 removes this
		// entirely — post bodies stop going through Astro's Markdown pipeline.
		processor: unified({ gfm: true, smartypants: true }),
		shikiConfig: {
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
		plugins: [tailwindcss(), basicSsl()],
		optimizeDeps: {
			exclude: ["@resvg/resvg-js"],
		},
		server: {
			cors: true, // giscus iframe fetches theme CSS cross-origin
		},
	},

	image: {
		responsiveStyles: true,
		layout: "constrained",
		service: {
			entrypoint: "astro/assets/services/sharp",
			config: {
				limitInputPixels: false,
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
});
