# Project Manager

Interactive CLI tool for managing and launching development projects on Windows.

## Project Structure

```
project-manager/
├── bin/
│   └── cli.js              # CLI entry point (node/bun compatible)
├── src/
│   ├── index.ts            # Main entry, CLI args, menu loop
│   ├── config.ts           # Load/save projects, tools, recents, settings
│   ├── types.ts            # Zod schemas, Tool/Project types, DEFAULT_TOOLS
│   ├── flows/
│   │   ├── launch.ts       # Project launch flow + quickLaunch + git status
│   │   ├── add.ts          # Add projects (folder browser)
│   │   ├── manage.ts       # Edit/delete projects and workspaces
│   │   └── tools.ts        # Tool management, versions, updates
│   └── lib/
│       └── launcher.ts     # Process spawn logic (wt, code, IDEs, etc.)
├── package.json
└── tsconfig.json
```

## Key Concepts

### Tools
Tools are external applications that can open projects. Defined in `types.ts`:
- `id`: Unique identifier (used in CLI: `pm myproject vscode`)
- `executable`: Command to run (must be in PATH)
- `launchInTerminal`: If true, opens in Windows Terminal
- `requiresAdmin`: If true, uses gsudo for elevation
- `projectFilePatterns`: Glob patterns to find project files (e.g., `["*.sln"]`)

### Projects
Projects have a name, path, and optional workspaces (subfolders).

### Config Files (stored in `~/.project-manager/`)
- `projects.json` - User's configured projects
- `tools.json` - Tool configuration (overrides defaults)
- `recents.json` - Last 10 opened projects
- `settings.json` - User preferences (defaultCodePath, defaultTool)

## Development

```bash
# Install dependencies
bun install

# Run in development
bun run dev

# Run directly
bun run src/index.ts

# Build standalone executable
bun run build
```

## CLI Usage

```bash
pm                      # Interactive mode
pm <project>            # Quick launch with default tool
pm <project> <tool>     # Quick launch with specific tool
pm --help               # Show help
```

## Adding New Tools

Edit `src/types.ts` and add to `DEFAULT_TOOLS` array:

```typescript
{
  id: "mytool",
  name: "My Tool",
  executable: "mytool",
  enabled: true,
  launchInTerminal: false,
  projectFilePatterns: ["*.myext"],
}
```

## Platform

Currently Windows-only due to:
- Windows Terminal (`wt`) integration
- gsudo for admin elevation
- JetBrains Toolbox scripts in PATH
