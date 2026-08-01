/**
 * Rich-text embed blocks.
 *
 * The blog collection is `format: "md"` on purpose — posts contain shell `${…}`
 * braces and `<word word>` placeholders that an MDX parser would choke on. A
 * consequence, measured rather than assumed, is that Tina's markdown parser does
 * NOT honour a rich-text field's `templates`: `<youTubeEmbed videoId="…" />`
 * comes back as a plain `html` node, where the mdx parser would have produced an
 * `mdxJsxFlowElement` that RichText's components map dispatches by name.
 *
 * So the element is recognised here and converted to that same
 * `mdxJsxFlowElement` shape, which means one component renders it either way.
 * The syntax is exactly what Tina writes for a template, so if the collection
 * ever moves to `format: "mdx"` the parser starts emitting the node directly and
 * this bridge becomes a no-op rather than something to unpick.
 *
 * Everything here is an allowlist. The only author-controlled value that reaches
 * markup is the video id, and it must match YouTube's 11-character id exactly —
 * so no URL, scheme or host is ever taken from a post. That is what let the
 * sanitiser drop `iframe`, the `style` attribute and the embed-host list.
 */

/** YouTube ids are exactly 11 characters of URL-safe base64. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

const SELF_CLOSING_ELEMENT = /^<\s*youTubeEmbed\s+([^>]*?)\/?>$/i;
const ATTRIBUTE = /([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*"([^"]*)"/g;

export type YouTubeEmbed = {
	videoId: string;
	title: string;
};

/**
 * Recognise a `<youTubeEmbed …/>` block. Returns null for anything else,
 * including a well-formed element carrying an id that is not a YouTube id, so a
 * malformed embed renders as nothing rather than as a guess.
 */
export function matchYouTubeEmbed(value: string): YouTubeEmbed | null {
	const element = value.trim().match(SELF_CLOSING_ELEMENT);
	if (!element) return null;

	const attributes = new Map<string, string>();
	for (const [, name, attributeValue] of element[1].matchAll(ATTRIBUTE)) {
		attributes.set(name.toLowerCase(), attributeValue);
	}

	const videoId = attributes.get("videoid") ?? "";
	if (!YOUTUBE_ID.test(videoId)) return null;

	return { videoId, title: attributes.get("title") ?? "YouTube video" };
}
