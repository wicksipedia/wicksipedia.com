# Product

## Register

brand

## Users

Two audiences read this site, and both matter equally:

1. **Developers and DevOps practitioners** arriving via search or social, looking for a concrete answer to a CI/CD, cloud-native, or clean-code problem. They scan first, read second. They reward technical depth and punish filler.
2. **Hiring managers, conference organisers, and peers** who land here to vet Matt Wicks the engineer. They're forming a snap judgement about credibility, taste, and seniority from the chrome alone.

The site has to read as a useful technical resource AND as evidence that the author has taste. Failing either audience hurts the goal.

## Product Purpose

Wicksipedia is the personal blog and writing portfolio of Matt Wicks (Solution Architect, SSW). It exists to publish substantive articles on CI/CD, DevOps, cloud-native architecture, and clean code, and to compound those articles into a recognised voice in the DevOps and cloud-native space over the next 12+ months.

Success looks like: people in the field knowing the name, citing the posts, and trusting the take. Search traffic is a side-effect of writing things worth finding, not the headline metric.

## Brand Personality

**Technical, dry, but playful.**

The voice is senior-engineer confident: short sentences, no padding, no buzzwords, no apologies. Authority comes from substance, not from corporate polish.

Underneath the dryness sits a wink. Personality lives in small, deliberate touches (the bouncing orange dot after the wordmark, the monospace-everywhere choice, the willingness to be opinionated in titles) rather than in loud animations or jokes. The reader should feel they're reading someone, not a brand.

Tone is closer to a respected staff engineer's README than to a corporate blog post. Terminal-adjacent rather than marketing-bright.

## Anti-references

Things this site must not look or feel like:

- **Generic AstroPaper / Hugo / Jekyll fork.** The default theme look is the death of the credibility argument. If readers can identify the underlying template at a glance, the design has failed its job.
- **Tailwind template lookalike.** Pretty, gradient-y, indistinct. The "I bought a UI kit" aesthetic that signals zero personal investment.
- **Medium / Substack default chrome.** Big author photo, generic serif, sidebar metadata, platform-y feel. Wicksipedia is a self-published thing, not a publication slot.
- **Corporate SaaS marketing pages.** Hero-metric templates, lifeless gradient buttons, stock illustrations, "Trusted by" bars, vague headlines.
- **Dev-blog-with-personality cosplay.** Performative weirdness (random emojis, ironic Comic Sans, drop-shadow-on-everything) as a substitute for actual personality.

## Design Principles

1. **The site is part of the argument.** Wicksipedia's design is itself evidence of the author's taste and standards. Every visual decision either reinforces or undermines the claim "this person knows what they're doing." Treat design choices as code review: justify them or remove them.
2. **Dry voice, with a wink.** Personality lives in restrained, precise details (the bouncing dot, monospace-everywhere, considered hover states), never in loud or generic flourishes. If a touch could appear on a thousand other dev blogs, it's not personality, it's wallpaper.
3. **Earn every pixel.** Editorial restraint by default. Whitespace beats decoration. Remove anything that doesn't carry weight; nothing on the page is there because "the section needed something."
4. **Two audiences, one hierarchy.** Both the search-arriving practitioner and the credibility-checking peer scan first. The visual hierarchy must answer "what is this site, what is this post, and is the author worth trusting" within the first three seconds, on any breakpoint.
5. **Burnt orange is the only voice raise.** A single committed accent (orange) carries all interactivity, emphasis, and identity. Introducing additional accent colours dilutes the brand and breaks the rule above.

## Accessibility & Inclusion

Target: **WCAG 2.1 AA**.

Specifically:
- Colour contrast ratios meet AA in both light and dark themes (orange accent against both backgrounds is a known watch-zone).
- All interactive elements are keyboard reachable with a visible, on-brand focus state.
- Semantic HTML for headings, landmarks, lists, and links.
- Images carry meaningful alt text; decorative images are marked as such.
- The bouncing dot, card lift, and other motion respect `prefers-reduced-motion` (or do not animate layout properties that would cause discomfort).
- Forms (search, comments) are properly labelled and announce state changes.
