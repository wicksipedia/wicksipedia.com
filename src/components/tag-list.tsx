import React, {FunctionComponent} from "react";
import {graphql, Link, useStaticQuery} from "gatsby";
import Img from "gatsby-image";
import {Tag} from "../utils/models";
import slugify from "slugify";
import styled from '@emotion/styled';
import _ from "lodash";

export const TagContainer = styled.section`
  background-color: #fff;
  border-top: 1px #e5eff5 solid;
  border-bottom: 1px #e5eff5 solid;
  padding: 40px;
  margin-top: 75px;
  text-align: center;
`;

export const TagListTitle = styled.h2`
  margin: 0 0 40px;
`;

export const StyledTagList = styled.ul`
  display: flex;
  list-style-type: none;
  margin: 0;
  padding: 0;
  justify-content: center;
`;

export const StyledTag = styled.li`
  margin: 0 35px;
  transition: .5s all;

  &:hover {
    transform: scale(1.04);
  }
`;

export const TagIcon = styled.img`
  max-height: 55px;
`;

export const TagName = styled.span`
  display: block;
`;

export const TagArchiveLinkWrapper = styled.div`
  display: block;
  margin-top: 20px;
`;

export const TagArchiveLink = styled(Link)`
  font-style: italic;
  font-size: .8em;
`;


const TagList: FunctionComponent = () => {
  const tagsQuery = useStaticQuery<{
    posts: {
      edges: Array<{
        node: {
          frontmatter: {
            tags: Array<string>;
          };
        };
      }>;
    }
    allTags: { edges: Array<{node: Tag}> }
  }>(graphql`
    query Tags {
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
      allTags: allFile(filter: {sourceInstanceName: {eq: "tag-logos"}}) {
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
  `);

  const allTags = [].concat(...tagsQuery?.posts.edges.map(e => e.node.frontmatter.tags));
  const tags = _.chain(allTags).countBy().toPairs().sortBy(1).reverse().map(0).value();

  const tagLogos = tagsQuery.allTags.edges.map(e => e.node);

  return (
    <TagContainer>
      <TagListTitle>Featured Tags</TagListTitle>
      <StyledTagList>
        {_.take(tags, 6).map((tag, index) => {
          const tagLogo = tagLogos.find(l => l.name.toUpperCase() === tag.toUpperCase());
          return (
            <StyledTag key={index}>
              <Link to={`/tag/${slugify(tag, {lower: true})}`}>
                {(tagLogo && <Img fixed={tagLogo.icon.fixed}/>)}
                <TagName>{tag}</TagName>
              </Link>
            </StyledTag>
          );
        })}
      </StyledTagList>
      <TagArchiveLinkWrapper>
        <TagArchiveLink to={`/tags`}>See all tags</TagArchiveLink>
      </TagArchiveLinkWrapper>
    </TagContainer>
  );
};

export default TagList;
