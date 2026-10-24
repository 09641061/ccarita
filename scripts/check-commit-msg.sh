#!/usr/bin/env bash
# Commit message rules: Conventional Commits subject, at most one short body line, no attribution trailers.
# Usage: scripts/check-commit-msg.sh <message-file>   (exit 1 on any violation)
set -uo pipefail

msg=$(grep -v '^#' "$1")
subject=$(head -n1 <<< "$msg")
types='feat|fix|refactor|test|docs|build|ci|chore|perf'
scopes='iam|organization|customers|booking|conversations|assistant|platform|shared|arch|api'
fail=0
err() { echo "commit-msg: $*" >&2; fail=1; }

[[ "$subject" =~ ^Merge\  ]] && exit 0
[[ "$subject" =~ ^($types)(\(($scopes)\))?!?:\ [^[:space:]].*$ ]] \
  || err "subject must be '<type>(<scope>): <summary>' with type in {${types//|/, }} and optional scope in {${scopes//|/, }}"
(( ${#subject} <= 72 )) || err "subject is ${#subject} characters; keep it to 72"
[[ "$subject" =~ \.$ ]] && err "subject must not end with a period"

body=$(tail -n +2 <<< "$msg" | sed '/^[[:space:]]*$/d')
(( $(grep -c . <<< "$body") <= 1 )) || err "body must be empty or one short line; put reasons and evidence in the pull request"
grep -qiE '^(co-authored-by|signed-off-by):|generated with' <<< "$msg" && err "attribution trailers are not allowed"

exit "$fail"
