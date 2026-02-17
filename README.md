# Wicksipedia

Personal blog and website of [Matt Wicks](https://wicksipedia.com/) — articles on CI/CD, DevOps, cloud-native architecture, and clean code.

Built with [Astro](https://astro.build/) and deployed to [Cloudflare Workers](https://workers.cloudflare.com/). Based on the [AstroPaper](https://github.com/satnaing/astro-paper) theme.

## Tech Stack

- [Astro 5](https://astro.build/) — static site generation
- [TypeScript](https://www.typescriptlang.org/) — strict type checking
- [TailwindCSS 4](https://tailwindcss.com/) — styling
- [React](https://react.dev/) — interactive components (comments via [Giscus](https://giscus.app/))
- [MDX](https://mdxjs.com/) — blog post content
- [Pagefind](https://pagefind.app/) — static search
- [Satori](https://github.com/vercel/satori) — dynamic OG image generation
- [Cloudflare Workers](https://workers.cloudflare.com/) — hosting and deployment

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (or Node.js)

### Install and Run

```bash
# Install dependencies
bun install

# Start the dev server at localhost:4321
bun run dev
```

### Other Commands

| Command                | Action                                            |
| :--------------------- | :------------------------------------------------ |
| `bun run dev`          | Start dev server at `localhost:4321`               |
| `bun run build`        | Type-check, build, and generate Pagefind index     |
| `bun run preview`      | Build and preview with Wrangler                    |
| `bun run deploy`       | Deploy to Cloudflare Workers                       |
| `bun run format:check` | Check formatting with Prettier                     |
| `bun run format`       | Format code with Prettier                          |
| `bun run lint`         | Lint with ESLint                                   |

> Search requires a build before it works locally, since Pagefind indexes the `dist/` output.

## Project Structure

```
src/
  data/blog/    Blog posts as MDX (each in its own subdirectory)
  components/   Astro and React components
  layouts/      Page layouts
  pages/        File-based routing
  styles/       TailwindCSS and global styles
  utils/        Helpers (post filtering, OG image generation, etc.)
  config.ts     Site metadata and settings
  constants.ts  Social links and Giscus config
public/         Static assets (served as-is)
```

## Writing Posts

Blog posts live in `src/data/blog/` as MDX files inside subdirectories (e.g. `my-post/index.mdx`). Each post directory can contain its own images.

Required frontmatter: `title`, `description`, `pubDatetime`.

Posts can be marked as `draft: true` to hide them from listings, and directories prefixed with `_` are excluded from URL generation.

## License

Licensed under the MIT License.
