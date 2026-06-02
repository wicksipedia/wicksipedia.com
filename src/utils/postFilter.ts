import { SITE } from "@/config";
import type { PostEntry } from "@/lib/tina/posts";

const postFilter = ({ data }: PostEntry) => {
	const isPublishTimePassed =
		Date.now() >
		new Date(data.pubDatetime).getTime() - SITE.scheduledPostMargin;
	const isDraft = data.draft;
	if (isDraft && !import.meta.env.DEV) return false;
	return import.meta.env.DEV || isPublishTimePassed;
};

export default postFilter;
