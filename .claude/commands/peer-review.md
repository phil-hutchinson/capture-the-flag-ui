Run a peer review of the current branch for story `$ARGUMENTS`.

If no story name is provided, derive it from the current branch name (the
story folder under `doc/plan/` is closely related to the branch); if that
fails, ask the user.

Dispatch the `peer-review` agent (via the Agent tool) with the story folder
name — the agent definition in `.claude/agents/peer-review.md` contains the
full review instructions and is the single source of truth for them. Do not
review the diff yourself, and do not fix any findings.

When the agent returns, present to the user: the path of the saved review
document and the count of findings by severity. Leave actioning the comments
to the user.
