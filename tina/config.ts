import { defineConfig } from "tinacms";
import { pageCollection } from "./collections/page";

// Branch Tina Cloud reads/writes against. CI providers expose the branch under
// different env vars; fall back to the local HEAD, then `main`.
const branch =
	process.env.GITHUB_BRANCH ||
	process.env.VERCEL_GIT_COMMIT_REF ||
	process.env.HEAD ||
	"main";

export default defineConfig({
	branch,
	// Tina Cloud credentials (set in .env locally / Cloudflare build env).
	// Empty strings keep `tinacms dev` (local filesystem mode) working without them.
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
		// Each collection lives in its own file under tina/collections/.
		collections: [pageCollection],
	},
});
