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
  assert(html.includes('content="1200"'));assert(html.includes('summary_large_image'));assert(html.includes('<h1>'));
  assert(!html.includes('noindex'));assert(html.includes(meta.title.replaceAll('&','&amp;')));
 }
 const privateHtml=readFileSync('dist/seo/workspace.html','utf8');assert(privateHtml.includes('noindex,follow'));assert(!privateHtml.includes('rel="canonical"'));
 const sitemap=readFileSync('dist/sitemap.xml','utf8');for(const p of privatePages)assert(!sitemap.includes(`<loc>${SITE_URL}${p}</loc>`));
});
test('favicon, manifest and image assets identify Governance',()=>{
 const manifest=JSON.parse(readFileSync('public/site.webmanifest'));assert.equal(manifest.name,'Bittrees Governance');
 for(const icon of manifest.icons)assert(existsSync('public'+icon.src));
 const png=readFileSync('public/social/governance.png');assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);
});
