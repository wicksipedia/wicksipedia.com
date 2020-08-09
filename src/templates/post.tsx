import React, {FunctionComponent} from "react";
import Layout from "../layout/layout";
import {Post, Tag} from "../utils/models";
import {Container} from "../components/common";
import styled from '@emotion/styled';
import Img from "gatsby-image";
import {graphql, Link} from "gatsby";
import slugify from "slugify";
import Bio from "../components/bio";
import Comments from "../components/comments";
import SEO from "../components/seo";
import {FaGithub} from "react-icons/fa";
import tw from "twin.macro";
import { OutboundLink } from "gatsby-plugin-google-analytics";

interface PostTemplateProps {
  data: {
    post: Post;
  };
  location: Location;
}

const PostContainer = styled(Container)`
`;

const PostContent = styled.div([
  tw`prose max-w-full shadow-xl`
]);

const PostMeta = styled.section([
  tw`flex justify-between opacity-75 text-sm`
]);

const PostFooter = styled.footer([
  tw`bg-gray-100 text-gray-600 text-sm p-4`
]);

const FooterTagLink = styled(Link)`
`;

const PostAddition = styled.section([
  tw`border-b border-gray-300 p-8`
]);

const PostAdditionContent = styled(Container)`
  display: flex;
  justify-content: space-between;
`;

const BioWrapper = styled.div([
  tw`w-1/2 sm:w-full m-auto`
]);

const PostTemplate: FunctionComponent<PostTemplateProps> = ({data, location}) => {
  const post = data.post;

  return (
    <Layout bigHeader={false}>
      <SEO
        location={location}
        title={post.frontmatter.title}
        publishedAt={post.frontmatter.created}
        updatedAt={post.frontmatter.updated}
        tags={post.frontmatter.tags}
        description={post.frontmatter.excerpt}
        image={post.frontmatter.featuredImage ? post.frontmatter.featuredImage.childImageSharp.fluid.src : null}
      />
      <PostContainer>
        <PostContent>
          <article className={`post`}>
            <div className="p-8">
              <PostMeta>
                {post.frontmatter.tags.length > 0 &&
                <Link to={`/tag/${slugify(post.frontmatter.tags[0], {lower: true})}`}>{post.frontmatter.tags[0]}</Link>
                }
                <time dateTime={post.frontmatter.created}>{post.frontmatter.createdPretty}</time>
              </PostMeta>
              <PostMeta>
                <div>{post.timeToRead} mins to read</div>
                <OutboundLink
                  href={`https://github.com/wicksipedia/wicksipedia.com/tree/main/content/${post.file.contentPath}`}
                  target="_blank"
                >
                  <FaGithub className="inline-block"/> Edit on GitHub
                </OutboundLink>
              </PostMeta>
              <h1 className="py-4 mb-0">{post.frontmatter.title}</h1>
            </div>
            {post.frontmatter.featuredImage && <Img fluid={post.frontmatter.featuredImage.childImageSharp.fluid}/>}
            <section className="p-8 sm:p-4" dangerouslySetInnerHTML={{__html: post.html}} />
            <PostFooter>
              <p>
                Published under&nbsp;
                {post.frontmatter.tags.map((tag, index) => (
                  <span key={index}>
                    <FooterTagLink to={`/tag/${slugify(tag, {lower: true})}`}>
                      {tag}
                    </FooterTagLink>
                    {post.frontmatter.tags.length > index + 1 && <>, </>}
                  </span>
                ))}
                &nbsp;on <time dateTime={post.frontmatter.created}>{post.frontmatter.createdPretty}</time>.
              </p>
              {post.frontmatter.updated && post.frontmatter.updated > post.frontmatter.created &&
              <p>Last updated on <time dateTime={post.frontmatter.updated}>{post.frontmatter.updatedPretty}</time>.</p>
              }
            </PostFooter>
          </article>
        </PostContent>
      </PostContainer>
      <PostAddition>
        <PostAdditionContent>
          <BioWrapper>
            <Bio textAlign={`center`} showName={true}/>
          </BioWrapper>
        </PostAdditionContent>
      </PostAddition>
      <Comments id={post.id}/>
    </Layout>
  );
};

export default PostTemplate;

export const query = graphql`
  query PrimaryTag($postId: String!) {
    post: markdownRemark(
      id: { eq: $postId }
    ) {
      id
      headings {
        depth
      }
      frontmatter {
        title
        path
        tags
        excerpt
        created
        createdPretty: created(formatString: "DD MMMM, YYYY")
        updated
        updatedPretty: updated(formatString: "DD MMMM, YYYY")
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
      html
      timeToRead
      file: parent {
        ... on File {
          id
          name
          contentPath: relativePath
        }
      }
    }
  }
`;
