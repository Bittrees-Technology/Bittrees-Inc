import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { publicPages, privatePages, routeSeo, SITE_URL } from '../src/lib/seo.ts';
const config=JSON.parse(readFileSync('vercel.json'));
test('public and private route boundaries have matching initial-HTML routing',()=>{
 for(const path of Object.keys(publicPages).filter(p=>p!=='/')) assert(config.rewrites.some(r=>r.source===path&&r.destination===`/seo/${path.slice(1)}.html`));
 for(const path of privatePages) { assert.match(routeSeo(path).robots,/noindex/);assert(config.rewrites.some(r=>r.source===path&&r.destination==='/seo/workspace.html')); }
 assert(!config.rewrites.some(r=>r.source.includes('(?!api/')));
});
test('built public documents have one canonical, large share image and real initial text',()=>{
 for(const [path,meta] of Object.entries(publicPages)) {
  const html=readFileSync(path==='/'?'dist/index.html':`dist/seo/${path.slice(1)}.html`,'utf8');
  assert.equal((html.match(/rel="canonical"/g)||[]).length,1);
  assert(html.includes(`href="${SITE_URL}${path}"`));
  assert(html.includes('content="1200"'));assert(html.includes('summary_large_image'));assert.equal((html.match(/<h1\b/g)||[]).length,1);
  assert(!html.includes('noindex'));assert(html.includes(meta.title.replaceAll('&','&amp;')));
 }
 const privateHtml=readFileSync('dist/seo/workspace.html','utf8');assert(privateHtml.includes('noindex,follow'));assert(!privateHtml.includes('rel="canonical"'));
 const sitemap=readFileSync('dist/sitemap.xml','utf8');for(const p of privatePages)assert(!sitemap.includes(`<loc>${SITE_URL}${p}</loc>`));
});
test('initial HTML contains the existing public explanations and complete DAO navigation',()=>{
 const expected={
  '/':'Bittrees, Inc. envisions a world where individuals have access to the tools and resources needed to build and grow sustainable communities.',
  '/vision':'Adopted March 27, 2020',
  '/code-of-conduct':'Do not share the personal information of community members without their consent.',
  '/structure':'Each subDAO holds one-third of voting power; major matters need a two-thirds consensus.',
  '/contribute':'Tell us what you would like to contribute. Submit with your wallet on Base, then follow review, your memorandum and credential from My contribution.',
  '/hq':'429W, 182S',
  '/69420':'Bittrees Revenue and Token Flow',
  '/proposals':'Bittrees Improvement Proposals (BIPs), voted by BGOV common-stock holders.',
  '/forum':'Starting a discussion requires 69 BGOV; any connected wallet can reply.',
  '/mint':'carries the governance (voting) rights used across this site.',
 };
 for(const [path,passage] of Object.entries(expected)) {
  const html=readFileSync(path==='/'?'dist/index.html':`dist/seo/${path.slice(1)}.html`,'utf8');
  const text=html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
  assert(text.includes(passage),`${path} lost its public content`);
  for(const publicPath of Object.keys(publicPages)) assert(html.includes(`href="${publicPath}"`),`${path} cannot discover ${publicPath}`);
  const dao=html.match(/<nav aria-label="DAO"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  assert(dao,`${path} needs named DAO navigation`);
  assert.deepEqual([...dao.matchAll(/href="([^"]+)"/g)].map(m=>m[1]),[
   'https://gov.bittrees.org','https://research.bittrees.org/about','https://capital.bittrees.org',
  ]);
  assert(html.includes('href="https://bittrees.org"'));
  assert(html.includes('href="https://index.bittrees.org"'));
  assert(!/<(?:form|input|textarea)\b/.test(html),`${path} must not prerender wallet or contributor forms`);
 }
 for(const path of ['/admin/contributors','/contributors/apply','/proposals/example','/forum/example']) assert.match(routeSeo(path).robots,/noindex/);
 const notFound=readFileSync('dist/404.html','utf8');assert(notFound.includes('noindex'));assert(notFound.includes('Page not found'));
});
test('favicon, manifest and image assets identify Governance',()=>{
 const manifest=JSON.parse(readFileSync('public/site.webmanifest'));assert.equal(manifest.name,'Bittrees Governance');
 for(const icon of manifest.icons)assert(existsSync('public'+icon.src));
 const png=readFileSync('public/social/governance.png');assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);
});
