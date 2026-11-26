# Issue dependencies

**Which issues block which, and what's ready to start: [#31](https://github.com/hoseasiu/ukraine-air-war-dashboard/issues/31)**, the pinned graph and list.

GitHub's "blocked by" links are the only record of blockers. A [GitHub Action](.github/workflows/dependency-graph.yml) generates #31 from them, so don't edit it by hand. For who is working on what, check the issues and PRs themselves.

## Changing a dependency

On the blocked issue, use **Relationships** in the sidebar. Or, in PowerShell, to mark issue 7 as blocked by issue 6:

```powershell
gh api -X POST repos/hoseasiu/ukraine-air-war-dashboard/issues/7/dependencies/blocked_by -F issue_id="$(gh api repos/hoseasiu/ukraine-air-war-dashboard/issues/6 --jq .id)"
```

The API takes the blocker's internal `id`, not its issue number. To remove a link, send `DELETE` to `.../issues/7/dependencies/blocked_by/<id>`.

Adding or removing a link doesn't start the Action. #31 catches up at the next issue change or within about 6 hours. To update it now:

```powershell
gh workflow run dependency-graph.yml
```

## Start early

#15 is filed under Phase 5, but start it early because #17 and #21 need it.

## File-overlap risks

These issues may have no formal dependency on each other but are likely to edit the same files. Avoid running two from one row at once, or coordinate on the issues.

| Shared area | Issues |
|---|---|
| App shell, routing, global state | #11, #12, #20 |
| Python project config and mapping module | #7, #8 |
| Tab A page layout | #13, #14 |
| Tab B page layout | #16, #17 |
| Tab E page layout | #18, #19 |
| Guided stop definitions | #21, #22 |
| Chart frame and glossary hooks | #12, #24 |
| `docs/plan.md` §11, `AGENTS.md` | any issue that records a decision or command |
