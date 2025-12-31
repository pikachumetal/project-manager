# Project Manager

[![npm version](https://badge.fury.io/js/@ppm%2Fproject-manager.svg)](https://www.npmjs.com/package/@ppm/project-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Interactive CLI tool for managing and launching development projects. Quickly open projects in your favorite IDE, terminal, or AI coding assistant.

## Features

- **Quick Launch** - Open projects with a single command
- **Multiple Tools** - Support for VS Code, JetBrains IDEs, Claude Code, Gemini CLI, and more
- **Workspace Detection** - Automatically finds `.code-workspace`, `.sln`, `.slnx` files
- **Git Status** - Shows current branch and uncommitted changes
- **Recent Projects** - Quick access to recently opened projects
- **Tool Updates** - Check and update CLI tools like Claude and Gemini

## Installation

### With Bun (recommended)

```bash
bun install -g @ppm/project-manager
```

### With npm

```bash
npm install -g @ppm/project-manager
```

## Usage

### Interactive Mode

```bash
pm
# or
project-manager
```

### Quick Launch

```bash
# Open project with default tool
pm myproject

# Open project with specific tool
pm myproject vscode
pm myproject claude
pm myproject rider
```

### Command Line Options

```bash
pm --help       # Show help
pm -h           # Show help
```

## Supported Tools

| Tool | ID | Description |
|------|-----|-------------|
| Claude Code | `claude` | AI coding assistant (terminal) |
| Gemini CLI | `gemini` | Google AI assistant (terminal) |
| VS Code | `vscode` | Visual Studio Code |
| VS Code Insiders | `vscode-insiders` | VS Code Insiders |
| Visual Studio | `vs` | Visual Studio |
| Rider | `rider` | JetBrains Rider |
| IntelliJ IDEA | `idea` | JetBrains IntelliJ |
| WebStorm | `webstorm` | JetBrains WebStorm |
| PyCharm | `pycharm` | JetBrains PyCharm |
| GoLand | `goland` | JetBrains GoLand |
| DataGrip | `datagrip` | JetBrains DataGrip |
| Windows Terminal | `terminal` | Windows Terminal |
| Explorer | `explorer` | File Explorer |

## Configuration

Configuration files are stored in the same directory as the executable:

- `projects.json` - Your configured projects
- `tools.json` - Tool configuration (enable/disable tools)
- `settings.json` - Default settings
- `recents.json` - Recently opened projects

### Project Configuration Example

```json
[
  {
    "name": "My App",
    "path": "D:/code/my-app",
    "workspaces": [
      { "name": "Root", "path": "." },
      { "name": "Frontend", "path": "apps/web" },
      { "name": "Backend", "path": "apps/api" }
    ]
  }
]
```

### Settings Example

```json
{
  "defaultCodePath": "D:/code/git",
  "defaultTool": "claude"
}
```

## Requirements

- Windows 10/11
- [Windows Terminal](https://aka.ms/terminal) (for terminal-based tools)
- [gsudo](https://github.com/gerardog/gsudo) (for admin elevation)
- Node.js 18+ or Bun 1.0+

### Optional

- [JetBrains Toolbox](https://www.jetbrains.com/toolbox-app/) with "Generate shell scripts" enabled

## Development

```bash
# Clone the repository
git clone https://github.com/pikachumetal/project-manager.git
cd project-manager

# Install dependencies
bun install

# Run in development mode
bun run dev

# Build standalone executable
bun run build
```

## License

MIT
