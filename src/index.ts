import * as p from "@clack/prompts";
import pc from "picocolors";
import { loadProjects, loadSettings, saveSettings, checkGsudo, installGsudo } from "./config";
import { launchFlow, quickLaunch } from "./flows/launch";
import { toolsFlow } from "./flows/tools";
import { addFlow } from "./flows/add";
import { manageFlow } from "./flows/manage";
import { existsSync } from "node:fs";

// Restore terminal state on exit/cancel
function restoreTerminal() {
  // Show cursor
  process.stdout.write("\x1B[?25h");
  // Reset terminal modes
  if (process.stdin.isTTY) {
    process.stdin.setRawMode?.(false);
  }
  // Clear any pending input
  process.stdout.write("\n");
}

// Handle process signals for clean exit
process.on("SIGINT", () => {
  restoreTerminal();
  process.exit(0);
});
process.on("SIGTERM", () => {
  restoreTerminal();
  process.exit(0);
});
process.on("exit", () => {
  // Ensure cursor is visible on any exit
  process.stdout.write("\x1B[?25h");
});

// Settings flow
async function settingsFlow() {
  const settings = loadSettings();

  const action = await p.select({
    message: "Settings",
    options: [
      { value: "codePath", label: "📂 Default Code Path", hint: settings.defaultCodePath },
      { value: "defaultTool", label: "🔧 Default Tool", hint: settings.defaultTool },
      { value: "back", label: "← Back" },
    ],
  });

  if (p.isCancel(action) || action === "back") return;

  if (action === "codePath") {
    const newPath = await p.text({
      message: "Default code path",
      placeholder: settings.defaultCodePath,
      defaultValue: settings.defaultCodePath,
      validate: (val) => {
        if (!val) return "Path is required";
        if (!existsSync(val)) return `Path "${val}" does not exist`;
        return undefined;
      },
    });

    if (!p.isCancel(newPath)) {
      settings.defaultCodePath = newPath as string;
      saveSettings(settings);
      p.log.success(`Default code path set to: ${newPath}`);
    }
  } else if (action === "defaultTool") {
    const newTool = await p.text({
      message: "Default tool ID (e.g., claude, vscode, terminal)",
      placeholder: settings.defaultTool,
      defaultValue: settings.defaultTool,
    });

    if (!p.isCancel(newTool)) {
      settings.defaultTool = newTool as string;
      saveSettings(settings);
      p.log.success(`Default tool set to: ${newTool}`);
    }
  }
}

// Show help
function showHelp() {
  console.log(`
${pc.bold("Project Manager")} - Interactive project launcher

${pc.yellow("Usage:")}
  pm                          Interactive mode
  pm <project>                Quick launch project with default tool
  pm <project> <tool>         Quick launch with specific tool

${pc.yellow("Examples:")}
  pm                          Open interactive menu
  pm myapp                    Launch "myapp" with default tool
  pm myapp claude             Launch "myapp" in Claude Code
  pm myapp vscode             Launch "myapp" in VS Code

${pc.yellow("Options:")}
  --help, -h                  Show this help
`);
}

// Check for gsudo and offer to install if missing
async function checkAndInstallGsudo(): Promise<void> {
  const { needed, available } = checkGsudo();

  if (!needed || available) {
    return;
  }

  p.log.warn(pc.yellow("⚠️  gsudo is not installed but is required for some tools (Claude Code, Gemini CLI)"));

  const shouldInstall = await p.confirm({
    message: "Would you like to install gsudo via winget?",
    initialValue: true,
  });

  if (p.isCancel(shouldInstall) || !shouldInstall) {
    p.log.info(pc.dim("You can install it later with: winget install gerardog.gsudo"));
    p.log.info(pc.dim("Or disable admin requirement for tools in Tools & Updates menu"));
    return;
  }

  p.log.info("Installing gsudo...");
  const success = await installGsudo();

  if (success) {
    p.log.success("gsudo installed successfully!");
    p.log.info(pc.dim("You may need to restart your terminal for gsudo to be available"));
  } else {
    p.log.error("Failed to install gsudo");
    p.log.info(pc.dim("Try manually: winget install gerardog.gsudo"));
  }
}

async function main() {
  // Parse CLI arguments
  const args = process.argv.slice(2);

  // Handle help flag
  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    process.exit(0);
  }

  // Quick launch mode: go-code <project> [tool]
  if (args.length > 0 && !args[0].startsWith("-")) {
    const projects = loadProjects();
    const projectQuery = args[0];
    const toolId = args[1] || loadSettings().defaultTool;

    // Check for gsudo before quick launch
    await checkAndInstallGsudo();

    await quickLaunch(projects, projectQuery, toolId);
    process.exit(0);
  }

  // Interactive mode
  process.stdout.write("\x1Bc"); // Clear screen
  p.intro(`${pc.bgCyan(pc.black(" PROJECT MANAGER "))} 🚀`);

  // Check for gsudo on first run
  await checkAndInstallGsudo();

  while (true) {
    const projects = loadProjects(); // Reload to get fresh state

    const action = await p.select({
      message: "What would you like to do?",
      options: [
        { value: "launch", label: "🚀 Launch Project", hint: "Select a project to open" },
        { value: "tools", label: "🛠️  Tools & Updates", hint: "Update Claude, Gemini, etc." },
        { value: "add", label: "➕ Add New Project", hint: "Configure a new workspace" },
        { value: "manage", label: "⚙️  Manage Projects", hint: "Edit or remove existing projects" },
        { value: "settings", label: "⚙️  Settings", hint: "Configure defaults" },
        { value: "exit", label: "🚪 Exit" },
      ],
    });

    if (p.isCancel(action) || action === "exit") {
      restoreTerminal();
      p.outro("Bye! 👋");
      process.exit(0);
    }

    try {
      if (action === "launch") {
        await launchFlow(projects);
      } else if (action === "tools") {
        await toolsFlow();
      } else if (action === "add") {
        await addFlow(projects);
      } else if (action === "manage") {
        await manageFlow(projects);
      } else if (action === "settings") {
        await settingsFlow();
      }
    } catch (err) {
      restoreTerminal();
      p.log.error(String(err));
    }
  }
}

main().catch((err) => {
  restoreTerminal();
  process.stderr.write(`Error: ${err}\n`);
});
