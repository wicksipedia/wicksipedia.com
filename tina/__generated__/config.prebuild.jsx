// tina/config.ts
import { defineConfig } from "tinacms";

// tina/collections/blog.ts
var blogCollection = {
  name: "blog",
  label: "Blog Posts",
  path: "src/data/blog",
  // Plain CommonMark (not MDX): posts use no components/JSX, and `md` parses
  // shell `${...}` braces and `<word word>` literally instead of choking on
  // them as MDX expressions/JSX.
  format: "md",
  match: {
    // Only the per-post index files; ignore drafts in `_`-prefixed dirs.
    include: "**/index"
  },
  ui: {
    router: ({ document }) => `/blog/${document._sys.breadcrumbs.slice(0, -1).join("/")}`,
    // New posts are created as `{slug}/index.mdx` so images can sit alongside.
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
    {
      type: "image",
      name: "ogImage",
      label: "Cover / OG Image"
    },
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
      isBody: true
    }
  ]
};

// tina/config.ts
var branch = process.env.GITHUB_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || process.env.HEAD || "main";
var config_default = defineConfig({
  branch,
  // Tina Cloud credentials (set in .env locally / Cloudflare build env).
  // Empty strings keep `tinacms dev` (local filesystem mode) working without them.
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
    // Each collection lives in its own file under tina/collections/.
    collections: [blogCollection]
  }
});
export {
  config_default as default
};
