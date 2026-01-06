import { join } from "node:path";
import { homedir } from "node:os";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { spawnSync, spawn } from "node:child_process";
import { ConfigSchema, ToolsConfigSchema, SettingsSchema, DEFAULT_TOOLS, DEFAULT_SETTINGS, getDefaultProjects, type Project, type Tool, type Settings } from "./types";
import * as p from "@clack/prompts";

// Config directory in user's home folder
const CONFIG_DIR = join(homedir(), ".project-manager");
const CONFIG_PATH = join(CONFIG_DIR, "projects.json");
const TOOLS_PATH = join(CONFIG_DIR, "tools.json");
const RECENTS_PATH = join(CONFIG_DIR, "recents.json");
const SETTINGS_PATH = join(CONFIG_DIR, "settings.json");

// Ensure config directory exists
function ensureConfigDir() {
    if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true });
    }
}

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
    ensureConfigDir();
    const recents = loadRecents().filter((r) => r !== projectName);
    recents.unshift(projectName); // Add to front
    const trimmed = recents.slice(0, 10); // Keep max 10
    writeFileSync(RECENTS_PATH, JSON.stringify(trimmed, null, 2));
}

export function saveProjects(projects: Project[]) {
    ensureConfigDir();
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
    ensureConfigDir();
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
    ensureConfigDir();
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

// Check if gsudo might be needed (tools that support admin) and if it's available
export function checkGsudo(): { needed: boolean; available: boolean } {
    const tools = loadTools();
    const hasAdminTools = tools.some((t) => t.enabled && t.supportsAdmin);
    if (!hasAdminTools) {
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
