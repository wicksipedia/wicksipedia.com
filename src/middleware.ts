import { defineMiddleware } from "astro:middleware";
import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";

/**
 * Dev-only: serve colocated blog images at their absolute, slug-qualified URL.
 *
 * Posts reference images as `/blog/<slug>/<file>` (so the TinaCMS editor can load
 * them — it resolves the stored string as-is, with no post context). The files
 * actually live in `src/data/blog/<slug>/<file>`, which `astro dev` doesn't serve.
 * This bridges the gap during development.
 *
 * In production those files are copied into `dist/client/blog/<slug>/` by the build
 * (see package.json `copy:blog-media`) and served as static assets, so this
 * middleware no-ops there — guarded by `import.meta.env.DEV` since the Worker
 * runtime can't read the source tree anyway.
 */
const IMAGE_MIME: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	webp: "image/webp",
	gif: "image/gif",
	svg: "image/svg+xml",
	avif: "image/avif",
};

const BLOG_IMAGE_RE =
	/^\/blog\/(?<rest>[^.][^?]*\.(?<ext>png|jpe?g|webp|gif|svg|avif))$/i;

export const onRequest = defineMiddleware(async (context, next) => {
	if (import.meta.env.DEV) {
		const match = context.url.pathname.match(BLOG_IMAGE_RE);
		if (match?.groups) {
			const rel = normalize(match.groups.rest).replace(/^(\.\.[/\\])+/, "");
			const file = join(process.cwd(), "src/data/blog", rel);
			try {
				const buf = await readFile(file);
				return new Response(new Uint8Array(buf), {
					headers: {
						"Content-Type":
							IMAGE_MIME[match.groups.ext.toLowerCase()] ??
							"application/octet-stream",
						"Cache-Control": "no-store",
					},
				});
			} catch {
				// Not a colocated image — fall through to normal routing.
			}
		}
	}
	return next();
});
