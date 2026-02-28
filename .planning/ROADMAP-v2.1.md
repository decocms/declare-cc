# Declare v2.1 Roadmap

**Theme: Resilience & Feedback**

v2.0 shipped the full lifecycle. v2.1 makes it robust — errors surface clearly, external changes sync live, and verification results are actionable.

## Milestones

### M-21: Error boundaries prevent white screens

**Problem:** Any React component crash white-screens the entire app. No error boundaries exist.

**Scope:**
- Create `<ErrorBoundary>` component with inline error card + retry button
- Wrap: root layout, onboarding flow, lifecycle view, detail panel, agent panel
- Each boundary catches independently — a crash in agents doesn't kill the lifecycle view
- Log errors to console with component stack

**Files:** `src/app/components/error-boundary.tsx`, `src/app/routes/__root.tsx`, `src/app/routes/index.tsx`

**Verify:** Inject a throw in a component, confirm error card renders instead of white screen.

---

### M-26: Mutation errors surface inline

**Problem:** All mutation hooks (`useApprove`, `useDeleteNode`, `useUpdateNode`, `useSpawnAgent`) silently swallow errors. Users get no feedback on failure.

**Scope:**
- Add toast/notification system (lightweight, no library — just a context + portal)
- Add `onError` to every `useMutation` call that shows the error as a toast
- Toast auto-dismisses after 5s, has manual dismiss, shows retry action where applicable
- Agent spawn failures show the error in the agent panel card

**Files:** `src/app/components/toast.tsx`, `src/app/hooks/use-graph.ts`, `src/app/hooks/use-agents.ts`

**Verify:** Kill the server, click Approve — toast appears with error message.

---

### M-28: Filesystem watcher syncs external changes

**Problem:** When agents or editors write to `.planning/` files, the dashboard doesn't update until the next API call. This matters because execution agents write PLAN.md and the user can't see changes until refresh.

**Scope:**
- Add `fs.watch` on `.planning/` directory (recursive) in server startup
- On change: debounce 500ms, re-parse affected file, broadcast SSE `change` event
- Dashboard already refetches on SSE `change` — no client changes needed
- Ignore agent-state.json and activity.jsonl changes (noise)

**Files:** `src/server/watcher.ts` (new), `src/server/index.ts`

**Verify:** Edit FUTURE.md in a text editor while dashboard is open — dashboard updates within 2s.

---

### M-34: Structured verification output

**Problem:** Verification agent output is displayed as raw text in a `<pre>` block. Users can't quickly see pass/fail status or what needs fixing.

**Scope:**
- Parse verification markdown output into structured data (verdict, artifacts table, gaps)
- Render in detail panel: green/red verdict badge, artifact status table, gap list with fix suggestions
- If VERIFIED → show success state with "Mark as KEPT" CTA
- If GAPS_FOUND → show gap list with "Re-plan" CTA

**Files:** `src/agents/parse.ts` (add `parseVerificationReport`), `src/app/components/verification-report.tsx` (new), `src/app/components/detail-panel.tsx`

**Verify:** Run verification via mocked AI, confirm structured report renders (not raw text).

---

## Execution Order

1. **M-21** (error boundaries) — foundational, prevents cascading failures during other work
2. **M-26** (mutation errors) — builds on M-21's pattern, adds toast system
3. **M-28** (filesystem watcher) — independent of UI work, server-only
4. **M-34** (verification output) — requires parsing + new component, most complex

Milestones 1-2 can be done in one session. Milestone 3 is independent. Milestone 4 is the most involved.

## Out of scope for v2.1

- Auto-navigation after agent completion (current UX is fine — data appears via SSE)
- Onboarding state persistence across refresh (30-second flow, not worth the complexity)
- Per-file write locks for concurrent agents (edge case, writeFileSync is atomic enough)
- Lifecycle stage indicator (nice-to-have, not blocking any workflow)
