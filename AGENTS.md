# Agent rules

Do not put any comments in the code

## Commits

Commit each feature or fix when it is done and the checks pass. Do not leave finished work uncommitted.

1. Run `bun run typecheck` and `bun test`. Commit only when both pass.
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
