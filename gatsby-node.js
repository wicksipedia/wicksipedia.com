const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
const slugify = require('slugify');
const pathUtils = require('./src/utils/path');
const array = require('lodash/array');

/**
 * Before booting up Gatsby make sure the content path directory exists.
 */
exports.onPreBootstrap = ({ store }) => {
  const { program } = store.getState();
  const dir = path.join(program.directory, 'content');

  if (!fs.existsSync(dir)) {
    mkdirp(dir);
  }
};

exports.createPages = async ({ graphql, actions, reporter }) => {
  const postsPerPage = 5;

  const result = await graphql(`
    query {
      pages: allMarkdownRemark(
        filter: { fileAbsolutePath: { regex: "/(\\/pages\\/).*.(md)/" } }
      ) {
        edges {
          node {
            frontmatter {
              title
              path
            }
            html
          }
        }
      }
      posts: allMarkdownRemark(
        filter: { fileAbsolutePath: { regex: "/(posts)/.*\\\\.md$/" } }
        sort: { fields: frontmatter___created, order: DESC }
      ) {
        edges {
          node {
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
              updatedPretty: created(formatString: "DD MMMM, YYYY")
              featuredImage {
                childImageSharp {
                  fluid(maxWidth: 500, maxHeight: 200, quality: 70) {
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
                contentPath: relativePath
              }
            }
          }
        }
      }
    }
  `);

  if (result.errors) {
    reporter.panic(result.errors);
  }

  const tags = [];
  const posts = result.data.posts.edges.map(node => node.node);
  const pages = result.data.pages.edges.map(node => node.node);

  // Create a route for every single post (located in `content/posts`)
  posts.forEach(post => {
    if (post.frontmatter.tags) {
      tags.push(...post.frontmatter.tags);
    }
    actions.createPage({
      path: pathUtils.pathToPost(post.frontmatter),
      component: require.resolve(`./src/templates/post.tsx`),
      context: {
        postId: post.id
      }
    });
  });

  // Create a route for every single page (located in `content/pages`)
  pages.forEach(page => {
    actions.createPage({
      path: page.frontmatter.path,
      component: require.resolve(`./src/templates/page.tsx`),
      context: {
        page
      }
    });
  });

  // Create a route for every single route (from `content/tags.yml` and the tags found in posts)
  array.uniq(tags).forEach(tag => {
    const slugified = slugify(tag, { lower: true });
    actions.createPage({
      path: `/tag/${slugified}`,
      component: require.resolve(`./src/templates/tag.tsx`),
      context: {
        tag
      }
    });
  });

  // The index page
  actions.createPage({
    path: "/",
    component: require.resolve(`./src/templates/posts.tsx`),
    context: {
      posts,
      postsPerPage
    }
  });
};
