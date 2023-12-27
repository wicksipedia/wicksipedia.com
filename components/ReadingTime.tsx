import { CoreContent } from 'pliny/utils/contentlayer';
import type { Blog } from 'contentlayer/generated';
import { HTMLAttributes } from 'react';
import { ReadTimeResults } from 'reading-time';

interface ReadingTimeProps extends HTMLAttributes<HTMLDivElement> {
	post: CoreContent<Blog>;
}

const ReadingTime = ({ post, ...rest }: ReadingTimeProps) => {
	const readingTime = post.readingTime as ReadTimeResults;
	return <div {...rest}>{Math.floor(readingTime.minutes)} mins read</div>;
};

export default ReadingTime;
