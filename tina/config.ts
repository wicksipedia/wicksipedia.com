import { defineConfig } from "tinacms";

const branch =
  process.env.GITHUB_BRANCH ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  process.env.HEAD ||
  "main";

export default defineConfig({
  branch,

  // Get these from tina.io when setting up Tina Cloud for production
  clientId: process.env.PUBLIC_TINA_CLIENT_ID || "",
  token: process.env.TINA_TOKEN || "",

  build: {
    outputFolder: "admin",
    publicFolder: "public",
  },

  media: {
    tina: {
      mediaRoot: "uploads",
      publicFolder: "public",
    },
  },

  schema: {
    collections: [
      {
        name: "blog",
        label: "Blog Posts",
        path: "src/data/blog",
        format: "mdx",
        ui: {
          filename: {
            slugify: values => {
              return (values?.title || "")
                .toLowerCase()
                .replace(/\s+/g, "-")
                .replace(/[^a-z0-9-]/g, "");
            },
          },
          router: ({ document }) => {
            return `/blog/${document._sys.filename}`;
          },
        },
        fields: [
          {
            type: "string",
            name: "title",
            label: "Title",
            isTitle: true,
            required: true,
          },
          {
            type: "string",
            name: "description",
            label: "Description",
            required: true,
            ui: {
              component: "textarea",
            },
          },
          {
            type: "datetime",
            name: "pubDatetime",
            label: "Publication Date",
            required: true,
          },
          {
            type: "datetime",
            name: "modDatetime",
            label: "Modified Date",
          },
          {
            type: "string",
            name: "author",
            label: "Author",
          },
          {
            type: "boolean",
            name: "draft",
            label: "Draft",
          },
          {
            type: "boolean",
            name: "featured",
            label: "Featured",
          },
          {
            type: "string",
            name: "tags",
            label: "Tags",
            list: true,
          },
          {
            type: "image",
            name: "ogImage",
            label: "OG Image",
          },
          {
            type: "string",
            name: "canonicalURL",
            label: "Canonical URL",
          },
          {
            type: "boolean",
            name: "hideEditPost",
            label: "Hide Edit Post Link",
          },
          {
            type: "string",
            name: "timezone",
            label: "Timezone",
          },
          {
            type: "rich-text",
            name: "body",
            label: "Body",
            isBody: true,
          },
        ],
      },
    ],
  },
});
