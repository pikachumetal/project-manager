import * as p from "@clack/prompts";
import pc from "picocolors";
import { loadTools, saveTools } from "../config";
import { type Tool, DEFAULT_TOOLS } from "../types";

// Helper to run command async with timeout
async function runCommand(cmd: string[], timeoutMs = 10000): Promise<string> {
    return new Promise((resolve) => {
        const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
        const timeout = setTimeout(() => {
            proc.kill();
            resolve("");
        }, timeoutMs);

        proc.exited.then(async () => {
            clearTimeout(timeout);
            try {
                const text = await new Response(proc.stdout).text();
                resolve(text.trim());
            } catch {
                resolve("");
            }
        });
    });
}

export async function toolsFlow() {
    const action = await p.select({
        message: "Tools & Updates",
        options: [
            { value: "check-versions", label: "📋 Check Versions" },
            { value: "update", label: "🔄 Update Tools" },
            { value: "manage", label: "⚙️  Manage Tools", hint: "Add, edit, enable/disable" },
            { value: "back", label: "← Back" },
        ],
    });

    if (p.isCancel(action) || action === "back") return;

    if (action === "check-versions") {
        await checkVersions();
    } else if (action === "update") {
        await updateTools();
    } else if (action === "manage") {
        await manageTools();
    }
}

async function checkVersions() {
    // Only check tools that are enabled AND have version args
    const tools = loadTools().filter((t) => t.enabled && t.versionArgs);

    if (tools.length === 0) {
        p.note("No versionable tools enabled.", "Info");
        return;
    }

    const s = p.spinner();
    s.start(`Checking ${tools.length} tool(s)...`);

    const results = await Promise.all(
        tools.map(async (tool) => {
            const ver = await runCommand(["cmd", "/c", tool.executable, ...tool.versionArgs.split(" ")]);
            // Take only the first line of version output
            const firstLine = ver.split("\n")[0]?.trim() || "";
            return {
                name: tool.name,
                version: firstLine || pc.yellow("Not installed"),
            };
        })
    );

    s.stop("Versions checked");

    const versionText = results.map((v) => `${v.name}: ${v.version}`).join("\n");
    p.note(versionText, "Installed Versions");
}

async function updateTools() {
    const tools = loadTools().filter((t) => t.enabled && t.updateCommand);

    if (tools.length === 0) {
        p.note("No updatable tools enabled.", "Info");
        return;
    }

    const toolToUpdate = await p.select({
        message: "Select tool to update",
        options: [
            { value: "all", label: "🔄 Update All" },
            ...tools.map((t) => ({ value: t.id, label: t.name })),
            { value: "back", label: "← Back" },
        ],
    });

    if (p.isCancel(toolToUpdate) || toolToUpdate === "back") return;

    const toUpdate = toolToUpdate === "all" ? tools : tools.filter((t) => t.id === toolToUpdate);

    for (const tool of toUpdate) {
        if (!tool.updateCommand) continue;

        p.log.step(`Updating ${tool.name}...`);
        const args = tool.updateCommand.split(" ");
        Bun.spawnSync(["cmd", "/c", ...args], { stdio: ["inherit", "inherit", "inherit"] });
        p.log.success(`${tool.name} update complete`);
    }
}

async function manageTools() {
    while (true) {
        const tools = loadTools();

        const options = [
            { value: "add", label: pc.green("➕ Add tool") },
            { value: "reset", label: pc.yellow("↺ Reset to defaults") },
            ...tools.map((t) => ({
                value: t.id,
                label: `${t.enabled ? "●" : "○"} ${t.name}`,
                hint: pc.dim(`${t.executable}${t.updateCommand ? " (updatable)" : ""}`),
            })),
            { value: "back", label: "← Back" },
        ];

        const action = await p.select({
            message: "Manage Tools",
            options,
        });

        if (p.isCancel(action) || action === "back") return;

        if (action === "add") {
            await addTool(tools);
        } else if (action === "reset") {
            const confirm = await p.confirm({
                message: "Reset tools to defaults? This will remove custom tools.",
                initialValue: false,
            });
            if (confirm === true) {
                saveTools(DEFAULT_TOOLS);
                p.log.success("Tools reset to defaults");
            }
        } else {
            await editTool(tools, action as string);
        }
    }
}

async function addTool(tools: Tool[]) {
    const name = await p.text({
        message: "Tool name",
        placeholder: "My Tool",
        validate: (v) => (!v ? "Name required" : undefined),
    });
    if (p.isCancel(name)) return;

    const id = (name as string).toLowerCase().replace(/\s+/g, "-");

    const executable = await p.text({
        message: "Executable command",
        placeholder: "mytool",
        validate: (v) => (!v ? "Executable required" : undefined),
    });
    if (p.isCancel(executable)) return;

    const versionArgs = await p.text({
        message: "Version arguments",
        initialValue: "--version",
    });
    if (p.isCancel(versionArgs)) return;

    const isUpdatable = await p.confirm({
        message: "Is this tool updatable?",
        initialValue: false,
    });
    if (p.isCancel(isUpdatable)) return;

    let updateCommand: string | undefined;
    if (isUpdatable) {
        const cmd = await p.text({
            message: "Update command",
            placeholder: "mytool update",
        });
        if (p.isCancel(cmd)) return;
        updateCommand = cmd as string;
    }

    const launchInTerminal = await p.confirm({
        message: "Can launch in project terminal?",
        initialValue: false,
    });
    if (p.isCancel(launchInTerminal)) return;

    const newTool: Tool = {
        id,
        name: name as string,
        executable: executable as string,
        versionArgs: (versionArgs as string) || "--version",
        updateCommand,
        enabled: true,
        launchInTerminal: launchInTerminal as boolean,
    };

    tools.push(newTool);
    saveTools(tools);
    p.log.success(`Tool "${name}" added`);
}

async function editTool(tools: Tool[], toolId: string) {
    const toolIndex = tools.findIndex((t) => t.id === toolId);
    if (toolIndex === -1) return;

    const tool = tools[toolIndex];

    const action = await p.select({
        message: `Edit "${tool.name}"`,
        options: [
            { value: "toggle", label: tool.enabled ? "○ Disable" : "● Enable" },
            { value: "edit-name", label: "✏️  Edit name" },
            { value: "edit-executable", label: "⌨️  Edit executable" },
            { value: "edit-version", label: "📋 Edit version args" },
            { value: "edit-update", label: "🔄 Edit update command" },
            { value: "delete", label: pc.red("🗑️  Delete") },
            { value: "back", label: "← Back" },
        ],
    });

    if (p.isCancel(action) || action === "back") return;

    if (action === "toggle") {
        tool.enabled = !tool.enabled;
        saveTools(tools);
        p.log.success(`${tool.name} ${tool.enabled ? "enabled" : "disabled"}`);
    } else if (action === "edit-name") {
        const newName = await p.text({
            message: "New name",
            initialValue: tool.name,
        });
        if (p.isCancel(newName) || !newName) return;
        tool.name = newName as string;
        saveTools(tools);
        p.log.success("Name updated");
    } else if (action === "edit-executable") {
        const newExec = await p.text({
            message: "New executable",
            initialValue: tool.executable,
        });
        if (p.isCancel(newExec) || !newExec) return;
        tool.executable = newExec as string;
        saveTools(tools);
        p.log.success("Executable updated");
    } else if (action === "edit-version") {
        const newArgs = await p.text({
            message: "Version arguments",
            initialValue: tool.versionArgs,
        });
        if (p.isCancel(newArgs)) return;
        tool.versionArgs = (newArgs as string) || "--version";
        saveTools(tools);
        p.log.success("Version args updated");
    } else if (action === "edit-update") {
        const newCmd = await p.text({
            message: "Update command (empty to disable updates)",
            initialValue: tool.updateCommand || "",
        });
        if (p.isCancel(newCmd)) return;
        tool.updateCommand = (newCmd as string) || undefined;
        saveTools(tools);
        p.log.success("Update command updated");
    } else if (action === "delete") {
        const confirm = await p.confirm({
            message: `Delete "${tool.name}"?`,
            initialValue: false,
        });
        if (confirm === true) {
            tools.splice(toolIndex, 1);
            saveTools(tools);
            p.log.success(`${tool.name} deleted`);
        }
    }
}
