/**
 * pi-smritikosh
 *
 * Semantic codebase exploration for pi, powered by the smritikosh CLI.
 * The CLI source is vendored under python/ and self-bootstraps into a
 * package-private venv (via uv) on first run — see /smritikosh-setup.
 *
 * Config: ~/.pi/agent/pi-smritikosh.json  ({ "path": "...", "autoIndex": true })
 * Commands: /smritikosh-setup, /smritikosh-status
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadConfig } from "./src/config.js";
import type { SmritikoshState } from "./src/state.js";
import { registerSmritikoshCommands, resolveOnSessionStart } from "./src/commands.js";
import { registerSmritikoshTools } from "./src/tools.js";
import { indexOnSessionStart, stopIndexer } from "./src/indexer.js";
import { registerEnforcement } from "./src/enforce.js";

export default function (pi: ExtensionAPI) {
    const state: SmritikoshState = {
        config: loadConfig(),
        bin: null,
        warnedMissing: false,
    };

    pi.on("session_start", (_event, ctx) => {
        state.config = loadConfig();
        resolveOnSessionStart(state, ctx);
        // IntelliJ-style: kick off background indexing immediately, never block startup.
        indexOnSessionStart(state, ctx);
    });

    pi.on("session_shutdown", () => {
        stopIndexer();
    });

    // Tools and commands are registered unconditionally at load time; the
    // tools themselves gate on state.bin so they degrade gracefully when the
    // CLI is not installed yet.
    registerSmritikoshTools(pi, state);
    registerSmritikoshCommands(pi, state);
    registerEnforcement(pi, state);
}
