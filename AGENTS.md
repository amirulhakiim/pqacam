# Agent rules

Do not put any comments in the code

## Disk full

The video tests write files to the temp folder. If a command fails with `ENOSPC` or `no space left on device`, delete the test files without asking, then run the command again:

```bash
rm -rf "${TMPDIR:-/tmp}"/wm-* "${TMPDIR:-/tmp}"/bucket-* "${TMPDIR:-/tmp}"/pqacam-jobs
```

If the command still fails, tell the user how much space `df -h /` shows as free.

## Share images

Apps keep a link preview image by its address. When you change how `src/server/share.ts` draws the image, add 1 to `SHARE_DESIGN` in `src/lib/share.ts`. The address then changes, and apps fetch the new image.

## Icons

Browsers keep a favicon for a long time. When you change a file in `public/` named `favicon.*` or `apple-touch-icon.png`, add 1 to `ICON_VERSION` in `src/routes/__root.tsx`.

## Commits

Commit each feature or fix when it is done and the checks pass. Do not leave finished work uncommitted.

1. Run these checks. Commit only when all pass.
   ```bash
   bun run format
   bun run lint
   bun run typecheck
   bun test
   ```
   `format` changes files in place. Add those changes to the same commit.
2. Make one commit per change. Do not put unrelated changes in the same commit.
3. Write the message as a conventional commit: `<type>: <description>`.
4. Keep the description short, lower case, and in the imperative mood. Do not add a body unless the change needs a reason that the code does not show.
5. Do not set an AI agent as the author or committer. Do not add a `Co-Authored-By` line for an AI agent.

| Type | Use for |
|---|---|
| `feat` | A new feature or a change to behavior |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `chore` | Dependencies, config, tooling |
| `refactor` | A code change with no change to behavior |
| `test` | Tests only |

Examples:

```
feat: add Google OAuth2 login support
chore: upgrade database driver to version 4.2.0
```
