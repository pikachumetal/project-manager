import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync, spawn } from "node:child_process";
import { ConfigSchema, ToolsConfigSchema, SettingsSchema, DEFAULT_TOOLS, DEFAULT_SETTINGS, getDefaultProjects, type Project, type Tool, type Settings } from "./types";
import * as p from "@clack/prompts";

// Get directory path (compatible with both Node.js and Bun)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_PATH = join(__dirname, "..", "projects.json");
const TOOLS_PATH = join(__dirname, "..", "tools.json");
const RECENTS_PATH = join(__dirname, "..", "recents.json");
const SETTINGS_PATH = join(__dirname, "..", "settings.json");

export function loadProjects(): Project[] {
    if (!existsSync(CONFIG_PATH)) {
        return getDefaultProjects();
    }
    try {
        const data = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
        const projects = ConfigSchema.parse(data);
        return projects.length > 0 ? projects : getDefaultProjects();
    } catch (e) {
        p.log.error(`Error loading projects.json: ${e}`);
        return getDefaultProjects();
    }
}

// Recent projects tracking
export function loadRecents(): string[] {
    if (!existsSync(RECENTS_PATH)) {
        return [];
    }
    try {
        return JSON.parse(readFileSync(RECENTS_PATH, "utf-8"));
    } catch {
        return [];
    }
}

export function addRecent(projectName: string) {
    const recents = loadRecents().filter((r) => r !== projectName);
    recents.unshift(projectName); // Add to front
    const trimmed = recents.slice(0, 10); // Keep max 10
    writeFileSync(RECENTS_PATH, JSON.stringify(trimmed, null, 2));
}

export function saveProjects(projects: Project[]) {
    writeFileSync(CONFIG_PATH, JSON.stringify(projects, null, 2));
}

export function loadTools(): Tool[] {
    if (!existsSync(TOOLS_PATH)) {
        return DEFAULT_TOOLS;
    }
    try {
        const data = JSON.parse(readFileSync(TOOLS_PATH, "utf-8"));
        const tools = ToolsConfigSchema.parse(data);
        return tools.length > 0 ? tools : DEFAULT_TOOLS;
    } catch (e) {
        p.log.error(`Error loading tools.json: ${e}`);
        return DEFAULT_TOOLS;
    }
}

export function saveTools(tools: Tool[]) {
    writeFileSync(TOOLS_PATH, JSON.stringify(tools, null, 2));
}

// Settings
export function loadSettings(): Settings {
    if (!existsSync(SETTINGS_PATH)) {
        return DEFAULT_SETTINGS;
    }
    try {
        const data = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
        return SettingsSchema.parse(data);
    } catch {
        return DEFAULT_SETTINGS;
    }
}

export function saveSettings(settings: Settings) {
    writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

// Check if a command exists in PATH
export function commandExists(command: string): boolean {
    try {
        const result = spawnSync("where", [command], {
            stdio: "pipe",
            shell: true,
        });
        return result.status === 0;
    } catch {
        return false;
    }
}

// Check if gsudo is needed and available
export function checkGsudo(): { needed: boolean; available: boolean } {
    const tools = loadTools();
    const needsAdmin = tools.some((t) => t.enabled && t.requiresAdmin);
    if (!needsAdmin) {
        return { needed: false, available: false };
    }
    return { needed: true, available: commandExists("gsudo") };
}

// Install gsudo via winget
export async function installGsudo(): Promise<boolean> {
    return new Promise((resolve) => {
        const child = spawn("winget", ["install", "gerardog.gsudo", "--accept-source-agreements", "--accept-package-agreements"], {
            stdio: "inherit",
            shell: true,
        });

        child.on("close", (code) => {
            resolve(code === 0);
        });

        child.on("error", () => {
            resolve(false);
        });
    });
}
