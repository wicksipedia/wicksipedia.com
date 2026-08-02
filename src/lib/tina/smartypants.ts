import retextLatin from "retext-latin";
import retextSmartypants from "retext-smartypants";
import retextStringify from "retext-stringify";
import { unified } from "unified";

/**
 * Typographic punctuation for post prose.
 *
 * Astro's Markdown pipeline ran with `smartypants: true`, which applies
 * remark-smartypants — a thin wrapper around retext-smartypants with default
 * options. Post bodies no longer traverse that pipeline, so without this every
 * apostrophe, quote, dash and ellipsis on the site turned straight.
 *
 * The same retext plugin is used here, with the same defaults, so the output
 * matches what was published before. It is applied to natural-language text
 * only: retext parses prose, not Markdown, so nothing here can reinterpret
 * markup.
 *
 * KNOWN LIMIT — Tina splits a paragraph into one text node per formatting run,
 * and each is converted on its own. A quote character that opens in one node and
 * closes in another has no neighbouring context to disambiguate, so `**"hi"**`
 * can pick the wrong direction. Whole-paragraph text, which is the overwhelming
 * majority, is unaffected. Pinned in scripts/check-smartypants.mjs.
 */
const processor = unified()
	.use(retextLatin)
	.use(retextSmartypants)
	.use(retextStringify)
	.freeze();

export function smartypants(text: string): string {
	if (!text) return text;
	return String(processor.processSync(text));
}
