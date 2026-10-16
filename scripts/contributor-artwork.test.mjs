import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),folder=new URL('public/contributor-artwork/v1/',root);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',folder)));const logo=readFileSync(new URL('public/bittrees_logo_tree.png',root));
test('all 72 cards preserve original logo bytes and correct level rank and display status',()=>{
 assert.equal(Object.keys(manifest.files).length,72);assert.equal(createHash('sha256').update(logo).digest('hex'),manifest.logoSha256);
 for(let l=0;l<4;l++)for(let r=0;r<3;r++)for(let s=0;s<6;s++){
  const name=`${l}-${r}-${s}.svg`,raw=readFileSync(new URL(name,folder)),svg=raw.toString();
  assert.equal(createHash('sha256').update(raw).digest('hex'),manifest.files[name]);
  const image=svg.match(/href="data:image\/png;base64,([^"]+)"/);assert.ok(image);assert.deepEqual(Buffer.from(image[1],'base64'),logo);
  assert.ok(svg.includes(`>${manifest.levels[l]}</text>`));assert.ok(svg.includes(`>${manifest.ranks[r]}</text>`));assert.ok(svg.includes(`>${manifest.states[s]}</text>`));assert.ok(!svg.includes('<script'));
 }
});
