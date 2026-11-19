import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  SNAPSHOT_ARCHIVE_ENDPOINT, SNAPSHOT_ARCHIVE_FIELDS,
  historicalProposals, validateProposalArchive, assertArchiveSourceMatches,
} from '../src/lib/proposalArchive.ts';

// Anonymous public reads only. Do not import wallet clients, sequencing APIs,
// member registries, contributor workspaces or unpublished proposal data here.
export async function checkProposalArchive({ entries = historicalProposals, fetcher = fetch, now = Date.now() } = {}) {
  validateProposalArchive(entries, now);
  await Promise.all(entries.map(async entry => {
    const response = await fetcher(SNAPSHOT_ARCHIVE_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'Bittrees-SEO-readonly-review/1.0' },
      body: JSON.stringify({
        query: 'query($id:String!){ proposal(id:$id){ ' + SNAPSHOT_ARCHIVE_FIELDS + ' } }',
        variables: { id: entry.snapshot.id },
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error('Snapshot source check failed with HTTP ' + response.status);
    const result = await response.json();
    if (result.errors?.length) throw new Error('Snapshot source query failed: ' + result.errors[0].message);
    assertArchiveSourceMatches(entry, result.data?.proposal, now);
  }));
  return { checkedAt: new Date(now).toISOString(), space: 'gov.bittrees.eth', verifiedIds: entries.map(entry => entry.snapshot.id), publicRecords: entries.length };
}

export async function refreshProposalArchive({ file = new URL('../src/data/public-proposals.json', import.meta.url), fetcher = fetch, now = Date.now() } = {}) {
  const original = await readFile(file, 'utf8');
  const entries = validateProposalArchive(JSON.parse(original), now);
  const result = await checkProposalArchive({ entries, fetcher, now });
  // Never stamp an intervening edit or an added record that was not checked.
  if (await readFile(file, 'utf8') !== original) throw new Error('Proposal archive changed during source verification; no review dates were written.');
  for (const entry of entries) entry.sourceCheckedAt = result.checkedAt;
  await writeFile(file, JSON.stringify(entries, null, 2) + '\n');
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--refresh')) throw new Error('Usage: node scripts/check-proposal-archive.mjs [--refresh]');
  // Refresh review dates only after every published field still matches.
  // Changed, removed, flagged or unfinished records require an explicit edit.
  const result = args.includes('--refresh') ? await refreshProposalArchive() : await checkProposalArchive();
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
