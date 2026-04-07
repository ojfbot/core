# Frame OS Sub-App Template

## Structure

```
packages/
├── browser-app/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── api/          # API client
│   │   ├── store/        # Redux slices
│   │   └── App.tsx
│   ├── vite.config.ts    # MF remote config
│   └── package.json
├── api/
│   ├── src/
│   │   ├── routes/       # Express routes
│   │   ├── middleware/    # Auth, validation
│   │   ├── beads/        # Bead mapper + types
│   │   └── index.ts
│   └── package.json
└── agent-core/           # If AI-powered
    ├── src/
    │   ├── agents/       # BaseAgent extensions
    │   └── models/       # Zod schemas
    └── package.json
```

## Module Federation Remote Config

```typescript
// vite.config.ts
federation({
  name: 'myApp',
  filename: 'remoteEntry.js',
  exposes: {
    './Dashboard': './src/components/Dashboard.tsx',
    './Settings': './src/components/Settings.tsx',
  },
  shared: {
    react:              { singleton: true, requiredVersion: '^18.3.1' },
    'react-dom':        { singleton: true, requiredVersion: '^18.3.1' },
    '@reduxjs/toolkit': { singleton: true, requiredVersion: '^2.5.0' },
    'react-redux':      { singleton: true, requiredVersion: '^9.2.0' },
    '@carbon/react':    { singleton: true, requiredVersion: '^1.67.0' },
  } as any
})
```

**Important**: `as any` required — singleton/requiredVersion typed as commented-out in plugin types.

## Bead Mapper Pattern

Every sub-app exposes `GET /api/beads` mapping its domain entities to FrameBead shape:

```typescript
interface CVJobBead {
  id: string
  type: 'job-listing'
  title: string
  status: BeadStatus  // derived from deadline
  sourceApp: 'cv-builder'
  created_at: string
  updated_at: string
}
```

## Local MF Dev

`@originjs/vite-plugin-federation` only generates `remoteEntry.js` on `vite build`, NOT `vite dev`.
For MF local dev: `pnpm build && pnpm preview`.
