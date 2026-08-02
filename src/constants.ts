import type { Props } from "astro";
import IconBrandX from "@/assets/icons/IconBrandX.svg";
// import IconWhatsapp from "@/assets/icons/IconWhatsapp.svg";
import IconFacebook from "@/assets/icons/IconFacebook.svg";
import IconGitHub from "@/assets/icons/IconGitHub.svg";
import IconLinkedin from "@/assets/icons/IconLinkedin.svg";
import IconMail from "@/assets/icons/IconMail.svg";

// import IconTelegram from "@/assets/icons/IconTelegram.svg";
// import IconPinterest from "@/assets/icons/IconPinterest.svg";

type GiscusProps = {
	repo: `${string}/${string}`;
	repoId: string;
	category: string;
	categoryId: string;
	mapping: string;
	reactionsEnabled: string;
	emitMetadata: string;
	inputPosition: string;
	lang: string;
	loading: string;
};

interface Social {
	name: string;
	href: string;
	linkTitle: string;
	icon: (_props: Props) => Element;
}

/**
 * Social icons by name. Which socials appear, in what order and where they
 * point is editorial and lives in the CMS (`content/settings/index.json`);
 * Tina can only store strings, so the string it stores selects a component
 * here. Keys must match the `icon` option list in tina/collections/settings.ts
 * — an icon named there but missing here renders nothing.
 *
 * The link title is derived, not stored: `${SITE.title} on ${name}`, which is
 * exactly what the hand-written SOCIALS array produced.
 *
 * Null prototype, for the same reason the island registries have one: the key
 * is an untrusted string. A bare `SOCIAL_ICONS[icon]` on an object literal
 * resolves `constructor`, `valueOf`, `__proto__` and friends to inherited
 * functions — every one of them truthy, so the "did we find an icon?" test
 * passes and Astro is handed `Object` where it expected a component. Rendered
 * from the island endpoint that is an unauthenticated 500. `Socials.astro` also
 * looks the key up with `Object.hasOwn`, so the guarantee does not rest on
 * remembering this line.
 */
export const SOCIAL_ICONS: Record<string, (_props: Props) => Element> =
	Object.setPrototypeOf(
		{
			github: IconGitHub,
			linkedin: IconLinkedin,
			x: IconBrandX,
			facebook: IconFacebook,
			mail: IconMail,
		},
		null,
	);

export const SHARE_LINKS: Social[] = [
	// {
	//   name: "WhatsApp",
	//   href: "https://wa.me/?text=",
	//   linkTitle: `Share this post via WhatsApp`,
	//   icon: IconWhatsapp,
	// },
	{
		name: "Facebook",
		href: "https://www.facebook.com/sharer.php?u=",
		linkTitle: `Share this post on Facebook`,
		icon: IconFacebook,
	},
	{
		name: "X",
		href: "https://x.com/intent/post?url=",
		linkTitle: `Share this post on X`,
		icon: IconBrandX,
	},
	{
		name: "LinkedIn",
		href: "https://www.linkedin.com/sharing/share-offsite/?url=",
		linkTitle: `Share this post on LinkedIn`,
		icon: IconLinkedin,
	},
	// {
	//   name: "Telegram",
	//   href: "https://t.me/share/url?url=",
	//   linkTitle: `Share this post via Telegram`,
	//   icon: IconTelegram,
	// },
	// {
	//   name: "Pinterest",
	//   href: "https://pinterest.com/pin/create/button/?url=",
	//   linkTitle: `Share this post on Pinterest`,
	//   icon: IconPinterest,
	// },
	// {
	//   name: "Mail",
	//   href: "mailto:?subject=See%20this%20post&body=",
	//   linkTitle: `Share this post via email`,
	//   icon: IconMail,
	// },
] as const;

export const GISCUS: GiscusProps = {
	repo: "wicksipedia/wicksipedia.com",
	repoId: "R_kgDOKZTf6Q",
	category: "Blog posts",
	categoryId: "DIC_kwDOKZTf6c4CZsAR",
	mapping: "pathname",
	reactionsEnabled: "1",
	emitMetadata: "0",
	inputPosition: "bottom",
	lang: "en",
	loading: "lazy",
};
