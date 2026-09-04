/**
 * The `settings` singleton — the editable site chrome (profile, nav, socials).
 *
 * Split the same way as posts.ts: a raw query, a metadata-tagging wrapper that
 * must run inside the island route's forms-store scope, and a convenience
 * getter for the static build.
 */
import { requestWithMetadata } from "@tinacms/astro/data";
import {
	isValidSettingsPath,
	SETTINGS_RELATIVE_PATH,
} from "@/lib/tina/island-guard";
import client from "../../../tina/__generated__/client";

/**
 * Untagged Tina query for the settings document.
 *
 * The parameter exists only so the guard has something to guard: no caller
 * passes it and nothing derives it from a URL. If that ever changes, the
 * exact-match check refuses a traversal before it becomes a relativePath — see
 * the note on SETTINGS_RELATIVE_PATH.
 */
export function querySettingsDocument(
	relativePath: string = SETTINGS_RELATIVE_PATH,
) {
	if (!isValidSettingsPath(relativePath)) {
		throw new Error("querySettingsDocument: refused a non-settings path");
	}
	return client.queries.settings({ relativePath });
}

/** The in-flight (or settled) result of `querySettingsDocument`. */
export type SettingsDocumentSource = ReturnType<typeof querySettingsDocument>;

/**
 * Attach the hidden Tina metadata `tinaField()` reads. Must be called inside
 * the island route's forms-store scope — that is what registers the form the
 * admin builds its Site Settings editor from.
 *
 * Deliberately not `priority: "primary"`: at most one form per page may be
 * primary and the post body already claims it. Chrome should never steal the
 * editor's opening form from the document the page is actually about.
 */
export function tagSettingsDocument(source: SettingsDocumentSource) {
	return requestWithMetadata(source);
}

/**
 * The settings document, metadata-tagged.
 *
 * Throws rather than returning an empty object. `requestWithMetadata` swallows
 * query failures and answers `{ data: {} }`, which here would render a header
 * with no nav and a footer with no socials on all 59 pages and still exit 0 —
 * the same silent-success failure mode `getAllPosts` guards against.
 */
export async function getSettings() {
	const result = await tagSettingsDocument(querySettingsDocument());
	if (!result.data?.settings) {
		throw new Error("getSettings: Tina returned no settings document");
	}
	return result;
}

export type CmsSettings = Awaited<
	ReturnType<typeof getSettings>
>["data"]["settings"];
export type CmsProfile = NonNullable<CmsSettings["profile"]>;
export type CmsNavItem = NonNullable<NonNullable<CmsSettings["nav"]>[number]>;
export type CmsSocial = NonNullable<
	NonNullable<CmsSettings["socials"]>[number]
>;
