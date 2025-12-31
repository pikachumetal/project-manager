import * as p from "@clack/prompts";
import pc from "picocolors";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { type Project } from "../types";
import { saveProjects, loadSettings } from "../config";

// Get directories in a path
function getDirectories(dirPath: string): string[] {
    try {
        if (!existsSync(dirPath)) return [];
        return readdirSync(dirPath)
            .filter((name) => {
                try {
                    const fullPath = join(dirPath, name);
                    return statSync(fullPath).isDirectory() && !name.startsWith(".");
                } catch {
                    return false;
                }
            })
            .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    } catch {
        return [];
    }
}

// Interactive folder browser (returns absolute path)
async function browseForFolder(startPath: string): Promise<string | null> {
    let currentPath = resolve(startPath);

    while (true) {
        const dirs = getDirectories(currentPath);
        const parentPath = dirname(currentPath);
        const canGoUp = parentPath !== currentPath;

        // Build options
        const options: { value: string; label: string; hint?: string }[] = [
            { value: "__SELECT__", label: pc.green("✓ Select this folder"), hint: currentPath },
        ];

        if (canGoUp) {
            options.push({ value: "__UP__", label: pc.yellow("↑ Go up"), hint: parentPath });
        }

        options.push({ value: "__MANUAL__", label: pc.cyan("✎ Enter path manually") });

        // Add subdirectories
        if (dirs.length > 0) {
            options.push({ value: "__SEPARATOR__", label: pc.dim("─── Subdirectories ───") });
            for (const dir of dirs.slice(0, 20)) {
                // Limit to 20 dirs for usability
                options.push({ value: join(currentPath, dir), label: `📁 ${dir}` });
            }
            if (dirs.length > 20) {
                options.push({ value: "__MORE__", label: pc.dim(`... and ${dirs.length - 20} more`) });
            }
        }

        const choice = await p.select({
            message: `Browse: ${pc.cyan(currentPath)}`,
            options,
        });

        if (p.isCancel(choice)) return null;

        if (choice === "__SELECT__") {
            return currentPath;
        } else if (choice === "__UP__") {
            currentPath = parentPath;
        } else if (choice === "__MANUAL__") {
            const manualPath = await p.text({
                message: "Enter absolute path",
                placeholder: "D:\\code\\my-project",
                validate: (val) => {
                    if (!val) return "Path is required";
                    if (!existsSync(val)) return "Path does not exist";
                    if (!statSync(val).isDirectory()) return "Path is not a directory";
                    return undefined;
                },
            });
            if (p.isCancel(manualPath)) continue;
            return manualPath as string;
        } else if (choice === "__SEPARATOR__" || choice === "__MORE__") {
            // Do nothing, just re-render
            continue;
        } else {
            // Navigate into selected directory
            currentPath = choice as string;
        }
    }
}

// Browse for workspace (returns relative path from rootPath)
async function browseForWorkspace(rootPath: string): Promise<string | null> {
    let currentRelative = ".";

    while (true) {
        const currentAbsolute = resolve(rootPath, currentRelative);
        const dirs = getDirectories(currentAbsolute);
        const isAtRoot = currentRelative === ".";

        // Build options
        const options: { value: string; label: string; hint?: string }[] = [
            { value: "__SELECT__", label: pc.green("✓ Select this folder"), hint: currentRelative === "." ? "(root)" : currentRelative },
        ];

        if (!isAtRoot) {
            const parentRelative = dirname(currentRelative);
            options.push({ value: "__UP__", label: pc.yellow("↑ Go up"), hint: parentRelative === "." ? "(root)" : parentRelative });
        }

        options.push({ value: "__MANUAL__", label: pc.cyan("✎ Enter path manually") });

        // Add subdirectories
        if (dirs.length > 0) {
            options.push({ value: "__SEPARATOR__", label: pc.dim("─── Subdirectories ───") });
            for (const dir of dirs.slice(0, 20)) {
                const relativePath = currentRelative === "." ? dir : `${currentRelative}/${dir}`;
                options.push({ value: relativePath, label: `📁 ${dir}` });
            }
            if (dirs.length > 20) {
                options.push({ value: "__MORE__", label: pc.dim(`... and ${dirs.length - 20} more`) });
            }
        }

        const choice = await p.select({
            message: `Select workspace folder ${pc.dim(`(in ${rootPath})`)}`,
            options,
        });

        if (p.isCancel(choice)) return null;

        if (choice === "__SELECT__") {
            return currentRelative;
        } else if (choice === "__UP__") {
            currentRelative = dirname(currentRelative);
            if (currentRelative === "") currentRelative = ".";
        } else if (choice === "__MANUAL__") {
            const manualPath = await p.text({
                message: "Enter relative path",
                placeholder: "src/frontend",
            });
            if (p.isCancel(manualPath)) continue;
            return (manualPath as string) || ".";
        } else if (choice === "__SEPARATOR__" || choice === "__MORE__") {
            continue;
        } else {
            // Navigate into selected directory
            currentRelative = choice as string;
        }
    }
}

export async function addFlow(projects: Project[]) {
    const name = await p.text({ message: "Project Name", placeholder: "My Awesome Project" });
    if (p.isCancel(name)) return;

    // Choose how to select the path
    const pathMethod = await p.select({
        message: "How do you want to select the project path?",
        options: [
            { value: "browse", label: "📂 Browse folders", hint: "Navigate through directories" },
            { value: "manual", label: "✎ Enter path manually", hint: "Type the full path" },
        ],
    });
    if (p.isCancel(pathMethod)) return;

    let rootPath = "";

    if (pathMethod === "browse") {
        // Ask for starting directory (use settings for default)
        const settings = loadSettings();
        const defaultPath = settings.defaultCodePath;

        const startDir = await p.text({
            message: `Starting directory (or press Enter for ${defaultPath})`,
            placeholder: defaultPath,
            defaultValue: defaultPath,
            validate: (val) => {
                const path = val || defaultPath;
                if (!existsSync(path)) return `Directory "${path}" does not exist`;
                if (!statSync(path).isDirectory()) return "Not a directory";
                return undefined;
            },
        });
        if (p.isCancel(startDir)) return;

        const startPath = (startDir as string) || defaultPath;
        const selected = await browseForFolder(startPath);

        if (!selected) return;
        rootPath = selected;
    } else {
        const manualPath = await p.text({
            message: "Root Path (Absolute)",
            placeholder: "D:\\code\\my-project",
            validate: (val) => {
                if (!val) return "Path is required";
                if (!existsSync(val)) return "Path does not exist";
                if (!statSync(val).isDirectory()) return "Path is not a directory";
                return undefined;
            },
        });
        if (p.isCancel(manualPath)) return;
        rootPath = manualPath as string;
    }

    const newProject: Project = {
        name: name as string,
        path: rootPath,
        workspaces: [{ name: "Root", path: "." }],
    };

    // Check for common workspace patterns
    const potentialWorkspaces = ["frontend", "backend", "web", "api", "app", "apps", "packages", "src"];
    const existingWorkspaces = potentialWorkspaces.filter((ws) => existsSync(join(rootPath, ws)));

    if (existingWorkspaces.length > 0) {
        const addDetected = await p.confirm({
            message: `Found folders: ${existingWorkspaces.join(", ")}. Add as workspaces?`,
            initialValue: true,
        });

        if (!p.isCancel(addDetected) && addDetected) {
            for (const ws of existingWorkspaces) {
                newProject.workspaces.push({
                    name: ws.charAt(0).toUpperCase() + ws.slice(1),
                    path: ws,
                });
            }
        }
    }

    const addWorkspaces = await p.confirm({
        message: "Add more sub-workspaces?",
        initialValue: false,
    });

    if (!p.isCancel(addWorkspaces) && addWorkspaces) {
        let adding = true;
        while (adding) {
            const wsName = await p.text({ message: "Workspace Name (empty to stop)", placeholder: "Frontend" });
            if (p.isCancel(wsName) || !wsName) {
                adding = false;
                break;
            }

            const wsPath = await browseForWorkspace(rootPath);
            if (wsPath === null) break;

            newProject.workspaces.push({ name: wsName as string, path: wsPath });
            p.log.success(`Added workspace "${wsName}" → ${wsPath}`);
        }
    }

    projects.push(newProject);
    saveProjects(projects);
    p.note(`Project "${newProject.name}" added successfully!\nPath: ${rootPath}`, "Success");
}
