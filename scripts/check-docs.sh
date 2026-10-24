#!/usr/bin/env bash
# Documentation checks: word budgets, relative links, decision records, skill front matter, agent symlinks.
# Usage: scripts/check-docs.sh   (exit 1 on any violation)
set -uo pipefail
shopt -s nullglob
cd "$(dirname "$0")/.."

fail=0
err() { echo "check-docs: $*" >&2; fail=1; }

mapfile -t md_files < <(find . -type f -name '*.md' -not -path './node_modules/*' -not -path './dist/*' -not -path './.angular/*' -not -path './.git/*' | sed 's|^\./||' | sort)

# 1. Word budgets
while IFS=$'\t' read -r path max; do
  [[ -z "$path" || "$path" == \#* ]] && continue
  if [[ ! -f "$path" ]]; then err "$path: listed in scripts/doc-budgets.tsv but missing"; continue; fi
  words=$(wc -w < "$path")
  (( words > max )) && err "$path: $words words exceeds budget $max (see docs/AGENTS.md)"
done < scripts/doc-budgets.tsv

# 2. Relative links resolve
for f in "${md_files[@]}"; do
  dir=$(dirname "$f")
  while IFS= read -r link; do
    case "$link" in http://*|https://*|mailto:*|\#*) continue ;; esac
    target="${link%%#*}"
    [[ -e "$dir/$target" ]] || err "$f: broken link ($link)"
  done < <(grep -oP '\]\(\K[^)\s]+' "$f")
done

# 3. Decision records
for f in docs/decisions/*/*.md; do
  folder=$(basename "$(dirname "$f")")
  [[ "$(basename "$f")" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9-]+\.md$ ]] || err "$f: name must be yyyy-mm-dd-topic.md"
  [[ "$(sed -n 1p "$f")" == "# Decision: "?* ]] || err "$f: line 1 must be '# Decision: <title>'"
  [[ -z "$(sed -n 2p "$f")" ]] || err "$f: line 2 must be blank"
  status=$(sed -n 3p "$f")
  case "$folder" in
    proposed)
      [[ "$status" == "Status: proposed" ]] || err "$f: line 3 must be 'Status: proposed'"
      sections=("## Problem" "## Proposal" "## Alternatives considered" "## Acceptance criteria") ;;
    implemented)
      [[ "$status" == "Status: implemented" ]] || err "$f: line 3 must be 'Status: implemented'"
      sections=("## Problem" "## Decision" "## Alternatives considered" "## Consequences")
      grep -qxE '## (Proposal|Plan|Acceptance criteria)' "$f" && err "$f: plan sections are not allowed in implemented/" ;;
    rejected)
      [[ "$status" == "Status: rejected — "?* ]] || err "$f: line 3 must be 'Status: rejected — <reason>'"
      sections=("## Problem" "## Proposal" "## Alternatives considered") ;;
    *) err "$f: unknown folder '$folder' (use proposed, implemented or rejected)"; continue ;;
  esac
  for s in "${sections[@]}"; do grep -qxF "$s" "$f" || err "$f: missing section '$s'"; done
done

# 4. Skill front matter
for d in .agents/skills/*/; do
  name=$(basename "$d")
  f="${d}SKILL.md"
  if [[ ! -f "$f" ]]; then err "$d: missing SKILL.md"; continue; fi
  [[ "$(sed -n 1p "$f")" == "---" ]] || { err "$f: must start with '---' front matter"; continue; }
  front=$(sed -n '2,/^---$/p' "$f")
  grep -qx "name: $name" <<< "$front" || err "$f: front matter 'name' must be '$name'"
  grep -qE '^description: .{60,}' <<< "$front" || err "$f: front matter needs a description (when to use it) of 60+ characters"
done

# 5. Agent entry points
[[ "$(readlink CLAUDE.md)" == "AGENTS.md" ]] || err "CLAUDE.md must be a symlink to AGENTS.md"
[[ "$(readlink .claude/skills)" == "../.agents/skills" ]] || err ".claude/skills must be a symlink to ../.agents/skills"

(( fail == 0 )) && echo "check-docs: ok"
exit "$fail"
