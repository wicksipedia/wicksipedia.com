import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import tina from "@tinacms/astro/integration";
import { tinaAdminDevRedirect } from "@tinacms/astro/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import type { AstroIntegration } from "astro";
import {
	defineConfig,
	envField,
	fontProviders,
	sessionDrivers,
} from "astro/config";
import type { PluginOption } from "vite";
import { SITE } from "./src/config";

/**
 * Puts real Sharp back into the build process.
 *
 * `imageService: "compile"` does NOT mean "Sharp at build time" on its own. The
 * adapter replaces `image.service` with `@astrojs/cloudflare/image-service-workerd`
 * (node_modules/@astrojs/cloudflare/dist/utils/image-config.js:53-59), whose
 * `transform()` returns the input buffer untouched and merely relabels the
 * format (dist/entrypoints/image-service-workerd.js:4-6). It does that even
 * when `image.service.entrypoint` is explicitly `astro/assets/services/sharp`,
 * because `hasUserImageService()` treats that exact string as "not a user
 * service" (dist/utils/image-config.js:21-23).
 *
 * What normally rescues this is the adapter's own prerenderer, whose
 * `collectStaticImages()` assigns `globalThis.astroAsset.imageService = sharp`
 * before Astro generates derivatives (dist/prerenderer.js:117-120). That
 * prerenderer is installed ONLY when `prerenderEnvironment` is "workerd"
 * (dist/index.js:362-376). This site needs `prerenderEnvironment: "node"` so
 * the OG pipeline's native resvg addon can run, so nothing restored Sharp and
 * every derivative was written as an unresized copy of its source under a
 * `.webp` name — 131.9 MB of `_astro` images, 155 `.webp` files of which 153
 * were really PNG or JPEG.
 *
 * The fix redirects `virtual:image-service` to Sharp in the `prerender` Vite
 * environment only. `image.service.entrypoint` itself is left alone, so the
 * `ssr` environment — the Worker bundle — still resolves the workerd
 * passthrough and stays Sharp-free (both environments otherwise resolve the
 * same entrypoint: astro/dist/assets/vite-plugin-assets.js:107-112). The
 * prerender bundle then installs Sharp into `globalThis.astroAsset.imageService`
 * on its first `getImage()` (astro/dist/assets/internal.js:22-33), and Astro's
 * Node-side generation step reads that same global
 * (astro/dist/assets/build/generate.js:163-169).
 *
 * Resolving it in the bundle rather than assigning the global from this file is
 * deliberate. This config module is run by Vite's module runner, so a Node-side
 * copy of the service would (a) be unreachable from `astro:build:start`, which
 * fires after the runner closes, and (b) blow up in `baseService.getURL`, which
 * reads `import.meta.env.BASE_URL` — defined inside a Vite bundle, `undefined`
 * in a plain Node import. Both were observed.
 */
function sharpAtBuildTime(): AstroIntegration {
	const SHARP = "astro/assets/services/sharp";
	return {
		name: "sharp-at-build-time",
		hooks: {
			"astro:config:setup": ({ updateConfig }) => {
				updateConfig({
					// Sharp reads `config.service.config.kernel` and
					// `config.service.config.limitInputPixels` unguarded
					// (astro/dist/assets/services/sharp.js), and the service object the
					// adapter substitutes has no `config` key at all — it drops the one
					// declared under `image.service` below. Merge it back on.
					// Integrations run after the adapter
					// (astro/dist/integrations/hooks.js:128-129 unshifts it), so this
					// lands on the adapter's replacement rather than being overwritten.
					image: { service: { config: { limitInputPixels: false } } },
					vite: {
						plugins: [
							{
								name: "sharp-image-service-in-prerender",
								// `pre` so this wins over astro:assets' own resolver.
								enforce: "pre",
								applyToEnvironment: (environment) =>
									environment.name === "prerender",
								async resolveId(id) {
									if (id !== "virtual:image-service") return;
									return await this.resolve(SHARP);
								},
							},
						],
					},
				});
			},
		},
	};
}

/**
 * Serves Tina's media root at `/uploads/*` during `astro dev`.
 *
 * `media.tina.publicFolder` is `src/assets`, not `public`, so that <Image> can
 * optimise editor uploads (see the comment in `tina/config.ts`). The cost is
 * that `/uploads/<file>` stops being a real URL — and that is the URL Tina's
 * media manager and the avatar field preview put in their `<img>` tags, because
 * `MediaModel` builds the stored src from `mediaRoot` alone.
 *
 * A rewrite rather than a file server. Vite already serves everything under the
 * project root, so `src/assets/uploads/avatar.png` is reachable at its own path;
 * this only renames the request. That hands Vite its own `fs.allow` checks,
 * content types, ETags and range support instead of a hand-rolled static handler
 * with a hand-rolled path-traversal guard — the guard being the part that would
 * have been worth getting wrong.
 *
 * `apply: "serve"` and `enforce: "pre"`: it exists only in dev, which is where
 * editing happens, and it must run before Astro's own routing turns an unknown
 * path into a 404. The built site genuinely has no `/uploads/` — a stored ref
 * that fails to resolve renders a broken image there, exactly as it would have
 * before this moved.
 */
function serveTinaUploadsInDev(): PluginOption {
	const PREFIX = "/uploads/";
	return {
		name: "serve-tina-uploads-in-dev",
		apply: "serve",
		enforce: "pre",
		configureServer(server) {
			server.middlewares.use((req, _res, next) => {
				if (req.url?.startsWith(PREFIX)) {
					req.url = `/src/assets${req.url}`;
				}
				next();
			});
		},
	};
}

export default defineConfig({
	site: SITE.website,
	trailingSlash: "never",
	// Static by default; the Cloudflare adapter serves the one on-demand route
	// (Tina's /tina-island/[name] island-refresh endpoint) as a Worker.
	output: "static",
	// imageService "compile": no runtime transform on the Worker — /_astro
	// derivatives are written at build time and served as static assets. It does
	// NOT by itself make those derivatives real: see sharpAtBuildTime() above,
	// which is what actually puts Sharp in the build process.
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
		sharpAtBuildTime(),
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
			// Keeps the admin's media thumbnails working now that the media root
			// lives under src/ — dev only; see the function's own comment.
			serveTinaUploadsInDev(),
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
		// Under the Cloudflare adapter this whole `service` object is discarded —
		// entrypoint and config both — and replaced with the workerd passthrough.
		// It is kept because it is the correct declaration for an adapter-less
		// build, and because it names the config sharpAtBuildTime() re-merges.
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
