import { getImage } from "astro:assets";
import type { ImageMetadata } from "astro";

/**
 * The width every `og:image` derivative is built at.
 *
 * Aspect ratio is PRESERVED — deliberately not force-cropped to the canonical
 * 1200x630. The post covers are around 2.17:1 against that box's 1.91:1, so
 * cropping would cut content unpredictably, and every platform crops to its own
 * taste regardless. The job is to hand them enough pixels at a sane weight.
 */
export const OG_IMAGE_WIDTH = 1200;

/**
 * The `og:image` / `twitter:image` derivative for a local image.
 *
 * Introduced in 72d284d for post covers, where `ogImageUrl = initOgImage.src`
 * was handing crawlers the RAW `ImageMetadata.src` — the untransformed source
 * file, 0.5-2.2 MB at up to 2978px wide. The on-page hero was always fine (it
 * goes through <Image>); the meta tag was the gap, and it is what Facebook, X,
 * LinkedIn, Slack and every other unfurler actually fetches.
 *
 * Shared rather than copied because `Layout.astro`'s site-wide default needed
 * exactly the same treatment, and two places computing the same derivative is
 * two places that can drift on format or width. Same reasoning as
 * `scripts/lib/headings.mjs` and `src/lib/tina/image-ref.ts`.
 *
 * JPEG, not WebP. Facebook and X both handle WebP now, but LinkedIn's crawler
 * has a long history of failing on it, and LinkedIn is one of the two socials in
 * `content/settings/index.json`. A card that silently does not render is worse
 * than a larger file that always does.
 *
 * `Math.min` because `getImage` will happily UPSCALE a source narrower than the
 * target — two post covers here are. `layout: "none"` because `image.layout` in
 * astro.config.ts is `constrained`, which would otherwise make `getImage` build
 * a srcSet that only `.src` is ever read from.
 */
export async function ogImageDerivative(src: ImageMetadata): Promise<string> {
	const derivative = await getImage({
		src,
		width: Math.min(OG_IMAGE_WIDTH, src.width),
		format: "jpeg",
		quality: 80,
		layout: "none",
	});
	return derivative.src;
}
