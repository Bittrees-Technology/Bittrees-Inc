import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { historicalProposals, validateProposalArchive, assertArchiveSourceMatches, historicalProposalForId, proposalPath } from '../src/lib/proposalArchive.ts';
import { routeSeo, indexablePages } from '../src/lib/seo.ts';
import { checkProposalArchive, refreshProposalArchive } from './check-proposal-archive.mjs';

const copy = value => structuredClone(value);
const now = Date.now();

test('only explicitly reviewed, closed, final and unflagged public records are eligible', () => {
  assert.equal(validateProposalArchive(historicalProposals, now).length, 2);
  for (const change of [
    { state: 'active' }, { state: 'pending' }, { scores_state: 'pending' },
    { flagged: true }, { flagged: undefined }, { space: { id: 'other.eth' } },
    { end: Math.ceil(now / 1000) + 86400 }, { body: '' },
    { scores: [1] }, { scores_total: 1 },
  ]) {
    const entries = copy(historicalProposals);
    Object.assign(entries[0].snapshot, change);
    assert.throws(() => validateProposalArchive(entries, now));
  }
  const draft = copy(historicalProposals); draft[0].publication = 'draft';
  assert.throws(() => validateProposalArchive(draft, now));
  const duplicate = copy(historicalProposals); duplicate.push(copy(duplicate[0]));
  assert.throws(() => validateProposalArchive(duplicate, now));
  const future = copy(historicalProposals); future[0].sourceCheckedAt = new Date(now + 86400000).toISOString();
  assert.throws(() => validateProposalArchive(future, now));
  const foreignLink = copy(historicalProposals); foreignLink[0].sourceUrl = 'https://example.org/proposal';
  assert.throws(() => validateProposalArchive(foreignLink, now));
});

test('source changes and withdrawn records fail review rather than silently updating public history', async () => {
  const entry = historicalProposals[0];
  assert.doesNotThrow(() => assertArchiveSourceMatches(entry, copy(entry.snapshot), now));
  for (const live of [null, { ...copy(entry.snapshot), body: entry.snapshot.body + '\nChanged' }, { ...copy(entry.snapshot), flagged: true }, { ...copy(entry.snapshot), ipfs: 'changed' }]) {
    assert.throws(() => assertArchiveSourceMatches(entry, live, now));
  }
  const fetcher = async (url, options) => {
    assert.equal(url, 'https://hub.snapshot.org/graphql');
    const request = JSON.parse(options.body);
    assert(request.query.startsWith('query(')); assert(!request.query.includes('mutation'));
    const record = historicalProposalForId(request.variables.id);
    return new Response(JSON.stringify({ data: { proposal: record.snapshot } }), { headers: { 'content-type': 'application/json' } });
  };
  const result = await checkProposalArchive({ fetcher, now });
  assert.deepEqual(result.verifiedIds, historicalProposals.map(entry => entry.snapshot.id));
  await assert.rejects(checkProposalArchive({ now, fetcher: async () => new Response('{}', { status: 503 }) }));
  await assert.rejects(checkProposalArchive({ now, fetcher: async () => new Response(JSON.stringify({ errors: [{ message: 'unavailable' }] })) }));
  await assert.rejects(checkProposalArchive({ now, fetcher: async () => new Response(JSON.stringify({ data: { proposal: null } })) }));
});

test('only the reviewed stable URLs bypass proposal noindex; drafts and other workspaces retain policy', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const noindexRule = config.headers.find(rule => rule.source.startsWith('/proposals/'));
  const matchesNoindex = path => new RegExp('^' + noindexRule.source + '$').test(path);
  for (const entry of historicalProposals) {
    const path = proposalPath(entry.snapshot.id);
    assert(!matchesNoindex(path));
    assert(!routeSeo(path).robots.includes('noindex'));
    assert.equal(routeSeo(path).canonical, 'https://gov.bittrees.org' + path);
    const exact = config.rewrites.findIndex(rule => rule.source === path);
    const fallback = config.rewrites.findIndex(rule => rule.source === '/proposals/:id');
    assert(exact >= 0 && exact < fallback, 'specific public records must resolve before the workspace fallback');
    assert.equal(config.rewrites[exact].destination, '/seo' + path + '.html');
  }
  for (const path of ['/proposals/new', '/proposals/example', '/proposals/0x' + 'f'.repeat(64), '/proposals/' + historicalProposals[0].snapshot.id + '/draft']) {
    assert(matchesNoindex(path), path);
    assert.match(routeSeo(path).robots, /noindex/);
  }
  for (const path of ['/admin', '/admin/contributors', '/contributors/apply', '/forum/example', '/messenger']) assert.match(routeSeo(path).robots, /noindex/);
  assert(config.headers.some(rule => rule.source === '/api/:path*' && rule.headers.some(header => /noindex/.test(header.value))));
  assert.equal(Object.keys(indexablePages).filter(path => path.startsWith('/proposals/')).length, 2);
});

test('a source refresh cannot stamp an intervening unchecked archive edit', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gov-proposal-refresh-'));
  const file = join(dir, 'archive.json');
  const changed = copy(historicalProposals);
  changed[0].summary += ' Intervening edit.';
  const changedText = JSON.stringify(changed);
  let edited = false;
  try {
    await writeFile(file, JSON.stringify(historicalProposals));
    const fetcher = async (_url, options) => {
      if (!edited) { edited = true; await writeFile(file, changedText); }
      const { id } = JSON.parse(options.body).variables;
      return new Response(JSON.stringify({ data: { proposal: historicalProposalForId(id).snapshot } }));
    };
    await assert.rejects(refreshProposalArchive({ file, fetcher, now }), /changed during source verification/);
    assert.equal(await readFile(file, 'utf8'), changedText);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
