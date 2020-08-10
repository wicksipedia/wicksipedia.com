import React, {FunctionComponent} from "react";
import Layout from "../layout/layout";
import {graphql} from "gatsby";
import Subheader from "../layout/subheader";
import {Tag} from "../utils/models";
import {Card} from "../components/card";
import slugify from "slugify";
import Img from "gatsby-image"; 
import styled from '@emotion/styled';
import SEO from "../components/seo";
import tw from "twin.macro";
import { Container } from "../components/common";
import _ from "lodash";

interface TagsPageProps {
  data: {
    posts: {
      edges: Array<{
        node: {
          frontmatter: {
            tags: Array<string>;
          };
        };
      }>;
    };
    allTags: {
      edges: Array<{ node: Tag }>;
    };
  };
  location: Location;
}

const TagSvgIcon = styled.img`
  max-height: 55px;
`;

const TagName = styled.p`
  margin: 0 !important;
`;

const Grid = styled.div([
  tw`p-4 grid gap-4 grid-flow-row grid-cols-1 lg:grid-cols-6`
]);

const TagsPage: FunctionComponent<TagsPageProps> = ({data, location}) => {
  
  const tags = _.uniq(_.flatten(data?.posts.edges.map(e => e.node.frontmatter.tags)));
  const tagLogos = data?.allTags.edges.map(node => node.node);

  return (
    <Layout bigHeader={false}>
      <SEO
        location={location}
        title={`Tags`}
        type={`Series`}
      />
      <Subheader title={`Tags`} subtitle={`${tags.length} tags`}/>
      <Container>
        <Grid>
          {_.sortBy(tags).map((tag, index) => {
            const tagLogo = tagLogos.find(l => l.name.toUpperCase() === tag.toUpperCase());
            return (
              <Card
                key={index}
                path={`/tag/${slugify(tag, {lower: true})}`}
                compact={true}
                style={{textAlign: 'center'}}
              >
                { tagLogo?.icon && <Img fixed={tagLogo.icon.fixed}/> }
                <TagName>
                  {tag}
                </TagName>
              </Card>
            );
          })}
        </Grid>
      </Container>
    </Layout>
  );
};

export default TagsPage;

export const query = graphql`
  query {
    posts: allMarkdownRemark(
      filter: { fileAbsolutePath: { regex: "/(posts)/.*\\\\.md$/" } }
    ) {
      edges {
        node {
          frontmatter {
            tags
          }
        }
      }
    }
    allTags: allFile(
      filter: { sourceInstanceName: { eq: "tag-logos" } }
    ) {
      edges {
        node {
          name
          icon: childImageSharp {
            fixed(height: 55) {
              ...GatsbyImageSharpFixed
            }
          }
        }
      }
    }
  }
`;
