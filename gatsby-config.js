const pathUtils = require('./src/utils/path');

const siteMetadata = {
  title: `Wicksipedia`,
  siteUrl: `https://wicksipedia.com`,
  description: `My place for %TOPICS%`,
  topics: ['Azure', '.NET', 'development', 'DevOps', 'Scrum', 'geeking out'],
  menu: [
    {
      name: 'Home',
      path: '/'
    },
    // {
    //   name: 'Guides',
    //   path: '/guides'
    // },
    {
      name: 'About',
      path: '/about'
    },
  ],
  footerMenu: [
    {
      name: 'RSS',
      path: '/rss.xml'
    },
    {
      name: 'Sitemap',
      path: '/sitemap.xml'
    },
  ],
  search: true,
  author: {
    name: `Matt`,
    description: `Hi 👋 I'm <strong>Matt</strong>`,
    social: {
      facebook: ``,
      twitter: `https://twitter.com/matteightyate`,
      linkedin: `https://www.linkedin.com/in/matt-wicks/`,
      instagram: `https://www.instagram.com/wicksipedia/`,
      youtube: ``,
      github: `https://github.com/wicksipedia`,
      twitch: ``
    }
  }
};

module.exports = {
  siteMetadata: siteMetadata,
  plugins: [
    `gatsby-plugin-typescript`,
    'gatsby-plugin-twitter',
    `gatsby-transformer-sharp`,
    `gatsby-plugin-react-helmet`,
    `gatsby-plugin-emotion`,
    `gatsby-plugin-postcss`,
    `gatsby-plugin-sitemap`,
    `gatsby-plugin-sharp`,
    {
      resolve: `gatsby-plugin-env-variables`,
      options: {
        allowList: [
          "GA_TRACKING_ID",
          "HEAD",
          "COMMIT_REF"
        ]
      },
    },
    {
      resolve: `gatsby-plugin-google-analytics`,
      options: {
        trackingId: process.env.GA_TRACKING_ID,
        head: false,
        respectDNT: true,
        pageTransitionDelay: 0,
      },
    },
    {
      resolve: `gatsby-plugin-manifest`,
      options: {
        name: `Wicksipedia`,
        short_name: `Wicksipedia`,
        start_url: `/`,
        background_color: `#a4cbb8`,
        theme_color: `#a4cbb8`,
        display: `minimal-ui`,
        icon: `${__dirname}/content/assets/images/icon.png`
      }
    },
    `gatsby-plugin-offline`,
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        name: `assets`,
        path: `content/assets`
      }
    },
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        name: 'content',
        path: 'content'
      }
    },
    {
      resolve: `gatsby-transformer-yaml`,
      options: {
        typeName: `Tags`
      }
    },
    {
      resolve: `gatsby-plugin-lunr`,
      options: {
        languages: [
          {
            name: 'en'
          }
        ],
        fields: [
          { name: 'title', store: true, attributes: { boost: 20 } },
          { name: 'content', store: true },
          { name: 'tags', store: true },
          { name: 'excerpt', store: true },
          { name: 'path', store: true }
        ],
        resolvers: {
          MarkdownRemark: {
            title: node => node.frontmatter.title,
            content: node => node.html,
            tags: node => node.frontmatter.tags,
            excerpt: node => node.frontmatter.excerpt,
            path: node => pathUtils.pathToPost(node.frontmatter)
          }
        }
      }
    },
    {
      resolve: `gatsby-transformer-remark`,
      options: {
        plugins: [
          `gatsby-remark-autolink-headers`,
          `gatsby-remark-vscode`,
          {
            resolve: `gatsby-remark-images`,
            options: {
              maxWidth: 1200
            }
          },
          {
            resolve: `gatsby-remark-embedder`,
            options: {
              customTransformers: [
                // Your custom transformers
              ],
              services: {
                // The service-specific options by the name of the service
              },
            },
          },
        ]
      }
    },
    {
      resolve: `gatsby-plugin-page-creator`,
      options: {
        path: `${__dirname}/src/pages`
      }
    },
    {
      resolve: `gatsby-plugin-feed`,
      options: {
        query: `
          {
            site {
              siteMetadata {
                title
                description
                siteUrl
                site_url: siteUrl
              }
            }
          }
        `,
        feeds: [
          {
            serialize: ({ query: { site, allMarkdownRemark } }) => {
              return allMarkdownRemark.edges.map(edge => {
                return Object.assign({}, edge.node.frontmatter, {
                  description: edge.node.frontmatter.excerpt,
                  date: edge.node.frontmatter.created,
                  url: site.siteMetadata.siteUrl + pathUtils.pathToPost(edge.node.frontmatter),
                  guid: site.siteMetadata.siteUrl + pathUtils.pathToPost(edge.node.frontmatter),
                  custom_elements: [{ "content:encoded": edge.node.html }],
                })
              })
            },
            query: `
            {
              allMarkdownRemark(
                sort: { order: DESC, fields: [frontmatter___created] },
                filter: { fileAbsolutePath: { regex: "/(posts)/.*\\\\.md$/" } }
              ) {
                edges {
                  node {
                    html
                    frontmatter {
                      title
                      excerpt
                      path
                      created
                    }
                  }
                }
              }
            }
            `,
            output: `/rss.xml`,
            title: `RSS Feed`
          }
        ]
      }
    }
  ]
};
