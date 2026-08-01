// tina/config.ts
import { defineConfig } from "tinacms";

// tina/collections/blog.ts
var blogCollection = {
  name: "blog",
  label: "Blog Posts",
  path: "src/data/blog",
  // Plain CommonMark, not MDX: no post uses components, and `md` parses shell
  // `${...}` braces and `<word word>` literally instead of choking on them as
  // MDX expressions.
  format: "md",
  match: {
    // Matches every `index` file under any subdirectory depth, including
    // `_`-prefixed directories — this mirrors the Astro content collection's
    // prior glob (`**/[^_]*.mdx`), whose `[^_]` guards the filename, not the
    // directory, so `_`-prefixed dirs were never excluded there either.
    include: "**/index"
  },
  ui: {
    router: ({ document }) => `/blog/${document._sys.breadcrumbs.slice(0, -1).join("/")}`,
    filename: {
      readonly: false,
      slugify: (values) => {
        const slug = (values?.title ?? "untitled").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        return `${slug}/index`;
      }
    }
  },
  fields: [
    {
      type: "string",
      name: "title",
      label: "Title",
      isTitle: true,
      required: true
    },
    {
      type: "string",
      name: "description",
      label: "Description",
      required: true
    },
    {
      type: "datetime",
      name: "pubDatetime",
      label: "Published",
      required: true
    },
    { type: "datetime", name: "modDatetime", label: "Last Modified" },
    { type: "string", name: "author", label: "Author" },
    { type: "image", name: "ogImage", label: "Cover / OG Image" },
    { type: "string", name: "tags", label: "Tags", list: true },
    { type: "boolean", name: "featured", label: "Featured" },
    { type: "boolean", name: "draft", label: "Draft" },
    { type: "string", name: "canonicalURL", label: "Canonical URL" },
    { type: "boolean", name: "hideEditPost", label: "Hide Edit Link" },
    { type: "string", name: "timezone", label: "Timezone" },
    { type: "boolean", name: "noindex", label: "No Index" },
    {
      type: "rich-text",
      name: "body",
      label: "Body",
      isBody: true,
      // Declared so the editor offers a YouTube block instead of asking an
      // author for raw iframe HTML. Note the markdown parser does not expand
      // templates into mdx nodes — measured, not assumed — so
      // src/lib/tina/embeds.ts recognises the element it writes. Should this
      // collection ever move to `format: "mdx"`, the parser emits the node
      // directly and that bridge becomes a no-op.
      templates: [
        {
          name: "youTubeEmbed",
          label: "YouTube Embed",
          fields: [
            {
              type: "string",
              name: "videoId",
              label: "Video ID",
              description: "The 11-character id from the video URL, e.g. SJtuU_6mags",
              required: true
            },
            {
              type: "string",
              name: "title",
              label: "Title",
              description: "Describes the video to screen readers."
            }
          ]
        }
      ]
    }
  ]
};

// tina/config.ts
var branch = process.env.GITHUB_BRANCH || process.env.WORKERS_CI_BRANCH || process.env.CF_PAGES_BRANCH || process.env.HEAD || "main";
var config_default = defineConfig({
  branch,
  // Empty strings keep `tinacms dev` (local filesystem mode) working with no
  // credentials. Phase 4 wires the real Tina Cloud values.
  clientId: process.env.PUBLIC_TINA_CLIENT_ID ?? "",
  token: process.env.TINA_TOKEN ?? "",
  build: {
    // Admin SPA is emitted to public/admin and served at /admin.
    outputFolder: "admin",
    publicFolder: "public"
  },
  media: {
    tina: {
      mediaRoot: "uploads",
      publicFolder: "public"
    }
  },
  schema: {
    collections: [blogCollection]
  }
});
export {
  config_default as default
};
