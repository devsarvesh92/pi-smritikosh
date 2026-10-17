# pi-smritikosh

Semantic codebase exploration for the [pi coding agent](https://pi.dev), powered by
[smritikosh](https://github.com/smritikosh/smritikosh) — a semantic vector search CLI.

The smritikosh Python source is **vendored inside this package** (`python/`), so there is
nothing separate to install from PyPI. On first run it self-bootstraps into a
package-private venv using [uv](https://docs.astral.sh/uv/) (which brings its own Python).

## Install

```bash
pi install npm:pi-smritikosh        # or: pi install /path/to/pi-smritikosh
```

## What you get

**Tools the agent uses automatically** (with system-prompt guidelines steering it to
prefer them over grep/read for exploration):

| Tool | Wraps | Purpose |
|---|---|---|
| `smritikosh_search` | `explore search` | 1–8 facet queries in, ranked file locations out |
| `smritikosh_chunks` | `explore chunks` | Read exact code ranges / outlines from those locations |
| `smritikosh_index` | `index` | Build or incrementally refresh a repo's index |

If a repo has no index, `smritikosh_search` builds one automatically first
(disable with `"autoIndex": false`).

**IntelliJ-style background indexing:** on session start, the extension checks
the current repo and builds or refreshes its index in the background — search
is ready before you ask your first question. A footer status shows progress.
With `"watch": true`, it instead keeps `smritikosh index -L` alive for the
session so the index tracks your file saves in real time (killed automatically
when the session ends). Searches issued while indexing is in flight wait for
the run rather than racing it.

**Search enforcement:** bash commands that search the repo (`grep`, `rg`, `ag`,
`ack`, `find`, `fd`, `tree` as command starters) are blocked with a message
redirecting the model to `smritikosh_search`. Piped uses (`npm test | grep FAIL`)
are not repo searches and stay allowed, as do `ls`/`cat`/`head` orientation
commands. For genuine literal-string searches the model may retry the identical
command once. Disable with `"enforceSearchTools": false`.

**Commands:**

- `/smritikosh-setup` — install the bundled CLI into the package venv (consent-gated, requires uv)
- `/smritikosh-status` — show resolved binary, version, and index status

**Terminal UI** (commandcode.ai-inspired): the footer shows a `⌘ smritikosh`
brand mark with an accent progress bar while indexing, and all three tools
render custom TUI output — indigo file paths, green result counts, dim line
numbers and facet tags, with collapsed summaries that expand via ctrl+e.

## First run

1. The extension resolves the binary in order: config `path` → `$SMRITIKOSH_BIN` →
   package venv → `PATH` → `~/.local/bin/smritikosh`.
2. If nothing is found, you get one warning per session; run `/smritikosh-setup` and
   confirm — it runs `uv venv` + `uv pip install ./python` inside the package.
3. If the CLI is absent, the tools degrade gracefully: they tell the agent to fall back
   to grep/read instead of failing.

## Config

`~/.pi/agent/pi-smritikosh.json`:

```json
{
  "path": "/custom/path/to/smritikosh",
  "autoIndex": true,
  "indexOnStart": true,
  "watch": false,
  "enforceSearchTools": true
}
```

## Updating the vendored smritikosh

```bash
SMRITIKOSH_SRC=/path/to/smritikosh/repo npm run sync:smritikosh
```

(Src defaults to `../smritikosh`.) Then bump `version` in `package.json` and republish.

## Development

```bash
npm install          # dev deps for typechecking
npm run typecheck
pi -e .              # try the extension without installing it
```
