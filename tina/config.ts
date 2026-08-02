import { defineConfig } from "tinacms";
import { blogCollection } from "./collections/blog";
import { pageCollection } from "./collections/page";
import { settingsCollection } from "./collections/settings";

// Branch Tina Cloud reads and writes against. CI providers expose it under
// different names; fall back to `main`.
const branch =
	process.env.GITHUB_BRANCH ||
	process.env.WORKERS_CI_BRANCH ||
	process.env.CF_PAGES_BRANCH ||
	process.env.HEAD ||
	"main";

export default defineConfig({
	branch,
	// Empty strings keep `tinacms dev` (local filesystem mode) working with no
	// credentials. Phase 4 wires the real Tina Cloud values.
	clientId: process.env.PUBLIC_TINA_CLIENT_ID ?? "",
	token: process.env.TINA_TOKEN ?? "",

	build: {
		// Admin SPA is emitted to public/admin and served at /admin.
		outputFolder: "admin",
		publicFolder: "public",
	},

	media: {
		tina: {
			mediaRoot: "uploads",
			// `src/assets`, NOT `public`. Astro copies `public/` verbatim and never
			// processes it, so an editor-uploaded image shipped at its full source
			// size: the 640x640 hero avatar was 131.6 KB of PNG rendered at 140 CSS
			// px on mobile. Under `src/` the same file goes through <Image> — see
			// `resolveUploadImage` in `src/lib/tina/images.ts`, which maps the ref
			// back to its ImageMetadata the same way blog images already were.
			//
			// Only the on-disk location moves. Tina's MediaModel joins
			// publicFolder + mediaRoot to read and write, but builds the STORED ref
			// from mediaRoot alone (`/${mediaRoot}/${file}`), so documents keep
			// saying `/uploads/<file>` and nothing needs migrating.
			//
			// The cost is that `/uploads/<file>` is no longer a real URL on the
			// built site, which is what the media manager's thumbnails and the
			// avatar field preview point at. `serveTinaUploadsInDev()` in
			// astro.config.ts puts that back for `astro dev`, where editing
			// actually happens.
			publicFolder: "src/assets",
		},
	},

	schema: {
		collections: [blogCollection, pageCollection, settingsCollection],
	},
});
