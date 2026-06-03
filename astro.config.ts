import cloudflare from "@astrojs/cloudflare";
import { unified } from "@astrojs/markdown-remark";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import {
	transformerNotationDiff,
	transformerNotationHighlight,
	transformerNotationWordHighlight,
} from "@shikijs/transformers";
import tailwindcss from "@tailwindcss/vite";
import tina from "@tinacms/astro/integration";
import { tinaAdminDevRedirect } from "@tinacms/astro/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import {
	defineConfig,
	envField,
	fontProviders,
	sessionDrivers,
} from "astro/config";
import remarkCollapse from "remark-collapse";
import remarkToc from "remark-toc";
import { SITE } from "./src/config";
import { transformerFileName } from "./src/utils/transformers/fileName";

// https://astro.build/config
export default defineConfig({
	site: SITE.website,
	trailingSlash: "never",
	// Static by default; the Cloudflare adapter serves the few on-demand routes
	// (Tina's /tina-island/[name] island-refresh endpoint) as a Worker.
	output: "static",
	// imageService "compile": Sharp-optimise images at build time (our prerendered
	// pages keep their /_astro webp output); pass through at runtime on the Worker.
	// prerenderEnvironment "node": prerender static pages in Node (not workerd) so
	// the build-time OG pipeline (satori + resvg native addon) can run. The
	// on-demand /tina-island route still executes on workerd at runtime.
	adapter: cloudflare({
		imageService: "compile",
		prerenderEnvironment: "node",
	}),

	// This site doesn't use Astro sessions. Setting any non-KV driver stops the
	// Cloudflare adapter from injecting a `SESSION` KV binding (which would
	// otherwise need a provisioned KV namespace at deploy). `memory` is never
	// actually invoked since nothing calls Astro.session.
	session: { driver: sessionDrivers.lruCache() },

	integrations: [
		sitemap({
			filter: (page) => {
				if (!SITE.showArchives && page.endsWith("/archives")) return false;
				if (page.includes("/tags")) return false;
				if (page.endsWith("/search")) return false;
				// Exclude blog pagination pages (e.g. /blog/2, /blog/3)
				if (/\/blog\/\d+$/.test(page)) return false;
				return true;
			},
		}),
		react(),
		mdx(),
		// Auto-wires Tina's edit-mode middleware and stages /admin/bridge.js.
		// No-ops on prerendered pages, so the static build is unaffected.
		tina(),
	],

	markdown: {
		// Astro 6: remark plugins + gfm/smartypants moved onto a `unified()`
		// processor (the top-level `markdown.remarkPlugins`/`gfm`/`smartypants`
		// options are deprecated). Only about.mdx still uses Astro's markdown
		// pipeline — posts render via Tina (see src/components/RichText.astro).
		processor: unified({
			gfm: true,
			smartypants: true,
			remarkPlugins: [
				remarkToc,
				[remarkCollapse, { test: "Table of contents" }],
			],
		}),
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
		// tinaAdminDevRedirect: makes a bare /admin reachable during `astro dev`.
		// externalizeResvgForWorker: the Cloudflare adapter hardcodes
		// rollupOptions.external = ["sharp"] and forces ssr.noExternal = true, so
		// resvg's native `.node` binary would be parsed into the Worker bundle and
		// break it. resvg is only used at build time (prerendered OG routes), so we
		// append it to the externals after the adapter has set its own.
		plugins: [
			tailwindcss(),
			basicSsl(),
			tinaAdminDevRedirect(),
			{
				name: "externalize-resvg-for-worker",
				enforce: "post",
				config(cfg) {
					cfg.build ??= {};
					cfg.build.rollupOptions ??= {};
					const ext = cfg.build.rollupOptions.external;
					const extras = ["@resvg/resvg-js"];
					cfg.build.rollupOptions.external = Array.isArray(ext)
						? [...ext, ...extras]
						: extras;
				},
			},
		],
		optimizeDeps: {
			exclude: ["@resvg/resvg-js"],
			// Pre-bundle Tina's middleware in the first optimize pass so Vite doesn't
			// discover it late and re-optimize (which logs "file does not exist"
			// warnings for the now-stale dep chunks on dev startup).
			include: ["@tinacms/astro/middleware"],
		},
		// Dev SSR of the island route needs Tina's bridge bundled (the Cloudflare
		// adapter forces this for the Worker build too).
		ssr: {
			noExternal: ["@tinacms/astro", "@tinacms/bridge"],
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

	// Astro 6: `fonts` and script-order are now stable (was `experimental`)
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
