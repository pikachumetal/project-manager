import * as p from "@clack/prompts";
import pc from "picocolors";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { type Project } from "../types";
import { saveProjects } from "../config";

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

// Browse for workspace (returns relative path from rootPath)
async function browseForWorkspace(rootPath: string): Promise<string | null> {
    let currentRelative = ".";

    while (true) {
        const currentAbsolute = resolve(rootPath, currentRelative);
        const dirs = getDirectories(currentAbsolute);
        const isAtRoot = currentRelative === ".";

        const options: { value: string; label: string; hint?: string }[] = [
            { value: "__SELECT__", label: pc.green("✓ Select this folder"), hint: currentRelative === "." ? "(root)" : currentRelative },
        ];

        if (!isAtRoot) {
            const parentRelative = dirname(currentRelative);
            options.push({ value: "__UP__", label: pc.yellow("↑ Go up"), hint: parentRelative === "." ? "(root)" : parentRelative });
        }

        options.push({ value: "__MANUAL__", label: pc.cyan("✎ Enter path manually") });

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
            currentRelative = choice as string;
        }
    }
}

export async function manageFlow(projects: Project[]) {
    if (!projects || projects.length === 0) {
        p.note("No projects to manage.", "Info");
        return;
    }

    // Create sorted list with original indices
    const sortedWithIndex = projects
        .map((proj, i) => ({ proj, originalIndex: i }))
        .sort((a, b) => a.proj.name.toLowerCase().localeCompare(b.proj.name.toLowerCase()));

    const selectedIndex = await p.select({
        message: "Select a project",
        options: sortedWithIndex.map(({ proj, originalIndex }) => ({
            value: originalIndex,
            label: proj.name,
            hint: pc.dim(proj.path),
        })),
    });

    if (p.isCancel(selectedIndex)) return;
    if (typeof selectedIndex !== "number") return;

    const project = projects[selectedIndex];

    // Choose action
    const action = await p.select({
        message: `What do you want to do with "${project.name}"?`,
        options: [
            { value: "edit-name", label: "✏️  Rename project" },
            { value: "edit-path", label: "📂 Change path" },
            { value: "edit-workspaces", label: "📁 Manage workspaces" },
            { value: "delete", label: pc.red("🗑️  Delete project") },
            { value: "back", label: "← Back" },
        ],
    });

    if (p.isCancel(action) || action === "back") return;

    if (action === "edit-name") {
        const newName = await p.text({
            message: "New project name",
            initialValue: project.name,
            validate: (val) => (!val ? "Name is required" : undefined),
        });
        if (p.isCancel(newName)) return;

        project.name = newName as string;
        saveProjects(projects);
        p.log.success(`Project renamed to "${project.name}"`);
    } else if (action === "edit-path") {
        const newPath = await p.text({
            message: "New project path",
            initialValue: project.path,
            validate: (val) => {
                if (!val) return "Path is required";
                if (!existsSync(val)) return "Path does not exist";
                if (!statSync(val).isDirectory()) return "Path is not a directory";
                return undefined;
            },
        });
        if (p.isCancel(newPath)) return;

        project.path = newPath as string;
        saveProjects(projects);
        p.log.success(`Project path updated to "${project.path}"`);
    } else if (action === "edit-workspaces") {
        await manageWorkspaces(project, projects);
    } else if (action === "delete") {
        const confirmed = await p.confirm({
            message: `Are you sure you want to delete "${project.name}"?`,
            initialValue: false,
        });
        if (confirmed === true) {
            projects.splice(selectedIndex, 1);
            saveProjects(projects);
            p.log.success("Project deleted");
        }
    }
}

async function manageWorkspaces(project: Project, allProjects: Project[]) {
    while (true) {
        const wsOptions = project.workspaces.map((ws, i) => ({
            value: i,
            label: ws.name,
            hint: pc.dim(ws.path),
        }));

        const action = await p.select({
            message: `Workspaces in "${project.name}"`,
            options: [
                { value: "add", label: pc.green("➕ Add workspace") },
                ...wsOptions.map((ws) => ({ ...ws, value: `edit-${ws.value}` })),
                { value: "back", label: "← Back" },
            ],
        });

        if (p.isCancel(action) || action === "back") return;

        if (action === "add") {
            const wsName = await p.text({
                message: "Workspace name",
                placeholder: "Frontend",
            });
            if (p.isCancel(wsName) || !wsName) continue;

            const wsPath = await browseForWorkspace(project.path);
            if (wsPath === null) continue;

            project.workspaces.push({ name: wsName as string, path: wsPath });
            saveProjects(allProjects);
            p.log.success(`Workspace "${wsName}" → ${wsPath} added`);
        } else if (typeof action === "string" && action.startsWith("edit-")) {
            const wsIndex = parseInt(action.replace("edit-", ""));
            const ws = project.workspaces[wsIndex];

            const wsAction = await p.select({
                message: `Workspace "${ws.name}"`,
                options: [
                    { value: "rename", label: "✏️  Rename" },
                    { value: "path", label: "📂 Change path" },
                    { value: "delete", label: pc.red("🗑️  Delete"), hint: wsIndex === 0 ? pc.yellow("Cannot delete Root") : undefined },
                    { value: "back", label: "← Back" },
                ],
            });

            if (p.isCancel(wsAction) || wsAction === "back") continue;

            if (wsAction === "rename") {
                const newName = await p.text({
                    message: "New workspace name",
                    initialValue: ws.name,
                });
                if (p.isCancel(newName) || !newName) continue;

                ws.name = newName as string;
                saveProjects(allProjects);
                p.log.success(`Workspace renamed to "${ws.name}"`);
            } else if (wsAction === "path") {
                const newPath = await p.text({
                    message: "New relative path",
                    initialValue: ws.path,
                });
                if (p.isCancel(newPath)) continue;

                ws.path = (newPath as string) || ".";
                saveProjects(allProjects);
                p.log.success(`Workspace path updated to "${ws.path}"`);
            } else if (wsAction === "delete") {
                if (wsIndex === 0) {
                    p.log.warn("Cannot delete the Root workspace");
                    continue;
                }
                const confirmed = await p.confirm({
                    message: `Delete workspace "${ws.name}"?`,
                    initialValue: false,
                });
                if (confirmed === true) {
                    project.workspaces.splice(wsIndex, 1);
                    saveProjects(allProjects);
                    p.log.success(`Workspace "${ws.name}" deleted`);
                }
            }
        }
    }
}
