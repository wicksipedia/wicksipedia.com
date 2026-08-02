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
      // The `<h1>` is the post title. `PostDetails.astro` renders it from
      // frontmatter (through `PostHero.astro`), so a body that authors one
      // gives the document two, and the second one is not the post.
      //
      // Without this the rich-text editor offers "Heading 1" in its block-type
      // dropdown, its "Turn into" menu, its slash menu and its `# ` autoformat
      // shortcut — every route to an h1 is one click away. `headingLevels` is
      // documented in `@tinacms/schema-tools` as restricting all four.
      //
      // `overrides.headingLevels` and NOT `toolbarOverride`: the latter is
      // marked `@deprecated use overrides.toolbar` there, and its values are
      // toolbar ITEMS (`'heading'`, `'link'`, …), so the only heading-related
      // thing it can express is removing the heading control altogether.
      //
      // It is also documented as UI-ONLY — existing content carrying a
      // disallowed level still renders — so this is half the rule. The other
      // half is the corpus scan in `scripts/check-content.mjs`, which matters
      // here because all 17 posts were migrated by script rather than typed
      // into the admin this restricts. The two share
      // `scripts/lib/headings.mjs` so they cannot disagree about what is
      // legal. Same pairing as `prose.template.ts` +
      // `scripts/check-page-prose.mjs`, for pages.
      overrides: { headingLevels: ["h2", "h3", "h4", "h5", "h6"] },
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
  fields: [
    {
      type: "string",
      name: "heading",
      label: "Heading",
      // Sits in the same form as the page-level field labelled "Page
      // Heading", which is the page's <h1>. Without this line an author has
      // no in-UI signal that the two are different things.
      description: "The <h2> above the stats cards \u2014 a section heading inside this block, not the page's main heading. Leave blank to show the cards with no heading."
    }
  ]
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
    { type: "image", name: "avatar", label: "Avatar" },
    {
      type: "string",
      name: "alt",
      label: "Avatar Alt Text",
      description: "What a screen reader says in place of the image. Leave blank when the image is a portrait of the person in Name above \u2014 the name is already read out, so alt text repeats it. Fill it in when this Hero has no Name, or when the image is a logo, a screenshot, or anything else that means something on its own."
    }
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
  fields: [
    {
      type: "rich-text",
      name: "body",
      label: "Body",
      overrides: { headingLevels: ["h2", "h3", "h4", "h5", "h6"] }
    }
  ]
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
      // The list is derived from what actually lands at the top level of
      // `dist/client`, filtered by what a slug can even be. A slug is
      // `[a-z0-9-]+` by the time it is compared, so **no route containing a
      // dot is reachable** and none of them belongs here: `rss.xml`,
      // `robots.txt`, `og.png`, `sitemap-index.xml`, `favicon.ico`,
      // `404.html` and friends can never equal a slug. The plan's list
      // carried three of those, and respelling them `rss-xml` / `robots-txt`
      // / `og-png` (as this file briefly did) is just as wrong in the other
      // direction — `/rss-xml` does not collide with `/rss.xml`, so that only
      // blocked innocent titles.
      //
      // What is left is the directories: a page slug equal to one of these
      // writes `dist/client/<slug>/index.html` into a directory that already
      // belongs to something else.
      //
      //   blog tags archives search   real Astro routes
      //   admin                       the TinaCMS SPA in public/admin
      //   pagefind                    the search index
      //
      // `uploads` is the one entry that no longer names a built directory:
      // Tina's media root moved to `src/assets/uploads` in Task 3.3, so the
      // build emits no `/uploads/` at all. Kept anyway — it IS a live URL
      // under `astro dev` (`serveTinaUploadsInDev()` in astro.config.ts), and
      // a page slug that shadowed it would break the admin's media previews
      // for whoever was editing at the time.
      //
      // `about` is deliberately absent: it *is* one of the CMS pages
      // (`content/pages/about.mdx`), and `src/pages/about.mdx` goes away in
      // Task 3.2.
      //
      // `index`, `404` and `tina-island` cannot collide as files — `index.html`
      // and `404.html` are files, not directories, and `tina-island` is a
      // server route that emits nothing static — but all three would produce a
      // URL that reads like the real one. Kept as defence, not as a fix.
      slugify: (values) => {
        const RESERVED = [
          "blog",
          "tags",
          "archives",
          "search",
          "admin",
          "pagefind",
          "uploads",
          "index",
          "tina-island",
          "404"
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
      description: "Browser tab and search results only \u2014 not shown on the page. To change the visible heading, use Page Heading below, or the Hero block's Name."
    },
    {
      type: "string",
      name: "heading",
      label: "Page Heading",
      // The rendering decides this, not the author — see the heading block in
      // `src/components/islands/PageBlocks.astro`. A page opening with a Hero
      // never renders a page-level <h1> (the Hero supplies one), and a page
      // without one falls back to Meta Title, which is required. Neither the
      // two-<h1> nor the zero-<h1> outcome is reachable from this field, so
      // the description describes behaviour rather than asking for care.
      description: "Overrides Meta Title as the visible <h1> at the top of the page. Leave blank to use Meta Title. Ignored entirely when the page starts with a Hero block, which supplies its own heading."
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
      // `src/assets`, NOT `public`. Astro copies `public/` verbatim and never
      // processes it, so an editor-uploaded image shipped at its full source
      // size: the 640x640 hero avatar was 131.6 KB of PNG rendered at 140 CSS
      // px on mobile. Under `src/` the same file goes through <Image> — see
      // `resolveUploadImage` in `src/lib/tina/images.ts`, which maps the ref
      // back to its ImageMetadata the same way blog images already were.
      //
      // Only the on-disk location moves. Tina's MediaModel joins
      // publicFolder + mediaRoot to read and write, but builds the STORED ref
      // from mediaRoot alone (`/${mediaRoot}/${file}`), so documents keep
      // saying `/uploads/<file>` and nothing needs migrating.
      //
      // The cost is that `/uploads/<file>` is no longer a real URL on the
      // built site, which is what the media manager's thumbnails and the
      // avatar field preview point at. `serveTinaUploadsInDev()` in
      // astro.config.ts puts that back for `astro dev`, where editing
      // actually happens.
      publicFolder: "src/assets"
    }
  },
  schema: {
    collections: [blogCollection, pageCollection, settingsCollection]
  }
});
export {
  config_default as default
};
