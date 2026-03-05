import type { CollectionEntry } from "astro:content";
import { SITE } from "@/config";

const postFilter = ({ data }: CollectionEntry<"blog">) => {
	const isPublishTimePassed =
		Date.now() >
		new Date(data.pubDatetime).getTime() - SITE.scheduledPostMargin;
	const isDraft = data.draft;
	if (isDraft && !import.meta.env.DEV) return false;
	return import.meta.env.DEV || isPublishTimePassed;
};

export default postFilter;
