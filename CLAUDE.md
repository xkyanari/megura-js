# Notes for Claude

## Working across several PRs

When several PRs are in review at once, or one builds on another, keep the earlier PRs' changes:

- Before editing a file, check whether an open or recently merged PR already changed it (`git log` on the file, the open PRs' diffs). Build on those changes; don't revert them by working from an older copy of the file.
- An earlier fix only goes away when a later PR deliberately replaces or improves it, and that PR's description says so.
- When merging or resolving conflicts between branches, keep both sides' fixes unless one clearly supersedes the other. If that isn't clear, ask.
- Tests added by earlier PRs stay. Change one only when the behaviour it checks was intentionally changed, and say why.
