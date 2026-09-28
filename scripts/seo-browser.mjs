import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4326','--strictPort'],{stdio:'ignore'});
let browser;
try {
 for(let n=0;n<50;n++){try{if((await fetch('http://127.0.0.1:4326')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto('http://127.0.0.1:4326');
 await page.getByRole('navigation').first().waitFor();
 await page.waitForFunction(()=>document.title==='Bittrees Governance | Proposals, Voting & Community');
 await page.getByRole('link',{name:'Structure',exact:true}).first().click();
 await page.waitForFunction(()=>document.title==='Governance Structure | Bittrees');
 assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),'https://gov.bittrees.org/structure');
 assert.equal(await page.locator('meta[name="twitter:card"]').getAttribute('content'),'summary_large_image');
 await page.goto('http://127.0.0.1:4326/admin');
 await page.waitForFunction(()=>document.querySelector('meta[name="robots"]')?.content==='noindex,follow');
 await page.goto('http://127.0.0.1:4326');
 await page.getByRole('link',{name:'Structure',exact:true}).first().waitFor();
 await mkdir('artifacts/seo',{recursive:true});
 await page.screenshot({path:'artifacts/seo/desktop.png'});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'artifacts/seo/mobile.png'});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile page overflows');
 console.log('Browser SEO checks passed: public navigation, canonical, social card, private noindex and mobile width.');
} finally {await browser?.close();server.kill();}
