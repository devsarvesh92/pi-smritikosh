import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import fs from "node:fs";
import { bootstrap, dbPathFor, hasIndex, PACKAGE_ROOT, resolveBinary, run, VENV_BIN } from "./client.js";
import { getConfigPath } from "./config.js";
import type { SmritikoshState } from "./state.js";
import { statusBusy, statusReady } from "./ui.js";

export function registerSmritikoshCommands(pi: ExtensionAPI, state: SmritikoshState): void {
    pi.registerCommand("smritikosh-setup", {
        description: "Install the bundled smritikosh CLI into the package's private venv (via uv)",
        handler: async (_args, ctx) => {
            if (state.bin) {
                ctx.ui.notify(`smritikosh already available at ${state.bin}`, "info");
                return;
            }
            const ok = ctx.hasUI
                ? await ctx.ui.confirm(
                      "Install smritikosh?",
                      "Create a private venv inside the pi-smritikosh package and install the bundled smritikosh source into it (requires uv).",
                  )
                : true;
            if (!ok) {
                ctx.ui.notify("Skipped. smritikosh tools stay disabled until you run /smritikosh-setup.", "warning");
                return;
            }

            ctx.ui.setStatus("smritikosh", statusBusy(ctx.ui.theme, 0, "installing"));
            const result = await bootstrap();
            ctx.ui.setStatus("smritikosh", result.ok ? statusReady(ctx.ui.theme) : undefined);

            if (result.ok && result.bin) {
                state.bin = result.bin;
                ctx.ui.notify(result.message, "info");
            } else {
                ctx.ui.notify(result.message, "error");
            }
        },
    });

    pi.registerCommand("smritikosh-status", {
        description: "Show smritikosh binary, version, and index status for the current repo",
        handler: async (_args, ctx) => {
            const lines: string[] = [];
            lines.push(`binary: ${state.bin ?? "not found"}`);
            lines.push(`bundled source: ${fs.existsSync(PACKAGE_ROOT + "/python/pyproject.toml") ? "present" : "MISSING"}`);
            lines.push(`venv binary: ${fs.existsSync(VENV_BIN) ? VENV_BIN : "not created yet"}`);
            lines.push(`config: ${getConfigPath()}`);
            if (state.bin) {
                const version = await run(state.bin, ["--version"], ctx.cwd);
                lines.push(`version: ${version.ok ? version.stdout.trim() : "unknown"}`);
            }
            lines.push(`index for cwd: ${hasIndex(ctx.cwd) ? dbPathFor(ctx.cwd) : "none"}`);
            ctx.ui.notify(lines.join("\n"), state.bin ? "info" : "warning");
        },
    });
}

/** One-time per-session resolver + gentle missing-binary warning. */
export function resolveOnSessionStart(state: SmritikoshState, ctx: ExtensionContext): void {
    state.bin = resolveBinary(state.config);
    if (state.bin) {
        if (ctx.hasUI) ctx.ui.setStatus("smritikosh", statusReady(ctx.ui.theme));
    } else if (ctx.hasUI && !state.warnedMissing) {
        state.warnedMissing = true;
        ctx.ui.notify("smritikosh CLI not found — run /smritikosh-setup to install the bundled copy.", "warning");
    }
}
