import type { Props } from "astro";
import IconBrandX from "@/assets/icons/IconBrandX.svg";
// import IconWhatsapp from "@/assets/icons/IconWhatsapp.svg";
import IconFacebook from "@/assets/icons/IconFacebook.svg";
import IconGitHub from "@/assets/icons/IconGitHub.svg";
import IconMail from "@/assets/icons/IconMail.svg";
import IconLinkedin from "@/assets/icons/IconLinkedin.svg";
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
 */
export const SOCIAL_ICONS: Record<string, (_props: Props) => Element> = {
	github: IconGitHub,
	linkedin: IconLinkedin,
	x: IconBrandX,
	facebook: IconFacebook,
	mail: IconMail,
};

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
