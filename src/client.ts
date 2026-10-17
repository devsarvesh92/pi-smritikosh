/**
 * Binary resolution, self-bootstrap, and CLI runner for smritikosh.
 *
 * Resolution order:
 *   1. config.path (~/.pi/agent/pi-smritikosh.json)
 *   2. $SMRITIKOSH_BIN
 *   3. The package-private venv (python/ installed via uv)
 *   4. PATH
 *   5. ~/.local/bin/smritikosh (pipx / uv tool installs)
 *
 * Everything is resolved to an absolute path so a broken PATH in
 * GUI-launched terminals never breaks the tools.
 */
import { execFile, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PiSmritikoshConfig } from "./config.js";

export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const VENV_DIR = path.join(PACKAGE_ROOT, ".venv");
export const VENV_BIN = path.join(VENV_DIR, "bin", "smritikosh");
export const PYTHON_SRC = path.join(PACKAGE_ROOT, "python");

const isExecutable = (p: string): boolean => {
    try {
        fs.accessSync(p, fs.constants.X_OK);
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
};

function which(cmd: string): string | null {
    try {
        const out = execFileSync("which", [cmd], { encoding: "utf8" }).trim();
        return out && isExecutable(out) ? out : null;
    } catch {
        return null;
    }
}

export function resolveBinary(config: PiSmritikoshConfig): string | null {
    const candidates = [
        config.path,
        process.env.SMRITIKOSH_BIN,
        VENV_BIN,
        which("smritikosh"),
        path.join(os.homedir(), ".local", "bin", "smritikosh"),
    ].filter((c): c is string => typeof c === "string" && c.length > 0);

    for (const c of candidates) {
        if (isExecutable(c)) return c;
    }
    return null;
}

export function findUv(): string | null {
    return (
        which("uv") ??
        [path.join(os.homedir(), ".local", "bin", "uv"), path.join(os.homedir(), ".cargo", "bin", "uv")].find(
            isExecutable,
        ) ??
        null
    );
}

export interface RunResult {
    ok: boolean;
    stdout: string;
    stderr: string;
    error?: string;
}

export function run(bin: string, args: string[], cwd: string): Promise<RunResult> {
    return new Promise((resolve) => {
        execFile(bin, args, { cwd, maxBuffer: 16 * 1024 * 1024, timeout: 10 * 60 * 1000 }, (err, stdout, stderr) => {
            if (err) {
                resolve({ ok: false, stdout: stdout ?? "", stderr: stderr ?? "", error: err.message });
            } else {
                resolve({ ok: true, stdout: stdout ?? "", stderr: stderr ?? "" });
            }
        });
    });
}

async function runStep(bin: string, args: string[], cwd: string): Promise<RunResult> {
    return run(bin, args, cwd);
}

export interface BootstrapResult {
    ok: boolean;
    bin?: string;
    message: string;
}

/**
 * Create the package-private venv and install the vendored smritikosh source
 * into it. Requires uv; uv brings its own Python, so no system Python needed.
 */
export async function bootstrap(): Promise<BootstrapResult> {
    const uv = findUv();
    if (!uv) {
        return {
            ok: false,
            message:
                "uv is not installed. Install it with `brew install uv` or " +
                "`curl -LsSf https://astral.sh/uv/install.sh | sh`, then run /smritikosh-setup again.",
        };
    }
    if (!fs.existsSync(path.join(PYTHON_SRC, "pyproject.toml"))) {
        return { ok: false, message: `Vendored smritikosh source missing at ${PYTHON_SRC}. Reinstall pi-smritikosh.` };
    }

    if (!fs.existsSync(path.join(VENV_DIR, "bin", "python"))) {
        const venv = await runStep(uv, ["venv", VENV_DIR], PACKAGE_ROOT);
        if (!venv.ok) {
            return { ok: false, message: `uv venv failed: ${venv.stderr || venv.error}` };
        }
    }

    // setuptools builds in-tree and would litter the vendored source with
    // build/ and *.egg-info/ — install from a throwaway copy instead.
    const staging = fs.mkdtempSync(path.join(os.tmpdir(), "pi-smritikosh-build-"));
    try {
        fs.cpSync(PYTHON_SRC, staging, { recursive: true });
        const install = await runStep(
            uv,
            ["pip", "install", "--python", path.join(VENV_DIR, "bin", "python"), staging],
            PACKAGE_ROOT,
        );
        if (!install.ok) {
            return { ok: false, message: `uv pip install failed: ${install.stderr || install.error}` };
        }
    } finally {
        fs.rmSync(staging, { recursive: true, force: true });
    }

    if (!isExecutable(VENV_BIN)) {
        return { ok: false, message: `Install completed but ${VENV_BIN} was not created.` };
    }
    return { ok: true, bin: VENV_BIN, message: `smritikosh installed at ${VENV_BIN}` };
}

/** The DuckDB index for a repo lives next to it, matching the CLI default. */
export function dbPathFor(repo: string): string {
    return path.join(repo, "smritikosh.duckdb");
}

export function hasIndex(repo: string): boolean {
    return fs.existsSync(dbPathFor(repo));
}
