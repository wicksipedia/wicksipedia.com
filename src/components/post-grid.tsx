import React, {FunctionComponent} from "react";
import pathUtil from "../utils/path";
import {Post} from "../utils/models";
import {Card} from "./card";

interface PostGridProps {
  posts: Post[];
}

const PostGrid: FunctionComponent<PostGridProps> = ({posts}) => (
  <>
    {posts.map((post, index) => (
      <Card
        key={index}
        title={post.frontmatter.title}
        path={pathUtil.pathToPost(post.frontmatter)}
        featuredImage={post.frontmatter.featuredImage ? post.frontmatter.featuredImage.childImageSharp : null}
        content={post.frontmatter.excerpt}
        meta={
          {
            time: post.frontmatter.created,
            timePretty: post.frontmatter.createdPretty,
            tag: post.frontmatter.tags.length > 0 ? post.frontmatter.tags[0] : null,
            timeToRead: post.timeToRead,
          }
        }
      />
    ))}
  </>
);

export default PostGrid;
