import type { APIRoute } from "astro";

/**
 * `/admin` is the CMS SPA and `/tina-island/*` is the on-demand re-render
 * endpoint for the admin preview. Neither is a page, so keep crawlers out.
 */
const rules = [
	"User-agent: *",
	"Allow: /",
	"Disallow: /admin",
	"Disallow: /tina-island/",
];

export const GET: APIRoute = ({ site }) => {
	const sitemap = new URL("sitemap-index.xml", site).href;
	const body = [...rules, "", `Sitemap: ${sitemap}`, ""].join("\n");
	return new Response(body, {
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
};
