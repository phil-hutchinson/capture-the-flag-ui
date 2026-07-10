Orchestrate the implementation of a story from its plan, dispatching
fresh-context agents for the expensive phases and pausing for the owner only
at the defined gates.

The story folder is `doc/plan/$ARGUMENTS/`. If no story name was provided,
derive it from the current branch name; if that fails, ask the owner.

You are the orchestrator. You do not implement steps, review code, or fix
findings yourself — you dispatch the agents below (via the Agent tool), judge
their reports, run cheap verification commands, commit, and talk to the
owner. The implementation plan file is the pipeline's state: agents record
per-step Status and Notes there, so this process is resumable — if invoked on
a story that is partway done, derive the position from the step statuses and
`git log`, and continue from there.

**Agents:** `create-implementation-plan`, `implement-step`, `peer-review`,
`process-peer-review-triage`, `process-peer-review-fix`. Prompt each with the
story folder name plus whatever its definition says it needs; pass reports'
relevant contents forward rather than assuming agents share your context
(they start cold every time).

## Preconditions

1. `doc/plan/<story>/story.md` exists. If not, stop — the story is written
   with the owner before this process starts.
2. The working tree is clean. If not, **stop** and ask the owner whether to
   commit the existing files before continuing.

## Phase 1 — plan

If `implementation-plan.md` does not exist in the story folder, dispatch
`create-implementation-plan`. Present the owner a summary of the resulting
plan — step list, verification types, any concerns the agent raised — and get
their approval before implementing anything. **[gate]**

## Phase 2 — implement steps

For each step whose Status is not `committed`, in order:

1. Dispatch `implement-step` with the story folder and step number.
2. Judge the report. If the step is `blocked`, or the report shows an
   undocumented deviation or anything else surprising, treat it as a failed
   attempt (see escalation below) — do not blindly re-dispatch.
3. Re-run `npm run typecheck`, `npm run lint`, and `npm test` yourself.
   Trust the agent's report, but verify — these commands are cheap.
4. If the step's verification is **manual**: stop and tell the owner exactly
   what to check and how (the step's verification section says; typically
   `npm run dev` and specific observations), then wait for the result.
   **[gate]** If the owner reports a failure, dispatch a fix (this counts as
   an implementation attempt for the step) — or, if the failure genuinely
   belongs to work a later step will do, say so and confirm with the owner
   before moving on. If the right fix is new work, add a step to the plan
   (following `doc/guidelines/implementation-plan-guide.md`) and tell the
   owner you did.
5. Commit the step: a plain, descriptive message of what the step did
   (mention the story), ending with the co-author trailer. Set the step's
   Status to `committed` in the plan file (include that edit in the commit).

**Escalation:** if a step fails twice — two implement/fix dispatches that did
not produce a green, verified result — stop and put the situation to the
owner: what failed, what was tried, the options you see. **[gate]** Never
keep dispatching at a step that isn't converging.

## Phase 3 — sign-off loop

Repeat until the owner signs off; every iteration ends at the owner — never
start a second review round without them:

1. Dispatch `peer-review`.
2. If the review has open findings, dispatch `process-peer-review-triage`,
   then ask the owner each decision item (present the options and the
   triage recommendation). Dispatch `process-peer-review-fix` with the
   auto-fix list plus the owner's decisions. Re-run typecheck/lint/test
   yourself, then commit the fixes (one commit, descriptive message,
   co-author trailer).
3. Final checks, run directly: `npm run typecheck`, `npm run lint`,
   `npm test`, `npm run format:check`. Fix trivial fallout (e.g. run
   `npm run format`) yourself; anything substantive goes back through the
   machinery above.
4. Ask the owner to look over the result: summarize what the story delivered,
   how to try it, and the state of the review document. **[gate]**
   - Feedback requiring work → add step(s) to the implementation plan and
     run them through Phase 2's machinery, then loop back to 1.
   - Satisfied → sign-off. Report the final state (commits made, checks
     green, review document status). Branch handling — merging, PRs — is the
     owner's; do not do it.

## Global guards

- **Gates are hard.** The **[gate]** points above are the only places this
  process waits for the owner — but at those points it always waits. Never
  proceed past one on an assumption.
- **Dispatch budget.** If total agent dispatches exceed roughly twice the
  number of plan steps, something is wrong with the process itself — stop
  and review the situation with the owner instead of continuing.
- **Judge every report.** An agent reporting failure, deviation, or confusion
  is a signal to think and possibly escalate, not a trigger to re-dispatch.
- **Commit discipline.** Never begin a step with uncommitted changes in the
  tree; every commit message is plain and descriptive and ends with the
  co-author trailer.
