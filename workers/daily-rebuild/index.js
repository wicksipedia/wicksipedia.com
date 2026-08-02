/**
 * Triggers a rebuild of wicksipedia.com once a day.
 *
 * WHY A DAILY REBUILD AT ALL. `src/utils/postFilter.ts` hides a post until its
 * `pubDatetime` has passed, and that decision is baked in when the site is
 * built. Without a scheduled rebuild a post dated for next Tuesday simply never
 * appears — the site would be correct on the day it was built and wrong every
 * day after.
 *
 * WHY A SEPARATE WORKER. Cloudflare Workers Builds triggers on git push and on
 * Deploy Hooks; it has no cron of its own. Workers do have Cron Triggers, and a
 * Deploy Hook is just a URL, so the smallest thing that closes the gap is a
 * Worker whose entire job is one POST. This replaces a GitHub Action that ran
 * `bun install && bun run build && wrangler deploy` — a second, independent
 * pipeline building the same commit and racing the Cloudflare one to deploy it.
 * Now there is one build path, one set of credentials, and one place to look
 * when a deploy goes wrong.
 *
 * FAILURE IS LOUD ON PURPOSE. A scheduled job that quietly stops is the worst
 * shape this could take: the site keeps serving, nothing errors, and scheduled
 * posts just silently never appear. So a non-2xx response throws rather than
 * returning — a thrown `scheduled()` handler is recorded as a failed invocation
 * in Cloudflare's observability (enabled in wrangler.jsonc), which is the only
 * signal anyone gets. Returning quietly would make a broken hook look identical
 * to a working one.
 *
 * SETUP: create the Deploy Hook on the SITE worker (Workers & Pages →
 * wicksipedia-dot-com → Settings → Deploy Hooks, branch `main`), then store its
 * URL as a secret on THIS worker:
 *
 *   cd workers/daily-rebuild
 *   bunx wrangler secret put DEPLOY_HOOK
 *   bunx wrangler deploy
 *
 * The hook URL is a bearer credential — anyone holding it can trigger a build —
 * which is why it is a secret rather than a `vars` entry.
 */
export default {
	async scheduled(event, env, _ctx) {
		if (!env.DEPLOY_HOOK) {
			// Deploying without the secret would otherwise give a Worker that runs
			// on schedule, does nothing, and reports success forever.
			throw new Error(
				"DEPLOY_HOOK secret is not set — run `wrangler secret put DEPLOY_HOOK`. " +
					"Refusing to report a successful run that triggered no build.",
			);
		}

		const response = await fetch(env.DEPLOY_HOOK, { method: "POST" });

		if (!response.ok) {
			const body = await response.text().catch(() => "<unreadable>");
			throw new Error(
				`Deploy hook returned ${response.status} ${response.statusText}: ${body.slice(0, 500)}`,
			);
		}

		// workerd has no `process.stdout`, so `console` IS the logging API here —
		// it is what Cloudflare observability captures. The check scripts in this
		// repo use process.stdout instead precisely because they run in Node.
		// biome-ignore lint/suspicious/noConsole: console is the Workers logging API
		console.log(
			`Rebuild triggered by cron ${event.cron} — hook responded ${response.status}`,
		);
	},
};
