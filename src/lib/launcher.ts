import * as p from "@clack/prompts";
import pc from "picocolors";
import { type Tool } from "../types";
import fg from "fast-glob";
import { spawn } from "node:child_process";

/**
 * Find a project file matching the given patterns in the workspace path
 * Returns the first match found, or null if none found
 */
async function findProjectFile(workspacePath: string, patterns: string[]): Promise<string | null> {
    const files = await fg(patterns, {
        cwd: workspacePath,
        absolute: true,
        onlyFiles: true,
        deep: 1,
    });
    return files.length > 0 ? files[0] : null;
}

/**
 * Spawn a detached process that continues after parent exits
 */
function spawnDetached(command: string, args: string[], cwd: string): void {
    // On Windows, use shell only for the command without args to avoid deprecation warning
    const child = spawn(command, args, {
        cwd,
        detached: true,
        stdio: "ignore",
        windowsHide: true,
    });
    child.unref();
}

export async function launchTool(tool: Tool, workspacePath: string) {
    p.log.info(pc.cyan(`Launching ${tool.name}...`));

    try {
        // Check if we should open a project file instead of the folder
        let targetPath = workspacePath;
        if (tool.projectFilePatterns && tool.projectFilePatterns.length > 0) {
            const projectFile = await findProjectFile(workspacePath, tool.projectFilePatterns);
            if (projectFile) {
                targetPath = projectFile;
                p.log.info(pc.dim(`Found project file: ${projectFile}`));
            }
        }

        if (tool.launchInTerminal) {
            // Tools that need to run inside a terminal (Claude, Gemini, etc.)
            if (tool.requiresAdmin) {
                // Use gsudo for admin elevation
                spawnDetached("gsudo", ["wt", "-d", workspacePath, "pwsh", "-NoExit", "-Command", tool.executable], workspacePath);
            } else {
                // Normal terminal without admin
                spawnDetached("wt", ["-d", workspacePath, "pwsh", "-NoExit", "-Command", tool.executable], workspacePath);
            }
        } else if (tool.id === "explorer") {
            // Explorer - just open the folder
            spawnDetached("explorer", [workspacePath], workspacePath);
        } else if (tool.id === "terminal") {
            // Windows Terminal - just open in directory
            spawnDetached("wt", ["-d", workspacePath], workspacePath);
        } else if (tool.id === "gitbash") {
            // Git Bash
            spawnDetached("git-bash", [`--cd=${workspacePath}`], workspacePath);
        } else {
            // IDEs and editors - spawn directly
            const args: string[] = [];
            if (tool.launchArgs) {
                args.push(tool.launchArgs);
            }
            args.push(targetPath);

            spawnDetached(tool.executable, args, workspacePath);
        }

        // Small pause to let user see the message
        await new Promise((r) => setTimeout(r, 500));
        p.log.success(`${tool.name} launched`);
    } catch (e) {
        p.log.error(`Failed to launch ${tool.name}: ${e}`);

        // Fallback for terminal-based tools
        if (tool.launchInTerminal) {
            try {
                p.log.warn("Trying fallback launch...");
                spawnDetached("wt", ["-d", workspacePath, "pwsh", "-NoExit"], workspacePath);
            } catch (err2) {
                p.log.error(`Fallback failed: ${err2}`);
            }
        }

        await p.text({ message: "Press Enter to continue..." });
    }
}
