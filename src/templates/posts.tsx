import React, {FunctionComponent} from "react";
import Layout from "../layout/layout";
import {Container} from "../components/common";
import {Post} from "../utils/models";
import styled from '@emotion/styled';
import TagList from "../components/tag-list";
import {Link} from "gatsby";
import SEO from "../components/seo";
import tw from "twin.macro";
import PostGrid from "../components/post-grid";

interface PostsPageProps {
  pathContext: {
    posts: Post[];
    postsPerPage: number;
  };
  location: Location;
}

const ArchiveLinkWrapper = styled.div`
  grid-column: 1 / -1;
  text-align: center;
`;

const ArchiveLink = styled(Link)`
  font-size: .8em;
  padding: 10px;
  border-radius: .3em;
  transition: background-color .5s;
  background-color: #f2f2f2;

  &:hover {
    background-color: #e6e6e6;
  }
`;

const Grid = styled.div`
  ${tw`p-4 grid gap-4 grid-flow-row grid-cols-1 md:grid-cols-3`}
  
  > *:first-of-type {
    ${tw`md:col-span-3`}
  }
`;

const PostsPage: FunctionComponent<PostsPageProps> = ({ pathContext, location }) => {
  const posts = pathContext.posts.slice(0, pathContext.postsPerPage);

  return (
    <Layout>
      <SEO location={location} type={`WebSite`} />
      <Container>
        <Grid>
          <PostGrid posts={posts} />
        </Grid>
        <ArchiveLinkWrapper>
          <ArchiveLink to={`/archive`}>More posts</ArchiveLink>
        </ArchiveLinkWrapper>
      </Container>
      <TagList />
    </Layout>
  );
};

export default PostsPage;
