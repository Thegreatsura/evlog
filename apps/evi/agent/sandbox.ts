import { installAgentBrowser } from '@agent-browser/eve/sandbox'
import { DefaultSandbox, defineSandbox } from 'eve/sandbox'
import { browserSandbox } from './lib/capture'
import { cloneUrl, homeRepository } from './lib/repo'

/**
 * Kept for its diff engine, not for capture: capture__before_after owns
 * capture and hosting. Pinned so template reuse invalidates when it moves.
 */
const BEFORE_AFTER_CLI = '@vercel/before-and-after@0.0.4'

/** Package managers for repositories that are not the home one: the image ships pnpm and yarn, bun is separate, `nci` picks from the lockfile. */
const PACKAGE_MANAGER_CLIS = ['@antfu/ni@30.6.0', 'bun@1.4.2']

const HOME = homeRepository()

/**
 * The template carries a ready-to-work checkout of the home repository so
 * sessions can run lint, typecheck, and tests instead of shipping unverified
 * changes. The clone, install, and browser tooling are paid once per template
 * build; every session inherits the filesystem and only pays a fetch to main.
 * eve keys the snapshot on this module's compiled revision, so any edit here
 * rebuilds it.
 */
export const environment = DefaultSandbox.environment({
  vercel: {
    resources: { vcpus: 4 },
    // One snapshot per sandbox keeps storage flat; an expiration shorter
    // than 14 days would kill the template snapshot after a quiet stretch
    // and force a full runtime rebuild that sessions queue behind.
    keepLastSnapshots: { count: 1, deleteEvicted: true },
    snapshotExpiration: 14 * 24 * 60 * 60 * 1000,
  },
  async prepare(sandbox) {
    await sandbox.run({ command: `npm install -g ${[BEFORE_AFTER_CLI, ...PACKAGE_MANAGER_CLIS].join(' ')}` })
    await sandbox.run({ command: `git clone --depth 50 ${cloneUrl(HOME)} repo` })
    // Frozen: a cold install in a fresh clone otherwise re-resolves the whole
    // graph, and any <48h transitive release then fails the template build on
    // the repo's own minimumReleaseAge policy. The lockfile is what CI tested.
    await sandbox.run({ command: 'cd repo && corepack prepare --activate && pnpm install --frozen-lockfile && pnpm run dev:prepare' })
    // The CLI at main, usable from any checkout in the sandbox.
    await sandbox.run({ command: 'ln -sf /workspace/repo/node_modules/.bin/evlog "$(npm prefix -g)/bin/evlog"' })
    // Prime the turbo cache on deployed builds only: locally this is minutes
    // of CPU on every template rebuild.
    if (process.env.VERCEL) {
      await sandbox.run({ command: 'cd repo && pnpm run lint && pnpm run typecheck && pnpm run test' })
    }
    // Commits authored in the sandbox belong to the bot, on every channel.
    await sandbox.run({ command: 'git config --global user.name "evlogai[bot]" && git config --global user.email "evlogai[bot]@users.noreply.github.com"' })
    await installAgentBrowser(browserSandbox(sandbox, 'template'))
  },
})

export default defineSandbox(async () => {
  const sandbox = await environment.open()
  // The template snapshot is owned by the builder uid, not the session user;
  // without these entries every git command dies on "dubious ownership".
  await sandbox.run({ command: 'git config --global --add safe.directory /workspace && git config --global --add safe.directory /workspace/repo' })
  await sandbox.run({ command: 'cd repo && git fetch origin main && git checkout -B main origin/main' })
  return sandbox
})
