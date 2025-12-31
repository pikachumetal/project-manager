import * as p from "@clack/prompts";
import pc from "picocolors";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { type Project, type Workspace, type Tool } from "../types";
import { loadTools, loadRecents, addRecent } from "../config";
import { launchTool } from "../lib/launcher";

// Get icon for tool
function getToolIcon(tool: Tool): string {
    const icons: Record<string, string> = {
        claude: "🤖",
        gemini: "✨",
        vscode: "📝",
        antigravity: "🚀",
        rider: "🏇",
        intellij: "💡",
        webstorm: "🌐",
        terminal: "💻",
        gitbash: "🐚",
        explorer: "📁",
    };
    return icons[tool.id] || "🔧";
}

// Get git status for a project path
function getGitStatus(projectPath: string): string {
    if (!existsSync(join(projectPath, ".git"))) {
        return "";
    }

    try {
        // Get current branch
        const branchProc = Bun.spawnSync(["git", "rev-parse", "--abbrev-ref", "HEAD"], {
            cwd: projectPath,
            stdout: "pipe",
            stderr: "pipe",
        });
        const branch = branchProc.stdout.toString().trim();

        // Check for uncommitted changes
        const statusProc = Bun.spawnSync(["git", "status", "--porcelain"], {
            cwd: projectPath,
            stdout: "pipe",
            stderr: "pipe",
        });
        const changes = statusProc.stdout.toString().trim();
        const hasChanges = changes.length > 0;

        if (branch) {
            const branchIcon = hasChanges ? pc.yellow("●") : pc.green("✓");
            return `${branchIcon} ${pc.cyan(branch)}`;
        }
    } catch {
        // Ignore git errors
    }
    return "";
}

// Sort projects: recents first, then alphabetically
function sortProjects(projects: Project[], recents: string[]): Project[] {
    return [...projects].sort((a, b) => {
        const aIndex = recents.indexOf(a.name);
        const bIndex = recents.indexOf(b.name);

        // Both are recent - sort by recency
        if (aIndex !== -1 && bIndex !== -1) {
            return aIndex - bIndex;
        }
        // Only a is recent
        if (aIndex !== -1) return -1;
        // Only b is recent
        if (bIndex !== -1) return 1;
        // Neither is recent - sort alphabetically
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
}

export async function launchFlow(projects: Project[]) {
    if (!projects || projects.length === 0) {
        p.note("No projects found. Please add a project first.", "Warning");
        await new Promise((r) => setTimeout(r, 1000));
        return;
    }

    const recents = loadRecents();
    const sortedProjects = sortProjects(projects, recents);

    // Build options with git status
    const projectOptions = sortedProjects.map((proj, idx) => {
        const isRecent = recents.includes(proj.name);
        const gitStatus = getGitStatus(proj.path);
        const recentBadge = isRecent && idx < 3 ? pc.magenta("★ ") : "";
        const pathExists = existsSync(proj.path);

        let hint = pathExists ? pc.dim(proj.path) : pc.red("⚠ Path not found");
        if (gitStatus) {
            hint = `${gitStatus} ${hint}`;
        }

        return {
            value: proj,
            label: `${recentBadge}${proj.name}`,
            hint,
        };
    });

    const project = await p.select({
        message: "Select a project",
        options: projectOptions,
    });

    if (p.isCancel(project)) return;

    const selectedProject = project as Project;

    // Check if path exists
    if (!existsSync(selectedProject.path)) {
        p.log.error(`Project path does not exist: ${selectedProject.path}`);
        return;
    }

    let workspacePath = selectedProject.path;
    let workspaceName = "Root";

    if (selectedProject.workspaces.length > 1) {
        const ws = await p.select({
            message: "Select workspace/folder",
            options: selectedProject.workspaces.map((w) => ({
                value: w,
                label: w.name,
                hint: pc.dim(w.path === "." ? "Root" : w.path),
            })),
        });

        if (p.isCancel(ws)) return;
        const selectedWs = ws as Workspace;
        workspacePath = join(selectedProject.path, selectedWs.path);
        workspaceName = selectedWs.name;
    }

    // Get enabled tools for launcher
    const tools = loadTools().filter((t) => t.enabled);

    if (tools.length === 0) {
        p.note("No tools enabled. Go to Tools & Updates → Manage Tools to enable some.", "Warning");
        return;
    }

    // Build multiselect options
    const toolOptions = tools.map((tool) => ({
        value: tool,
        label: `${getToolIcon(tool)} ${tool.name}`,
        hint: tool.launchInTerminal ? "Opens in terminal" : undefined,
    }));

    const selectedTools = await p.multiselect({
        message: `Open ${pc.bold(selectedProject.name)} (${workspaceName}) in...`,
        options: toolOptions,
        required: true,
    });

    if (p.isCancel(selectedTools)) return;

    // Track as recent
    addRecent(selectedProject.name);

    // Launch all selected tools
    for (const tool of selectedTools as Tool[]) {
        await launchTool(tool, workspacePath);
    }
}

// Quick launch by project name and tool
export async function quickLaunch(projects: Project[], projectQuery: string, toolId?: string) {
    // Find project by name (case insensitive, partial match)
    const project = projects.find(
        (p) =>
            p.name.toLowerCase() === projectQuery.toLowerCase() ||
            p.name.toLowerCase().includes(projectQuery.toLowerCase())
    );

    if (!project) {
        p.log.error(`Project not found: ${projectQuery}`);
        p.log.info(`Available: ${projects.map((p) => p.name).join(", ")}`);
        return;
    }

    if (!existsSync(project.path)) {
        p.log.error(`Project path does not exist: ${project.path}`);
        return;
    }

    const tools = loadTools().filter((t) => t.enabled);

    let tool: Tool | undefined;
    if (toolId) {
        tool = tools.find((t) => t.id === toolId || t.name.toLowerCase().includes(toolId.toLowerCase()));
        if (!tool) {
            p.log.error(`Tool not found: ${toolId}`);
            p.log.info(`Available: ${tools.map((t) => `${t.id} (${t.name})`).join(", ")}`);
            return;
        }
    } else {
        // Use first tool as default
        tool = tools[0];
    }

    addRecent(project.name);
    await launchTool(tool, project.path);
}
