#!/bin/bash
# Assert TinaCMS indexes exactly N documents in the blog collection.
# `tinacms audit` exits 0 and prints "Audit passed" on an EMPTY collection,
# so the count must be asserted explicitly or this check measures nothing.
set -uo pipefail
EXPECTED="${1:?usage: assert-doc-count.sh <expected-count>}"
LOG=$(bunx tinacms audit -v --datalayer-port 9001 2>&1)
COUNT=$(printf '%s\n' "$LOG" | grep -oE '[0-9]+ Documents' | head -1 | grep -oE '^[0-9]+')
if [ -z "$COUNT" ]; then
  echo "FAIL: audit printed no document count (did the CLI output change?)"
  printf '%s\n' "$LOG"
  exit 1
fi
if [ "$COUNT" != "$EXPECTED" ]; then
  echo "FAIL: Tina indexed $COUNT documents, expected $EXPECTED"
  exit 1
fi
echo "OK: Tina indexes $COUNT documents"
