#!/bin/bash
# Assert TinaCMS indexes exactly N documents in EVERY collection it knows about.
#
#   ./scripts/assert-doc-count.sh blog=17 settings=1
#
# `tinacms audit` exits 0 and prints "✅ Audit passed" on an EMPTY collection,
# so the counts must be asserted explicitly or this check measures nothing.
#
# Why per-collection. The first version of this script parsed the audit log with
# `grep … | head -1` and asserted a single number. That was correct while `blog`
# was the only collection and became silently wrong the moment `settings`
# landed: it would have asserted whichever collection the CLI happened to print
# first and stopped covering the other one entirely — a green check over an
# unindexed blog. So this refuses to be partial in both directions:
#
#   - every collection named on the command line must appear in the audit
#     output (catches a renamed/removed collection);
#   - every collection in the audit output must be named on the command line
#     (catches a new collection sneaking past the gate — the exact failure the
#     old script had);
#   - and the whole thing fails if the audit prints no counts at all, which is
#     what a changed CLI output format looks like.
set -uo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: assert-doc-count.sh <collection>=<count> [<collection>=<count> ...]"
  exit 1
fi

LOG=$(bunx tinacms audit -v --datalayer-port 9001 2>&1)

# "Checking blog collection. 17 Documents" -> "blog 17".
# The CLI writes progress with ANSI cursor codes on the same stream, so strip
# escape sequences before parsing rather than hoping they land on other lines.
FOUND=$(
  printf '%s\n' "$LOG" |
    sed $'s/\033\\[[0-9;]*[A-Za-z]//g' |
    grep -oE 'Checking [A-Za-z0-9_-]+ collection\. [0-9]+ Documents' |
    sed -E 's/Checking ([A-Za-z0-9_-]+) collection\. ([0-9]+) Documents/\1 \2/'
)

if [ -z "$FOUND" ]; then
  echo "FAIL: audit printed no document counts (did the CLI output change?)"
  printf '%s\n' "$LOG"
  exit 1
fi

FAILED=0
ASSERTED=""

for PAIR in "$@"; do
  case "$PAIR" in
    *=*) ;;
    *)
      echo "FAIL: expected <collection>=<count>, got '$PAIR'"
      exit 1
      ;;
  esac
  NAME="${PAIR%%=*}"
  EXPECTED="${PAIR#*=}"
  case "$EXPECTED" in
    '' | *[!0-9]*)
      echo "FAIL: '$PAIR' does not name a number"
      exit 1
      ;;
  esac

  COUNT=$(printf '%s\n' "$FOUND" | awk -v n="$NAME" '$1 == n { print $2 }')
  if [ -z "$COUNT" ]; then
    echo "FAIL: audit never mentioned the '$NAME' collection"
    printf '%s\n' "$LOG"
    FAILED=1
    continue
  fi
  if [ "$COUNT" != "$EXPECTED" ]; then
    echo "FAIL: Tina indexed $COUNT documents in '$NAME', expected $EXPECTED"
    FAILED=1
    continue
  fi
  ASSERTED="$ASSERTED $NAME=$COUNT"
done

# A collection the audit reports but nobody asserted is the old bug wearing a
# new hat: the gate would stay green while an entire collection went unchecked.
while read -r NAME _; do
  [ -z "$NAME" ] && continue
  for PAIR in "$@"; do
    [ "${PAIR%%=*}" = "$NAME" ] && continue 2
  done
  echo "FAIL: audit reported the '$NAME' collection but no expected count was given"
  FAILED=1
done <<EOF
$FOUND
EOF

if [ "$FAILED" -ne 0 ]; then
  exit 1
fi

echo "OK: Tina indexes${ASSERTED}"
