import React, {FunctionComponent} from "react";
import Layout from "../layout/layout";
import {graphql} from "gatsby";
import {Post, Tag} from "../utils/models";
import Subheader from "../layout/subheader";
import SEO from "../components/seo";
import PostGrid from "../components/post-grid";
import { Container } from "../components/common";
import styled from "@emotion/styled";
import tw from "twin.macro";

interface TagTemplateProps {
  data: {
    tag: Tag;
    posts: {
      edges: Array<{ node: Post }>;
    }
  };
  location: Location;
}

const Grid = styled.div([
  tw`p-4 grid gap-4 grid-flow-row grid-cols-1 md:grid-cols-3`
]);

const TagTemplate: FunctionComponent<TagTemplateProps> = ({data, location}) => {
  let tag = data.tag;
  const posts = data.posts.edges.map(node => node.node);

  if (!tag && posts.length > 0) {
    tag = {
      name: posts[0].frontmatter.tags[0],
      icon: null,
      featured: false,
    };
  }

  return (
    <Layout bigHeader={false}>
      <SEO
        title={tag.name}
        location={location}
        type={`Series`}
      />
      <Subheader title={tag.name} subtitle={`${posts.length} posts`} backgroundColor={tag.color}/>
      <Container>
        <Grid>
          <PostGrid posts={posts} />
        </Grid>
      </Container>
    </Layout>
  );
};

export default TagTemplate;

export const query = graphql`
  query($tag: String!) {
    tag: tags(name: { eq: $tag }) {
      name
    }
    posts: allMarkdownRemark(
      filter: {
        fileAbsolutePath: {regex: "/(posts)/.*\\\\.md$/"},
        frontmatter: {tags: {eq: $tag}}
      },
      sort: {fields: frontmatter___created, order: DESC}
    ) {
      edges {
        node {
          id
          frontmatter {
            title
            path
            tags
            excerpt
            created
            createdPretty: created(formatString: "DD MMMM, YYYY")
            featuredImage {
              childImageSharp {
                fluid(maxWidth: 800, quality: 75) {
                  base64
                  aspectRatio
                  src
                  srcSet
                  sizes
                }
              }
            }
          }
          timeToRead
        }
      }
    }
  }
`;
