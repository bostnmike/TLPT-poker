// Scoped source/contract inputs; unrelated site and Cashier UI cosmetics are allowed.
export const RELEASE_INPUTS = [
  'rsvp', 'cashier/closeout-worker.ts', 'cashier/lib', 'cashier/drizzle',
  'cashier/tests/fixtures', 'cashier/CLOSEOUT-PROTOCOL.md',
  'cashier/package.json', 'cashier/pnpm-lock.yaml',
  'scripts/test-recovery.py', 'scripts/test-app-feed-contract.mjs', '.github/workflows'
];
export const RSVP_DATABASE = '79de1ed8-302a-4d25-b7f1-5f423e6ea321';
export function requirePinnedRelease(config, freePlan) {
  if (freePlan !== '1') throw Error('Confirm the current Workers Free plan before publication. No paid plans are allowed.');
  const databases = config?.d1_databases;
  if (config?.account_id !== '4d5ea071300fa71b8fa947c06d8ba314' || config.name !== 'tlpt-rsvp' || config.main !== 'worker.mjs' || config.assets?.directory !== './public' ||
      !Array.isArray(databases) || databases.length !== 1 || databases[0].binding !== 'DB' || databases[0].database_name !== 'tlpt-rsvp' || databases[0].database_id !== RSVP_DATABASE) {
    throw Error('Publication requires the exact existing RSVP Worker, account and database.');
  }
}
export function requireCheckedInputs({dirty = '', changed = '', revision, mainRevision, expectedRevision = revision}) {
  if (dirty.trim()) throw Error('Commit or discard changes in RSVP deployment or shared contract inputs before publishing.');
  if (!/^[a-f0-9]{40}$/.test(revision || '') || !/^[a-f0-9]{40}$/.test(mainRevision || '')) throw Error('The source and freshly fetched main revisions could not be verified.');
  if (revision !== expectedRevision) throw Error('The checkout changed during release checks. Start the release again.');
  if (changed.trim()) throw Error('RSVP or actual Cashier contract inputs differ from freshly fetched main. Synchronize the checked source before publishing.');
}
export function inspectReleaseCheckout(git, expectedRevision) {
  const dirty = git(['status','--porcelain=v1','--untracked-files=all','--',...RELEASE_INPUTS]);
  if (dirty.trim()) throw Error('Commit or discard changes in RSVP deployment or shared contract inputs before publishing.');
  git(['fetch','--no-tags','origin','refs/heads/main:refs/remotes/origin/main']);
  const revision = git(['rev-parse','HEAD']).trim(), mainRevision = git(['rev-parse','refs/remotes/origin/main']).trim();
  const refreshedDirty = git(['status','--porcelain=v1','--untracked-files=all','--',...RELEASE_INPUTS]);
  const changed = git(['diff','--name-only',mainRevision,'--',...RELEASE_INPUTS]);
  requireCheckedInputs({dirty:refreshedDirty, changed, revision, mainRevision, expectedRevision});
  return revision;
}
