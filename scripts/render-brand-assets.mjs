// Render the repository-native SVG/HTML artwork at exact delivery sizes.
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
 await page.goto(pathToFileURL(resolve('design/social-preview.html')).href);
 await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:'public/social/governance.png'});
 for(const size of [16,32,180,192,512]){
  await page.setViewportSize({width:size,height:size});
  await page.goto(pathToFileURL(resolve('public/favicon.svg')).href);
  await page.screenshot({path:`public/${size===180?'apple-touch-icon':size<100?`favicon-${size}x${size}`:`icon-${size}`}.png`});
 }
} finally {await browser.close();}
