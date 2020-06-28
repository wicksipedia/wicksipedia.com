import React from 'react'
import { Container } from 'reactstrap'
import Helmet from 'react-helmet'
import { graphql } from 'gatsby'
import Layout from '../components/layout'

export default function Template ({ data }) {
  const { markdownRemark: post } = data;

  return (
    <Layout>
      <div>
        <Helmet title={`Blog | ${post.frontmatter.title}`}>
          {data.site.siteMetadata.disqus && (
            <script id='dsq-count-scr' src='//gatsby-starter-blog.disqus.com/count.js' async />
          )}
          {data.site.siteMetadata.disqus && (
            <script>{`(function() {
          var d = document, s = d.createElement('script');
          s.src = 'https://${data.site.siteMetadata.disqus}.disqus.com/embed.js';
          s.setAttribute('data-timestamp', +new Date());
          (d.head || d.body).appendChild(s);
          })();`}</script>
          )}
        </Helmet>
        <Container>
          <h1 className='display-3'>{post.frontmatter.title}</h1>
        </Container>

        <Container dangerouslySetInnerHTML={{ __html: post.html }} />

        {data.site.siteMetadata.disqus && (<Container>
          <hr />
          <div id='disqus_thread' />
        </Container>)}
      </div>
    </Layout>
  );
}

export const pageQuery = graphql`
  query BlogPostByPath($path: String!) {
    site {
      siteMetadata {
        disqus
      }
    }
    
    markdownRemark(frontmatter: { path: { eq: $path } }) {
      html
      frontmatter {
        path
        date(formatString: "MMMM DD, YYYY")
        title
      }
    }

    allMarkdownRemark{
      edges{
        node{
          frontmatter{
            title
            path
          }
        }
      }
    }
  }
`
