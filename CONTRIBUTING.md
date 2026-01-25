# Contributing to Wicksipedia

This guide explains how to work with this AstroPaper-based blog site. Keep this document as a reference after replacing the template blog posts with your own content.

## Table of Contents

- [Project Structure](#project-structure)
- [Creating Blog Posts](#creating-blog-posts)
- [Configuration](#configuration)
- [Customization](#customization)
- [Development Workflow](#development-workflow)
- [Deployment](#deployment)
- [Maintenance](#maintenance)

## Project Structure

```bash
/
├── public/                    # Static assets (unoptimized)
│   └── blog/                 # Blog post images
├── src/
│   ├── assets/               # Optimized assets
│   │   ├── icons/
│   │   └── images/
│   ├── components/           # Astro/React components
│   ├── data/
│   │   └── blog/            # Blog post markdown files
│   ├── layouts/             # Page layouts
│   ├── pages/               # Site pages & routes
│   ├── styles/              # Global styles
│   ├── utils/               # Utility functions
│   ├── config.ts            # Main site configuration
│   ├── constants.ts         # Social links & constants
│   └── content.config.ts    # Content schema definition
└── astro.config.ts          # Astro configuration
```

## Creating Blog Posts

### File Location

Store blog posts as markdown files in `src/data/blog/`.

**Directory Organization** (v5.1.0+):
- Subdirectories affect URLs: `src/data/blog/2025/post.md` → `/posts/2025/post`
- Prefix with `_` to ignore in URL: `src/data/blog/_2026/post.md` → `/posts/post`

Example structure:
```bash
src/data/blog/
├── my-first-post.md              # /posts/my-first-post
├── 2025/
│   └── another-post.md           # /posts/2025/another-post
└── _drafts/
    └── work-in-progress.md       # /posts/work-in-progress
```

### Frontmatter

Every post requires frontmatter in YAML format:

```yaml
---
title: Your Post Title                    # Required
description: Post description for SEO     # Required
pubDatetime: 2024-01-23T10:00:00Z        # Required (ISO 8601)
modDatetime: 2024-01-24T15:30:00Z        # Optional (add when modified)
author: Matt Wicks                        # Default from config
slug: custom-url-slug                     # Optional (auto-generated from filename)
featured: false                           # Show in featured section
draft: false                              # Hide from production
tags:                                     # Array of tags
  - technology
  - programming
ogImage: ../../assets/images/post.jpg    # Optional OG image
canonicalURL: https://example.com/post   # If reposted from elsewhere
hideEditPost: false                       # Hide edit button
timezone: Australia/Sydney                # Override global timezone
---
```

**Getting ISO 8601 datetime:**
```javascript
new Date().toISOString()  // Run in browser console
```

### Content Guidelines

1. **Headings**: Use h2-h6 (`##` - `######`). The post title serves as h1.

2. **Table of Contents**: Add automatically by including:
   ```markdown
   ## Table of contents
   ```

3. **Images**:
   
   **Recommended**: Store in `src/assets/` (auto-optimized)
   ```markdown
   ![Alt text](@/assets/images/example.jpg)
   ![Alt text](../../assets/images/example.jpg)
   ```
   
   **Alternative**: Store in `public/` (unoptimized)
   ```markdown
   ![Alt text](/assets/images/example.jpg)
   <img src="/assets/images/example.jpg" alt="Alt text">
   ```

4. **Image Optimization**: Compress images before adding (especially in `public/`)
   - [TinyPNG](https://tinypng.com/)
   - [TinyJPG](https://tinyjpg.com/)

5. **OG Images**: Recommended size is **1200 × 640px**. Generated automatically if not specified.

### LaTeX Equations

**Inline equations**: Use single dollar signs
```markdown
The formula $E = mc^2$ is famous.
```

**Block equations**: Use double dollar signs
```markdown
$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$
```

### Syntax Highlighting

Code blocks support:
- Multiple themes (light/dark mode)
- File names: ` ```js file=example.js `
- Line highlighting: Add special comments in code
- Diff notation: `// [!code ++]` or `// [!code --]`

## Configuration

### Site Settings

Edit `src/config.ts`:

```typescript
export const SITE = {
  website: "https://wicksipedia.com/",
  author: "Matt Wicks",
  profile: "https://wicksipedia.com/",
  desc: "Site description for SEO",
  title: "Wicksipedia",
  ogImage: "astropaper-og.jpg",
  lightAndDarkMode: true,         // Enable dark mode toggle
  postPerIndex: 4,                // Posts on home page
  postPerPage: 4,                 // Posts per pagination page
  scheduledPostMargin: 15 * 60 * 1000,  // Future post margin (15 min)
  showArchives: true,             // Show archives menu
  showBackButton: true,           // Show back button in posts
  editPost: {
    enabled: true,
    text: "Edit page",
    url: "https://github.com/USERNAME/REPO/edit/main/",
  },
  dynamicOgImage: true,           // Auto-generate OG images
  dir: "ltr",                     // Text direction (ltr/rtl/auto)
  lang: "en",                     // HTML lang code
  timezone: "Australia/Sydney",   // IANA timezone format
};
```

**Important**: Set `website` to your deployed URL for proper SEO.

### Social Links

Edit `src/constants.ts`:

```typescript
export const SOCIALS = [
  {
    name: "GitHub",
    href: "https://github.com/username",
    linkTitle: `GitHub profile`,
    icon: IconGitHub,
  },
  // Add or remove social links
];

export const SHARE_LINKS = [
  // Configure share link options
];
```

### Logo/Title

Three options in `src/components/Header.astro`:

1. **Text** (easiest): Just update `SITE.title` in config
2. **SVG**: Import SVG from `src/assets/` and replace `{SITE.title}`
3. **Image**: Use Astro's `Image` component

### Layout Width

Modify `src/styles/global.css`:

```css
@utility max-w-app {
  @apply max-w-3xl;  /* Default: 768px */
  /* Change to max-w-4xl or max-w-5xl */
}
```

### Color Schemes

Edit `src/styles/global.css`:

```css
:root,
html[data-theme="light"] {
  --background: #fdfdfd;
  --foreground: #282728;
  --accent: #006cac;
  --muted: #e6e6e6;
  --border: #ece9e9;
}

html[data-theme="dark"] {
  --background: #212737;
  --foreground: #eaedf3;
  --accent: #ff6b01;
  --muted: #343f60bf;
  --border: #ab4b08;
}
```

**Color Properties**:
- `--background`: Main background color
- `--foreground`: Text color
- `--accent`: Links, hover states
- `--muted`: Cards, hover backgrounds
- `--border`: Borders and separators

**Disable dark mode**: Set `SITE.lightAndDarkMode: false` in config.

### Fonts

Default: Google Sans Code via Astro's experimental fonts API.

**To customize**:
1. Update `astro.config.ts` font configuration
2. Update `Layout.astro` Font component
3. Update `--font-app` in `global.css`

## Development Workflow

### Commands

```bash
# Install dependencies
bun install

# Start dev server (localhost:4321)
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview

# Format code
bun run format

# Lint code
bun run lint

# Type checking
bun run sync
```

### Git Hooks & Dates

The project uses Husky for Git hooks. You can set up automated date management:

**Pre-commit hook** for auto-updating dates:
- Updates `modDatetime` when editing published posts (`draft: false`)
- Sets `pubDatetime` for new posts
- Use `draft: first` to publish and clean up `modDatetime` automatically

See the original blog post files for implementation details.

### VS Code Snippets

The project includes VS Code snippets for frontmatter. Type the snippet trigger and press Tab.

## Deployment

### Build Configuration

1. Ensure `SITE.website` is set to your production URL
2. Run `bun run build`
3. Deploy the `./dist/` directory

### Platforms

- **Cloudflare Pages** (recommended by template)
- **Vercel**
- **Netlify**
- **GitHub Pages**

### Environment Variables

**Google Site Verification** (optional):
```bash
PUBLIC_GOOGLE_SITE_VERIFICATION=your-verification-code
```

### Dynamic OG Images

**Trade-off**: Each OG image adds ~1 second to build time.
- 60 posts ≈ 1 minute
- 600 posts ≈ 10 minutes

Disable if needed: Set `SITE.dynamicOgImage: false`

**Non-Latin characters**: Update `src/utils/loadGoogleFont.ts` with appropriate fonts.

## Maintenance

### Updating Dependencies

```bash
# Install npm-check-updates globally
npm install -g npm-check-updates

# Check available updates
ncu

# Update patch versions (safest)
ncu -u --target patch
bun install

# Update minor versions
ncu -i --target minor
bun install

# Check for major updates (careful!)
ncu -i
```

**Important**: Read release notes for major version updates.

### Updating AstroPaper Template

**Files to preserve** (likely customized):
- `src/data/blog/` (your posts)
- `src/config.ts` (your config)
- `src/pages/about.md` (your about page)
- `public/` (your assets)
- `src/styles/global.css` (if customized)

**Using Git** (advanced):
```bash
# Add AstroPaper as remote
git remote add astro-paper https://github.com/satnaing/astro-paper.git

# Create update branch
git checkout -b update-astro-paper

# Pull changes
git pull astro-paper main --allow-unrelated-histories

# Resolve conflicts, test, merge
```

## Additional Features

### Comments (Giscus)

To add comments:
1. Enable GitHub Discussions on repo
2. Install [Giscus app](https://github.com/apps/giscus)
3. Configure at [giscus.app](https://giscus.app/)
4. Add script to `PostDetails.astro`

See the Giscus blog post in template for React component implementation.

### Search

Built-in fuzzy search using Pagefind (auto-generated on build).

### RSS Feed

Automatically generated at `/rss.xml`.

### Sitemap

Automatically generated on build.

## Getting Help

- **Documentation**: See `src/data/blog/` template posts (before deletion)
- **Issues**: Check [AstroPaper GitHub Issues](https://github.com/satnaing/astro-paper/issues)
- **Discussions**: [AstroPaper Discussions](https://github.com/satnaing/astro-paper/discussions)

## Tech Stack

- **Framework**: [Astro](https://astro.build/)
- **Styling**: [TailwindCSS](https://tailwindcss.com/)
- **TypeScript**: Type-safe development
- **Search**: [Pagefind](https://pagefind.app/)
- **Icons**: [Tabler Icons](https://tabler-icons.io/)
- **Code**: [Shiki](https://shiki.style/) syntax highlighting

---

**License**: MIT  
**Original Template**: [AstroPaper](https://github.com/satnaing/astro-paper) by Sat Naing
