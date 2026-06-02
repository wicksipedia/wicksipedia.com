---
pubDatetime: 2026-03-02
title: 'It Does What It Says on the Tin: Why Naming Matters More with AI'
description: "When your function name lies, developers get confused. When AI reads that lie, it builds on it confidently. A lesson that applies way beyond code."
ogImage: ./cover.png
tags: ['ai', 'software-engineering', 'clean-code']
---

About 15 years ago, a boss of mine dropped a phrase on me that stuck: "It should do what it says on the box." He was butchering a famous [Ronseal wood stain ad](https://www.ronseal.com/the-ronseal-brand/the-ronseal-phrase/), but his version stuck with me. Now that AI agents are reading our code and taking every function name at face value, I keep reaching for it.

## Why It Matters in Code

You're coding away, writing a `getUser()` function. Sounds fine, but it turns out that it also stealth-updates a login timestamp while firing off an analytics payload. It's a trap! Not a getter. The next person who calls `getUser()` expects to get a user, because... that's what it says it is going to do. Instead they get a user *plus* a bunch of side effects they didn't ask for and won't notice until something breaks.

Some patterns I've seen (and yes, written myself):

```typescript title="bad-names.ts"
// Says "validate" but also saves to the database
function validateOrder(order: Order) {
  if (!order.items.length) throw new Error('Empty order');
  order.status = 'validated';
  await db.orders.save(order);  // Wait, what?
  return order;
}

// Says "get" but creates if not found
function getConfig() {
  let config = cache.get('app-config');
  if (!config) {
    config = generateDefaultConfig();
    cache.set('app-config', config);
  }
  return config;
}

// What does "handle" even mean?
function handleClick() { /* could be anything */ }
```

Here's the same code, but honest:

```typescript title="good-names.ts"
// Does exactly one thing, and the name says so
function validateOrder(order: Order) {
  if (!order.items.length) throw new Error('Empty order');
}

function validateAndSaveOrder(order: Order) {
  validateOrder(order);
  order.status = 'validated';
  await db.orders.save(order);
  return order;
}

// Clear about the behaviour
function getOrCreateConfig() {
  let config = cache.get('app-config');
  if (!config) {
    config = generateDefaultConfig();
    cache.set('app-config', config);
  }
  return config;
}
```

## It's Not Just Code

Think about your calendar. Someone sends an invite for a "Quick Sync" but ambushes you with a 45-minute whiteboard session on architecture. As a result, you didn't prep and it was a waste of everyone's time. Call it "Architecture Review: Auth System Redesign" and people actually come ready.

Or look at issues in your backlog. "Update user flow" is practically useless as a title. But "Signup flow - Add email verification step" gives me the exact scope before the page even finishes loading. One of these gets picked up immediately. The other sits in the backlog because nobody knows what it actually involves.

Same with APIs. `POST /api/process` could do anything, while `POST /api/orders/{id}/shipment` tells you exactly what happens without cracking open the docs. Your OpenAPI spec shouldn't need a translator.

Here's the thing though: it's not just humans reading our code anymore. LLMs don't have trust issues. When an agent sees `getUser()`, it doesn't get suspicious about hidden database writes. A human dev might sniff out the bad smell, read the source, and sigh. An AI could just take it at face value and build a tower of assumptions on top of your bad label.

I watched this play out on [TinaCMS](https://tina.io) recently. A developer was trying to throw things from the backlog at AI and get a result unassisted to see how good the results would be. They pointed Claude at a straightforward feature request: warn the user if they try to navigate away from a dirty form. Simple enough, right? (Fun fact: simple is my trigger word 😅)

What they didn't know was that TinaCMS's form system has quirks. The dirty state tracking can be unreliable in ways you'd only know if you'd been burned before. Claude didn't know that. It read the form APIs, took them at face value, and assumed they worked as advertised. It also rolled its own navigation handling from scratch instead of upgrading React Router to a version with `useBlocker` built in. The whole thing looked perfectly reasonable in the PR. It just didn't work reliably, because Claude trusted the tin.

That's the gap. A human who's fought with TinaCMS's form state before would've been suspicious. They'd know straightaway that the form system has some tech debt that needs to be paid off in order to get this working properly. Maybe they'd check if the dirty flag was actually firing (unfortunately there weren't any tests for this). Claude read the label, believed it, and [built confidently on that assumption](/blog/the-future-of-software-engineering-is-not-what-you-think). More tests in the project might have given it the context to be skeptical, but without them, the code's naming and behaviour were the only signals it had.

Clean names have always been fundamental. They still are, and they're not just for the next developer anymore. They're for every tool that reads your code.

## My Tin Test Checklist

I don't get this right every time, but these are the things I check:

1. **Can you tell what it does without reading the body?** A summary comment that shows on hover is great but you don't see those when you are reviewing a PR. So a clean name is the brass ring.
   `sendWelcomeEmail()` = obvious. `handle()` = useless. If you're reaching for `process`, `manage`, or `execute`, you probably haven't figured out what the thing actually does yet.
2. **Side effects? Say so or split it.** `validateAndSaveOrder()` is honest. `updateUserAndNotify()` is better than `updateUser()` when it also sends an email. Even better: split them.
3. **Be specific about what comes back.** `getUsers()` returns users. When I see `findUserByEmail()` I can see that email is used to find a user, but I still question what happens when no users are found (result flow or exception flow?). `fetchActiveSubscriptions()` tells you it queries an external source and filters by status.

**Apply the tin test to everything.** File names, email subjects, server names. If the name doesn't tell the reader what they're getting, it's broken.

## TBH We're Just Lazy

Naming things isn’t some massive intellectual hurdle. It’s mostly just laziness. Slapping `processData` on a function is way faster than stopping your flow to figure out what the code is actually doing. It makes perfect sense in that moment, and then six months later someone (probably you) is staring at it trying to remember what "process" meant.

But this is a fundamental skill in software engineering, it's not some nice to have. AI is speeding things up, and if you aren't careful, you'll just hit the end of dead end streets faster thanks to some badly named class, function, or variable.

Next time you name something, does it do what it says on the tin?

If not, fix it.
