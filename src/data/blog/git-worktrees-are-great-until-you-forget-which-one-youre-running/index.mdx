---
pubDatetime: 2026-03-06
draft: false
title: "Git Worktrees Are Great Until You Forget Which One You're Running"
description: "My code changes weren't showing up. Turns out I was running the app from the wrong worktree. So I built a fzf plugin to fix that."
ogImage: ./cover.png
tags: [git, Zsh, shell, developer-setup, Claude Code]
---

I spent 20 minutes debugging why my fix wasn't working. The tests passed. The code was right. I restarted the app, hit the endpoint again, and got the exact same broken behavior, the same 204 with no validation error in sight.

The code was fine. I was the bug.

## Worktrees are just directories

[Claude Code](https://docs.anthropic.com/en/docs/claude-code) has this nice worktree feature where it creates an isolated copy of your repo for each task. You get a branch, a clean working directory, and zero risk of stomping on whatever's happening in your main checkout. I've been using it for months and it's genuinely great.

The catch is that a worktree is just a directory. There's no magic. When I ran my app with .NET Aspire, it launched from the main repo root, not from the worktree where my changes lived. So every restart just reloaded the same unchanged code from `main`, and I sat there wondering why my perfectly valid fix was being ignored.

The moment I ran `git log` in the main repo and didn't see my commits, it all made sense. My terminal was sitting in `/Users/matt/Developer/clients/Arcadia/arcadia-portal`. Meanwhile, every line of my fix lived over in `/Users/matt/Developer/clients/Arcadia/arcadia-portal/.claude/worktrees/pricing-calculation-qty-changes`, which is where Claude Code had been working the whole time. I'd been restarting the app from the wrong directory for twenty minutes straight.

## The switching problem

With branches, you `git switch` and you're done. Worktrees don't work like that because each one is its own path on disk, and "switching" just means remembering which directory to `cd` into. You can run `git worktree list` to see them all, but what you get back is a wall of absolute paths that all share the same enormous prefix. I've spent enough time [optimizing my shell](/blog/speeding-up-zsh-startup) to know when something's begging for a better interface.

## Vibing up a quick fix

I already had [fzf](https://github.com/junegunn/fzf) in my [zsh setup](/blog/modern-zsh-setup), so the first version was dead simple. A function that pipes `git worktree list` into fzf and `cd`s to whatever you pick:

```zsh
wt() {
  local dir=$(git worktree list | fzf --height=40% | awk '{print $1}')
  [[ -n "$dir" ]] && cd "$dir"
}
```

Three lines and it worked, but the fzf output was just those same raw absolute paths I was trying to avoid. With a few worktrees going, they all blur together. What I actually wanted to see was the branch name and a relative path, not the full `/Users/matt/Developer/clients/...` prefix repeated on every line.

The `--porcelain` flag on `git worktree list` gives structured output you can actually parse. Some awk later, I had it spitting out aligned columns with nerd font icons:

```zsh
# Output from `wt`:
#  main                              .
#  pricing-calculation-qty-changes   .claude/worktrees/pricing-calculation-qty-changes
```

Branch on the left, relative path on the right, fzf handles the fuzzy matching. Select one and you're there. I also wired up tab completion so `wt<tab>` shows the list inline if you prefer that over the full fzf popup.

## Making it a proper plugin

The function worked, so I figured I'd package it as a zsh plugin that anyone with fzf could grab. The structure is minimal:

```
git-worktree-switcher/
├── git-worktree-switcher.plugin.zsh
└── README.md
```

One file does all the work. Zinit, Oh My Zsh, Antigen, or a raw `source` statement can all load it. Install with zinit is one line:

```zsh
zinit light wicksipedia/git-worktree-switcher
zinit cdreplay -q  # needed for tab completion to register
```

The repo is at [github.com/wicksipedia/git-worktree-switcher](https://github.com/wicksipedia/git-worktree-switcher) and there's really not much to it, which is sort of the point.

## Automating the rest with hooks

With `wt` handling navigation, the last piece was automating branch creation. Claude Code's worktree feature doesn't create a branch for you, so I added a `SessionStart` hook that detects when a session starts inside a worktree and creates a matching branch automatically:

```json title="~/.claude/settings.json"
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "if echo \"$PWD\" | grep -q '/worktrees/'; then BRANCH=$(basename \"$PWD\"); CURRENT=$(git rev-parse --abbrev-ref HEAD 2>/dev/null); if [ \"$CURRENT\" != \"$BRANCH\" ]; then git switch -c \"$BRANCH\" 2>/dev/null || git switch \"$BRANCH\"; fi; fi",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

It's dense as a one-liner, I know. The gist: grab the worktree directory name and check out a branch with that name, creating it if it doesn't exist. Claude Code creates the worktree, the hook handles the branch, and `wt` lets me jump between them.

## The yak shave is the point

I went into the day planning to fix a pricing validation bug. I came out of it with an open source zsh plugin, a blog post, and the validation bug still sitting in an uncommitted worktree.

Classic [yak shave](https://seths.blog/2005/03/dont_shave_that/). But the detour wasn't wasted. Every time I'd started a Claude Code task in a worktree, I'd hit that same friction of manually navigating between directories. Now it's `wt`, pick from a list, done. The kind of small tool that saves 10 seconds fifty times a week.

The pricing bug is still sitting in that worktree, and I should probably go finish it.
