# Skeleton Patterns

## Monorepo (pnpm workspaces)

```
packages/
├── agent-core/          # Shared logic, models, agents
│   ├── src/
│   │   ├── agents/      # BaseAgent + specialized agents
│   │   ├── models/      # Zod schemas + TypeScript types
│   │   └── utils/       # Node-only utilities
│   └── package.json
├── api/                 # Express server, routes, middleware
├── browser-app/         # Vite + React + Carbon frontend
├── tsconfig/            # @frame/tsconfig shared presets
└── eslint-plugin/       # @frame/eslint-plugin custom rules
```

### Essential files
- `pnpm-workspace.yaml` — lists `packages/*`
- `.nvmrc` — pin Node version (e.g., `24.11.1`)
- `eslint.config.js` — flat config with `@frame/eslint-plugin`
- `tsconfig.json` — extends `@frame/tsconfig/base`

## Single Package

```
src/
├── index.ts             # Main entry
├── types.ts             # Zod schemas
└── __tests__/           # Co-located tests
package.json
tsconfig.json            # Extends @frame/tsconfig/node
```

## CLI Tool

```
src/
├── cli/
│   ├── index.ts         # Commander setup
│   └── commands/        # One file per command
├── agents/              # If AI-powered
└── models/              # Zod schemas
bin/
└── cli.js               # Shebang entry
```

## Naming Conventions (Frame OS)

- Package names: `@cv-builder/agent-core`, `@frame/tsconfig`
- Directories: kebab-case (`browser-app`, `agent-core`)
- Files: kebab-case (`job-analysis-agent.ts`)
- Classes: PascalCase (`BaseAgent`, `OrchestratorAgent`)
- Zod schemas: PascalCase (`Bio`, `JobListing`)
