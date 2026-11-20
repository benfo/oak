---
id: "6r7r"
kind: task
state: open
when: later
tags: []
created: 2026-11-20
updated: 2026-11-20
---
# Full text search in files with git grep

Search file contents from History All files (at that commit) and Changes (changed paths, --untracked).
Toggles: match case, whole word, regex. git grep -I -n --column -z, streamed (STREAMING), killed per keystroke, capped.
Results filter the tree with counts; Enter opens the file with find on the match.
Same toggles come to diff and Blame find through src/shared/find.ts (one matcher).
Later scopes: commit messages (log --grep), changed text (log -S/-G). Bundle ripgrep only if git grep is measurably slow.
