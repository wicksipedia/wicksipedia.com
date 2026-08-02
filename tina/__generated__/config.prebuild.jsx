// tina/config.ts
import { defineConfig } from "tinacms";

// tina/collections/blog.ts
var blogCollection = {
  name: "blog",
  label: "Blog Posts",
  path: "src/data/blog",
  // Plain CommonMark, not MDX. Every post's hazardous syntax — shell `${...}`
  // braces, `<word word>` placeholders — currently sits inside code fences,
  // which MDX would also survive, so this is a guard against future prose
  // rather than a present-tense necessity. Components still work: a rich-text
  // template with a `match` is parsed and serialised by the markdown parser.
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
      ui: {
        // Editor-side companion to the hard cap in scripts/check-content.mjs.
        // parseMDX is superlinear on some inline runs, so an oversized body
        // hangs the build before anything reaches the sanitiser. This tells
        // an author at the point of writing instead of at deploy; the build
        // gate is the one that actually protects the site, since nothing
        // obliges a commit to have gone through the CMS.
        //
        // The rich-text value is an AST, not a string, so the serialised
        // size is a proxy rather than the body length the build measures.
        // It is deliberately looser than the build cap so it never rejects
        // something the build would accept.
        validate: (value) => {
          if (!value) return void 0;
          const size = JSON.stringify(value)?.length ?? 0;
          return size > 256 * 1024 ? "This post is too large to build reliably. Split it into several posts." : void 0;
        }
      },
      // A YouTube block, so no post has to hand-write iframe HTML.
      //
      // `match` is load-bearing, not decoration. Without it the markdown
      // parser does not recognise the template at all: it reads the element
      // as raw html on the way in, and — worse — serialises an
      // editor-inserted block to an empty string on the way out, silently
      // deleting whatever the author just filled in. With it, the same
      // parser produces a real mdxJsxFlowElement and writes the shortcode
      // back symmetrically. Verified in both directions.
      //
      // It also RESERVES `{{<` and `>}}` across every post body. An
      // unrelated shortcode in prose — `{{< ref "x" >}}`, which this blog is
      // likely to write about, given the subject matter — still renders, but
      // Tina escapes it to `{{\< ref "x" >}}` when it next writes the file.
      // Inside a code fence or inline code it is untouched, which is where
      // such an example belongs anyway.
      templates: [
        {
          name: "youTubeEmbed",
          label: "YouTube Embed",
          match: { start: "{{<", end: ">}}" },
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
              description: "Describes the video to screen readers, and captions it. Required: two untitled embeds are indistinguishable to anyone not seeing the page.",
              required: true
            }
          ]
        }
      ]
    }
  ]
};

// src/components/blocks/github-stats.template.ts
var githubStatsBlockSchema = {
  name: "githubStats",
  label: "GitHub Stats",
  fields: [{ type: "string", name: "heading", label: "Heading" }]
};

// src/components/blocks/hero.template.ts
var heroBlockSchema = {
  name: "hero",
  label: "Hero",
  fields: [
    { type: "string", name: "name", label: "Name" },
    {
      type: "string",
      name: "tagline",
      label: "Tagline",
      ui: { component: "textarea" }
    },
    { type: "string", name: "jobTitle", label: "Job Title" },
    { type: "string", name: "organization", label: "Organisation" },
    { type: "string", name: "organizationUrl", label: "Organisation URL" },
    { type: "image", name: "avatar", label: "Avatar" }
  ]
};

// src/components/blocks/post-feed.template.ts
var postFeedBlockSchema = {
  name: "postFeed",
  label: "Post Feed",
  fields: [
    { type: "string", name: "label", label: "Section Label" },
    {
      type: "number",
      name: "limit",
      label: "Posts in grid",
      description: "Excludes the lead post shown above the grid."
    },
    { type: "string", name: "allPostsLabel", label: "All-posts Link Label" },
    { type: "string", name: "allPostsHref", label: "All-posts Link URL" }
  ]
};

// src/components/blocks/prose.template.ts
var proseBlockSchema = {
  name: "prose",
  label: "Prose",
  fields: [{ type: "rich-text", name: "body", label: "Body" }]
};

// tina/collections/page.ts
var pageCollection = {
  name: "page",
  label: "Pages",
  path: "content/pages",
  format: "mdx",
  ui: {
    router: ({ document }) => document._sys.filename === "home" ? "/" : `/${document._sys.filename}`,
    filename: {
      readonly: false,
      // Reserved slugs collide with real file-based routes. Astro gives static
      // routes priority, so a page named e.g. `blog` would index in Tina, pass
      // every build check, and silently never render. Refuse the name instead.
      //
      // Every entry is a POST-slugify form. The plan's list carried
      // `rss.xml`, `robots.txt` and `og.png`, none of which can ever match:
      // slugify has already turned `.` into `-` by the time the comparison
      // runs, so those three were three entries that could never fire. The
      // reachable spellings are `rss-xml`, `robots-txt`, `og-png`.
      //
      // `about` is deliberately NOT here — it is one of the CMS pages
      // (`content/pages/about.mdx`), and `src/pages/about.mdx` disappears in
      // Task 3.2. `index` and `tina-island` are here because they are real
      // top-level routes (`src/pages/index.astro`, `src/pages/tina-island/`).
      slugify: (values) => {
        const RESERVED = [
          "blog",
          "tags",
          "archives",
          "search",
          "admin",
          "index",
          "tina-island",
          "404",
          "rss-xml",
          "robots-txt",
          "og-png"
        ];
        const slug = (values?.seoTitle ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        if (!slug) return "untitled";
        return RESERVED.includes(slug) ? `${slug}-page` : slug;
      }
    }
  },
  fields: [
    {
      type: "string",
      name: "seoTitle",
      label: "Meta Title (SEO)",
      isTitle: true,
      required: true,
      description: "Browser tab and search results only \u2014 not shown on the page. To change the visible heading, edit the Hero block's Name below."
    },
    {
      type: "object",
      name: "blocks",
      label: "Page Sections",
      list: true,
      ui: { visualSelector: true },
      templates: [
        heroBlockSchema,
        postFeedBlockSchema,
        proseBlockSchema,
        githubStatsBlockSchema
      ]
    }
  ]
};

// tina/collections/settings.ts
var settingsCollection = {
  name: "settings",
  label: "Site Settings",
  path: "content/settings",
  format: "json",
  ui: {
    global: true,
    allowedActions: { create: false, delete: false }
  },
  fields: [
    {
      type: "object",
      name: "nav",
      label: "Header Navigation",
      list: true,
      ui: { itemProps: (item) => ({ label: item?.title ?? "Link" }) },
      fields: [
        { type: "string", name: "title", label: "Label", required: true },
        { type: "string", name: "href", label: "URL", required: true }
      ]
    },
    {
      type: "object",
      name: "socials",
      label: "Social Links",
      list: true,
      ui: { itemProps: (item) => ({ label: item?.name ?? "Social" }) },
      fields: [
        { type: "string", name: "name", label: "Name", required: true },
        { type: "string", name: "href", label: "URL", required: true },
        {
          type: "string",
          name: "icon",
          label: "Icon",
          options: ["github", "linkedin", "x", "facebook", "mail"],
          required: true
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
    collections: [blogCollection, pageCollection, settingsCollection]
  }
});
export {
  config_default as default
};
