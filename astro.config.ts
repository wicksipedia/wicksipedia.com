import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";
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
import { SITE } from "./src/config";

export default defineConfig({
	site: SITE.website,
	trailingSlash: "never",
	// Static by default; the Cloudflare adapter serves the one on-demand route
	// (Tina's /tina-island/[name] island-refresh endpoint) as a Worker.
	output: "static",
	// imageService "compile": Sharp-optimise at build time so prerendered pages
	// keep their /_astro webp output, then pass through at runtime on the Worker.
	// prerenderEnvironment "node": prerender in Node, not workerd, so the
	// build-time OG pipeline (satori + the resvg native addon) can run.
	adapter: cloudflare({
		imageService: "compile",
		prerenderEnvironment: "node",
	}),

	// This site never calls Astro.session. Setting any non-KV driver stops the
	// Cloudflare adapter injecting a `SESSION` KV binding that would otherwise
	// need a provisioned namespace at deploy time.
	session: { driver: sessionDrivers.lruCache() },

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
		tina(),
	],

	// No `markdown:` block, and no mdx() integration: since Task 3.2 nothing on
	// this site flows through Astro's Markdown pipeline. Post bodies are Tina
	// rich text rendered by `src/components/RichText.astro`, and both CMS pages
	// are `.astro`. A `shikiConfig` here would govern nothing — `src/shiki.ts`
	// stays, because RichText is now the site's only highlighting path, but it is
	// imported by RichText rather than by this file.

	vite: {
		plugins: [
			tailwindcss(),
			basicSsl(),
			// Makes a bare /admin reachable during `astro dev`.
			tinaAdminDevRedirect(),
			{
				// The Cloudflare adapter hardcodes rollupOptions.external = ["sharp"]
				// and forces ssr.noExternal = true, so resvg's native `.node` binary
				// would be parsed into the Worker bundle and break it. resvg only runs
				// at build time (prerendered OG routes), so append it to the externals
				// after the adapter has set its own.
				name: "externalize-resvg-for-worker",
				enforce: "post",
				config(cfg) {
					cfg.build ??= {};
					cfg.build.rollupOptions ??= {};
					const ext = cfg.build.rollupOptions.external;
					cfg.build.rollupOptions.external = Array.isArray(ext)
						? [...ext, "@resvg/resvg-js"]
						: ["@resvg/resvg-js"];
				},
			},
		],
		optimizeDeps: {
			exclude: ["@resvg/resvg-js"],
			// Pre-bundle Tina's middleware in the first optimize pass so Vite does
			// not discover it late and re-optimize mid-session.
			include: ["@tinacms/astro/middleware"],
		},
		// Dev SSR of the island route needs Tina's bridge bundled.
		ssr: {
			noExternal: ["@tinacms/astro", "@tinacms/bridge"],
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
