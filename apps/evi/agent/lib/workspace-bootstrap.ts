export const workspaceBootstrapCommand = [
  'cd repo',
  'corepack prepare --activate',
  'pnpm install --frozen-lockfile',
  'pnpm run dev:prepare',
].join(' && ')
