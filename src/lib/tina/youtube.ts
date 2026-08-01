/**
 * Validation for the YouTube rich-text block.
 *
 * Kept out of YouTubeEmbed.astro so it can be exercised directly by
 * scripts/check-sanitize.mjs. These two functions are the whole boundary between
 * a post body and the embed markup: the sanitiser no longer allows `iframe`,
 * `style` or any embed host, so a video id that passed here is the only
 * author-controlled value that reaches a URL on the page.
 */

/** YouTube ids are exactly 11 characters of URL-safe base64. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

const MAX_TITLE_LENGTH = 200;

/**
 * True only for a well-formed id. Anything else — a full URL, a path traversal,
 * a quote, trailing whitespace or a unicode look-alike — is refused, and the
 * component renders nothing rather than interpolating it into a src.
 */
export function isValidVideoId(videoId: unknown): videoId is string {
	return typeof videoId === "string" && YOUTUBE_ID.test(videoId);
}

/**
 * The caption reaches both an attribute and visible text, where Astro escapes
 * it. That escaping belongs to Astro rather than to this file, so the value is
 * additionally bounded and stripped of control characters — if it is ever
 * rendered somewhere that escapes differently, it is still not an injection
 * point, and a runaway title cannot push the page apart.
 */
export function captionFor(title: unknown): string {
	const text = typeof title === "string" ? title : "";
	return (
		text
			// biome-ignore lint/suspicious/noControlCharactersInRegex: removing them is the point
			.replace(/[\u0000-\u001f\u007f]/g, " ")
			.replace(/\s+/g, " ")
			.trim()
			.slice(0, MAX_TITLE_LENGTH) || "YouTube video"
	);
}
