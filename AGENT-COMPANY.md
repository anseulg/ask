# Agent Company

[Agent Company](https://github.com/TOKTOKHAN-DEV/agent-company) is vendored as a
git submodule at `agent-company/`, installed with the `blank` template.

The submodule records only the upstream commit — the install itself (`node_modules`,
`.env`, the expanded template) is local, so its working tree is permanently dirty.
The submodule is marked `ignore = dirty` in `.gitmodules` to keep that noise out of
`git status` here; changes to the pinned commit still show up.

After cloning this repo:

```bash
git submodule update --init agent-company
cd agent-company
pnpm install
pnpm company-setup --template blank
pnpm check        # exit 0 = ready
```

Requires Node ≥ 20.11, pnpm ≥ 10, git ≥ 2.30. `codex` (image generation) and `gh`
(org follow/star) are optional; without them `pnpm check` reports warnings (`!`),
not failures (`✘`).

The roster starts empty. Add the first agent with `/create-agent` from inside
`agent-company/`, then run agents with `pnpm agent <id> "<task>"`.

See `agent-company/INSTALL.md` for the full guide.
