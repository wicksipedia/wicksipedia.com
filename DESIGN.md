---
name: Wicksipedia
description: Personal blog and writing portfolio of Matt Wicks. Articles on CI/CD, DevOps, cloud-native architecture, and clean code.
colors:
  cursor-blink-orange: "#ae4508"
  cursor-blink-orange-dark: "#ff7a1a"
  paper-warm: "#faf9f6"
  deep-dock: "#0f1117"
  ink-graphite: "#1a1a1a"
  ink-bone: "#e8e6e3"
  surface-ash: "#e8e5df"
  surface-midnight: "#1e2130"
  rule-stone: "#d6d3cc"
  rule-slate: "#2a2d3a"
  hero-fog-light: "#dad9db"
  hero-fog-dark: "#1a1d2a"
typography:
  display:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "clamp(2rem, 4vw, 2.5rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Google Sans Code, ui-monospace, monospace"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Google Sans Code, ui-monospace, monospace"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  prose:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "normal"
  label:
    fontFamily: "Google Sans Code, ui-monospace, monospace"
    fontSize: "0.8rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  app-max: "64rem"
components:
  card-post:
    backgroundColor: "{colors.surface-ash}"
    textColor: "{colors.ink-graphite}"
    rounded: "{rounded.xl}"
    padding: "20px"
  card-post-hover:
    backgroundColor: "{colors.surface-ash}"
    textColor: "{colors.cursor-blink-orange}"
    rounded: "{rounded.xl}"
  tag-pill:
    backgroundColor: "{colors.cursor-blink-orange}"
    textColor: "{colors.cursor-blink-orange}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  nav-link:
    textColor: "{colors.ink-graphite}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  nav-link-active:
    textColor: "{colors.cursor-blink-orange}"
    typography: "{typography.label}"
  icon-button:
    backgroundColor: "{colors.paper-warm}"
    textColor: "{colors.ink-graphite}"
    rounded: "{rounded.lg}"
    size: "36px"
  icon-button-hover:
    backgroundColor: "{colors.cursor-blink-orange}"
    textColor: "{colors.cursor-blink-orange}"
    rounded: "{rounded.lg}"
  code-inline:
    backgroundColor: "{colors.surface-ash}"
    textColor: "{colors.cursor-blink-orange}"
    rounded: "{rounded.md}"
    padding: "2px 6px"
  search-trigger:
    backgroundColor: "{colors.paper-warm}"
    textColor: "{colors.ink-graphite}"
    rounded: "{rounded.lg}"
    padding: "0 8px"
    height: "36px"
---

# Design System: Wicksipedia

## 1. Overview

**Creative North Star: "The Lit Console"**

Wicksipedia inherits the lineage of the terminal, then warms it. Monospace is the voice of the interface; Source Serif 4 is the voice of the writing. The single committed accent (Cursor-Blink Orange) is the only thing that raises its volume on the page, and it raises it for the same reason a cursor blinks: *here, look.* Surfaces are flat at rest. Depth appears only as a response to a hover, a click, a focus.

The aesthetic philosophy is editorial restraint with a developer's wink. Whitespace is generous because the writing is dense. The wordmark is followed by a small orange dot that bounces and squishes; that dot is the entire personality budget of the chrome. Everything else holds still.

The system explicitly rejects: the default AstroPaper / Hugo / Substack chrome, the Tailwind-template lookalike (gradients on everything, lifeless cards in identical grids), corporate SaaS hero-metric layouts, and performative dev-blog weirdness (random emojis, ironic Comic Sans, drop-shadow-on-everything) used as a substitute for actual personality. Authority comes from substance, not from polish.

**Key Characteristics:**
- Mono-forward chrome, serif-driven prose. The split is deliberate.
- One accent (Cursor-Blink Orange). No second colour. No gradients on the accent.
- Flat surfaces at rest. Hover-lift (-2px translate) and accent-tinted glow are the only depth signals.
- Twin themes (paper-warm light, deep-dock dark) are first-class, not an afterthought.
- The bouncing dot after the wordmark is the only ambient motion. Everything else is state-driven.

## 2. Colors

A two-temperature palette: warm paper for daylight, deep dock for late nights. The accent is the same pigment in both, tuned for contrast. There is one accent. There is no second.

### Primary

- **Cursor-Blink Orange** (`#ae4508` light / `#ff7a1a` dark): The single committed accent. Carries every interactive state, every emphasis, every brand mark. Used on links, hover states, active nav indicators, code text in prose, tag pills, the bouncing dot, the top-of-viewport accent line, focus outlines, scrollbar thumb. Never used as a background fill at full opacity (only at low alpha tints like `accent/5`, `accent/10`, `accent/15`).

### Neutral

- **Paper Warm** (`#faf9f6`): Light theme page background. A warm off-white tinted toward cream, never `#fff`. Sets the editorial tone.
- **Deep Dock** (`#0f1117`): Dark theme page background. Deep navy-black, never `#000`. Reads as deliberate, not default-dark.
- **Ink Graphite** (`#1a1a1a`): Light theme body text. Soft black, slightly warmed.
- **Ink Bone** (`#e8e6e3`): Dark theme body text. Slightly warm off-white, never glaring.
- **Surface Ash** (`#e8e5df`): Light theme card / muted fill background. Used at low alpha (`muted/20`, `muted/40`).
- **Surface Midnight** (`#1e2130`): Dark theme card / muted fill background.
- **Rule Stone** (`#d6d3cc`): Light theme borders and dividers. Used at `/50` or `/60` alpha for subtlety.
- **Rule Slate** (`#2a2d3a`): Dark theme borders.
- **Hero Fog** (`#dad9db` light / `#1a1d2a` dark): Reserved for the homepage hero section background.

### Named Rules

**The One Accent Rule.** Cursor-Blink Orange is the only accent. Tailwind's `--accent-2` (green) is defined for legacy reasons and must not be used in any UI. Introducing a second colour breaks the brand.

**The Tinted-Neutral Rule.** Never `#fff`. Never `#000`. Every neutral tilts toward warmth (light theme) or deep-dock navy (dark theme). Pure neutrals are forbidden.

**The Low-Alpha Accent Rule.** When the accent is used as a background fill (tag pills, hover states, code-inline), it is always low-alpha (`accent/5` to `accent/15`). The accent at full opacity is reserved for text, borders at intent, and the one-pixel top-of-viewport line.

## 3. Typography

**Display Font:** Source Serif 4 (with Georgia fallback)
**Body / UI Font:** Google Sans Code (with `ui-monospace, monospace` fallback)
**Prose Font:** Source Serif 4 (with Georgia fallback)
**Label / Mono Font:** Google Sans Code (same as body; case-treated for labels)

**Character:** The chrome speaks in monospace; the writing speaks in serif. That split is the entire typographic personality. Mono carries the developer-craft signal in the navigation, headings, and UI; serif carries the long-form-reading-is-the-point signal inside the article body. Italic (Source Serif 4 italic) appears on h3 inside prose and on the wordmark itself.

### Hierarchy

- **Display** (Source Serif 4, 700, `clamp(2rem, 4vw, 2.5rem)`, line-height 1.1, tracking `-0.02em`): Post titles on the post detail page. Italic on the wordmark.
- **Headline** (Google Sans Code, 700, `1.5rem`, line-height 1.2): Section headings inside the chrome (homepage section labels, footer band).
- **Title** (Source Serif 4, 700, `1.25rem`, line-height 1.3): Card titles in the post list. Highlights orange on hover.
- **Body** (Google Sans Code, 400, `1rem`, line-height 1.6): Default body text outside the prose container (descriptions, datetime strings, cards).
- **Prose** (Source Serif 4, 400, `~1.0625rem`, line-height 1.7): All long-form article body. Should sit at 65-75ch line length. Inline `<code>` switches back to Google Sans Code.
- **Label** (Google Sans Code, 600, `0.8rem`, line-height 1.2, tracking `0.08em`, uppercase): Nav links, metadata strings, kbd shortcut hints, section labels.

### Named Rules

**The Mono-Chrome / Serif-Prose Rule.** Monospace for everything outside the article body; serif for everything inside. Headings inside prose flip to monospace because they're chrome-of-the-article (h1-h4 in `.app-prose` use `font-app`, not `font-prose`). Do not collapse this split.

**The 65-75ch Rule.** Article body line length sits between 65 and 75 characters. Prose sets `font-prose`; the layout container caps at `max-w-app` (64rem) which, at the prose font size, lands inside the rule.

**The Italic-as-Voice Rule.** Italic is reserved for: the wordmark, h3 inside prose, blockquote prose. It is not used decoratively elsewhere.

## 4. Elevation

Flat-by-default, lift-on-state. Surfaces sit flat at rest with no ambient shadows. Depth appears only as a response to interaction: a card lifts -2px on hover and gains an accent-tinted glow; a button's background tints with `accent/8` on hover. Code blocks carry a small `shadow-sm` to separate them from prose, but this is the exception, not the pattern.

The system does not use Material-style elevation tiers. There are exactly two "lifted" states (card hover, code block) and one ambient signal (the 0.75px gradient line at the top of the viewport).

### Shadow Vocabulary

- **Card hover glow** (`box-shadow: 0 10px 15px -3px rgba(accent, 0.05)`): Used as the response when a post card is hovered. Tinted with the accent so the glow reads as identity, not generic shadow.
- **Code block separator** (`shadow-sm`): A small ambient shadow on `.astro-code` blocks to lift them off the prose surface.

### Named Rules

**The Flat-At-Rest Rule.** Every surface is flat in its default state. No ambient cards, no decorative shadows, no glassmorphism on idle elements (the sticky header uses `backdrop-blur-lg` + low-alpha background, but that is structural, not decorative).

**The Accent-Tinted-Glow Rule.** When a hover state generates a shadow, the shadow is tinted with the accent (typically `accent/5`). Generic black shadows are forbidden; they read as 2014-template.

## 5. Components

### Buttons

There are no full-text primary buttons in the chrome. Interactive surfaces are: nav links, icon buttons (utility actions like search, theme), and the search trigger (mono-styled with embedded `kbd` for ⌘K).

- **Icon Button** (search, theme toggle): 36px square, `rounded-lg` (8px), `text-foreground/75` at rest, `text-accent` + `bg-accent/10` on hover. 150ms transition.
- **Search Trigger**: 36px tall, mono-styled. Inline `IconSearch` + `kbd ⌘ K` chip. Borders on the kbd elements lift to `accent/30` on parent hover.

### Tag Pill (signature component)

- **Shape:** `rounded-full`, padding `4px 10px` (sm) or `4px 12px` (lg).
- **Color:** `border border-accent/30`, `bg-accent/5`, `text-accent`.
- **Hover:** border lifts to `accent/60`, background lifts to `accent/15`. 150ms transition.
- **Inline icon:** small `IconHash` at 70% opacity prefixes the tag name.

### Card (post card)

- **Corner Style:** `rounded-xl` (12px).
- **Background:** `bg-muted/20` at rest, `bg-muted/40` on hover.
- **Border:** `border-border/40` at rest, `border-border/70` on hover.
- **Shadow Strategy:** flat at rest; `hover:shadow-lg hover:shadow-accent/5` on hover (accent-tinted glow).
- **Lift:** `hover:-translate-y-0.5` (-2px). 300ms transition.
- **Internal Padding:** `p-5` (20px).
- **Title:** Source Serif 4, bold, `text-xl`, lifts to `text-accent` on hover.
- **Background image treatment:** the post's OG image bleeds in from the right at `opacity-0.22` (light) / `0.25` (dark), with a `bg-linear-to-r from-muted via-(--muted)/80 to-transparent` mask so the title side stays clean.

### Inputs

The site uses one search input (inside the command palette / Pagefind dialog). It inherits Pagefind's defaults with the project's accent overlaid via custom-property theming. Standard form inputs are not part of the public surface.

### Navigation (header)

- **Style:** sticky, glass-morphism (`backdrop-blur-lg backdrop-saturate-[1.8]`, semi-transparent `bg-background/82`).
- **Nav links:** Google Sans Code, 600, `0.8rem`, uppercase, `0.08em` tracking. `text-foreground/75` at rest; `text-accent` + `bg-accent/8` + `rounded-lg` on hover; `text-accent` + 2px accent underline (drawn via `::after`) on active.
- **Wordmark:** Source Serif 4 italic bold + a 2-unit orange dot suffix that runs an infinite `dot-squish` keyframe (8 frames, 0.8s). The dot has its own animated shadow under it via `::after`.
- **Mobile:** menu button on the right opens an overlay grid; the overlay reuses the same blur + border treatment.
- **Skip-to-content link:** off-screen at top, slides into view on focus, accent-coloured. WCAG-correct.

### Code Inline (signature component)

- `bg-muted/80`, `text-accent`, `font-app` (Google Sans Code), `rounded-md`, `px-1.5 py-0.5`, `text-[0.9em]`.
- The accent-coloured code text is part of the brand: every code reference inside prose is a small flash of the cursor-blink colour.

### Blockquote (current pattern, needs revision)

Current: `border-s-[3px] border-s-accent rounded-e-lg bg-accent/5 px-4 py-1 italic`. **This violates the system's own ban on side-stripe borders > 1px.** Documented as the current state; expected to be revised. See Do's and Don'ts below.

### Bouncing Dot (signature)

The orange dot after the "Wicksipedia" wordmark runs an infinite squish-and-bounce animation (`dot-squish` 0.8s). A second `::after` element below it scales horizontally on the same beat to imply a shadow on a surface. This is the only ambient motion in the entire system. It carries the entire personality budget of the chrome.

## 6. Do's and Don'ts

### Do:

- **Do** use Cursor-Blink Orange (`#ae4508` / `#ff7a1a`) for every interactive, every emphasis, every brand mark. Use it sparingly: on text, borders at intent, low-alpha tints. Never as a full-opacity background fill.
- **Do** keep every surface flat at rest. The only "elevation" is hover-state on cards (accent-tinted glow + -2px lift) and the small `shadow-sm` on code blocks.
- **Do** keep the Mono-Chrome / Serif-Prose rule. Monospace (Google Sans Code) for chrome and headings; serif (Source Serif 4) for article body.
- **Do** tint every neutral toward warmth (light) or deep-dock navy (dark). Never `#fff` or `#000`.
- **Do** cap article body line length at 65-75ch via `max-w-app` and prose font sizing.
- **Do** carry the bouncing-dot motif when introducing new homepage sections that need a personality beat. It is the system's signature.
- **Do** test every UI change in both light and dark themes before shipping. Twin themes are first-class.
- **Do** respect `prefers-reduced-motion` for the bouncing dot, card lift, and reveal animations. WCAG 2.1 AA is the floor.

### Don't:

- **Don't** introduce a second accent colour. The `--accent-2` (green) variable exists for legacy reasons and must not be used in any UI. Introducing a second colour breaks the One Accent Rule.
- **Don't** use side-stripe borders greater than 1px as a coloured accent on cards, callouts, alerts, or list items. The current blockquote (`border-s-[3px] border-s-accent`) violates this and is on the to-fix list. Replace with full borders, background tints, or leading marks.
- **Don't** use gradient text (`background-clip: text` on a gradient background). Cursor-Blink Orange at full opacity carries emphasis. Weight, size, and italic carry the rest.
- **Don't** use glassmorphism decoratively. The header uses backdrop blur because it is sticky over scrolling content; that is structural. New decorative blur is forbidden.
- **Don't** ship hero-metric templates (big number + small label + supporting stats + gradient accent). The site is editorial, not marketing.
- **Don't** ship identical card grids (icon + heading + text, repeated). The post-card pattern is the only card pattern; reproducing it as decorative tile-grids is the AstroPaper-template trap.
- **Don't** introduce stock illustrations, mascots, or "Trusted by" bars. The voice is dry; the chrome should be dry too.
- **Don't** add ambient shadows, decorative gradients, or "alive at rest" effects to surfaces. The bouncing dot is the entire personality budget. Adding more dilutes it.
- **Don't** rebrand toward a Substack / Medium look (big author photo at top of post, sidebar metadata, generic serif). Wicksipedia is self-published; that is the point.
- **Don't** introduce performative weirdness (random emojis in chrome, ironic Comic Sans, gratuitous wobbles) as a substitute for personality. Personality lives in restraint plus the one orange dot.
