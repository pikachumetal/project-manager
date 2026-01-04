import { z } from "zod";

export const WorkspaceSchema = z.object({
  name: z.string(),
  path: z.string(),
});

export const ProjectSchema = z.object({
  name: z.string(),
  path: z.string(),
  workspaces: z.array(WorkspaceSchema).default([{ name: "Root", path: "." }]),
  command: z.string().optional(),
});

export const ConfigSchema = z.array(ProjectSchema);

export type Project = z.infer<typeof ProjectSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;

// Get user's home directory for default projects
function getDefaultCodePath(): string {
  return process.env.USERPROFILE
    ? `${process.env.USERPROFILE}\\Documents\\code`
    : "C:\\code";
}

// Default projects (empty - user adds their own)
export function getDefaultProjects(): Project[] {
  // Return empty array - users will add their own projects
  return [];
}

// User settings
export const SettingsSchema = z.object({
  defaultCodePath: z.string().default("D:/code/git"),
  defaultTool: z.string().default("claude"),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  defaultCodePath: "D:/code/git",
  defaultTool: "claude",
};

// Tools configuration
export const ToolSchema = z.object({
  id: z.string(),
  name: z.string(),
  executable: z.string(),
  versionArgs: z.string().optional(),
  updateCommand: z.string().optional(),
  enabled: z.boolean().default(true),
  launchInTerminal: z.boolean().default(false),
  supportsAdmin: z.boolean().default(false),
  launchArgs: z.string().optional(),
  // Patterns to find project files (e.g., ["*.code-workspace"], ["*.sln", "*.slnx"])
  projectFilePatterns: z.array(z.string()).optional(),
});

export const ToolsConfigSchema = z.array(ToolSchema);

export type Tool = z.infer<typeof ToolSchema>;

// Default tools
export const DEFAULT_TOOLS: Tool[] = [
  // AI Assistants (updatable, launch in terminal, require admin)
  {
    id: "claude",
    name: "Claude Code",
    executable: "claude",
    versionArgs: "--version",
    updateCommand: "claude update",
    enabled: true,
    launchInTerminal: true,
    supportsAdmin: true,
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    executable: "gemini",
    versionArgs: "--version",
    updateCommand: "bun update --global @google/gemini-cli",
    enabled: true,
    launchInTerminal: true,
    supportsAdmin: true,
  },
  // Editors & IDEs
  {
    id: "antigravity",
    name: "Antigravity",
    executable: "antigravity",
    enabled: true,
    launchInTerminal: false,
    projectFilePatterns: ["*.code-workspace"],
  },
  {
    id: "vscode",
    name: "VS Code",
    executable: "code",
    enabled: true,
    launchInTerminal: false,
    projectFilePatterns: ["*.code-workspace"],
  },
  {
    id: "vscode-insiders",
    name: "VS Code Insiders",
    executable: "code-insiders",
    enabled: false,
    launchInTerminal: false,
    projectFilePatterns: ["*.code-workspace"],
  },
  {
    id: "vs",
    name: "Visual Studio",
    executable: "devenv",
    enabled: false,
    launchInTerminal: false,
    projectFilePatterns: ["*.slnx", "*.sln"],
  },
  // JetBrains IDEs (use Toolbox script names from PATH)
  {
    id: "rider",
    name: "Rider",
    executable: "rider",
    enabled: true,
    launchInTerminal: false,
    projectFilePatterns: ["*.slnx", "*.sln"],
  },
  {
    id: "idea",
    name: "IntelliJ IDEA",
    executable: "idea",
    enabled: true,
    launchInTerminal: false,
  },
  {
    id: "webstorm",
    name: "WebStorm",
    executable: "webstorm",
    enabled: true,
    launchInTerminal: false,
  },
  {
    id: "pycharm",
    name: "PyCharm",
    executable: "pycharm",
    enabled: false,
    launchInTerminal: false,
  },
  {
    id: "goland",
    name: "GoLand",
    executable: "goland",
    enabled: false,
    launchInTerminal: false,
  },
  {
    id: "clion",
    name: "CLion",
    executable: "clion",
    enabled: false,
    launchInTerminal: false,
  },
  {
    id: "phpstorm",
    name: "PhpStorm",
    executable: "phpstorm",
    enabled: false,
    launchInTerminal: false,
  },
  {
    id: "rubymine",
    name: "RubyMine",
    executable: "rubymine",
    enabled: false,
    launchInTerminal: false,
  },
  {
    id: "datagrip",
    name: "DataGrip",
    executable: "datagrip",
    enabled: true,
    launchInTerminal: false,
  },
  {
    id: "fleet",
    name: "Fleet",
    executable: "fleet",
    enabled: false,
    launchInTerminal: false,
  },
  {
    id: "aqua",
    name: "Aqua",
    executable: "aqua",
    enabled: false,
    launchInTerminal: false,
  },
  {
    id: "rustrover",
    name: "RustRover",
    executable: "rustrover",
    enabled: false,
    launchInTerminal: false,
  },
  // Terminals
  {
    id: "terminal",
    name: "Windows Terminal",
    executable: "wt",
    enabled: true,
    launchInTerminal: false,
    launchArgs: "-d",
  },
  // File Explorer
  {
    id: "explorer",
    name: "Explorer",
    executable: "explorer",
    enabled: true,
    launchInTerminal: false,
  },
];
