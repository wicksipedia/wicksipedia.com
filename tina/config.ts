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
			publicFolder: "public",
		},
	},

	schema: {
		collections: [blogCollection, pageCollection, settingsCollection],
	},
});
