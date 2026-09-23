import {defineConfig} from '@playwright/test';
const live=process.env.GOV_RECOVERY_LIVE==='1';
const baseURL=live?'https://gov.bittrees.org':'http://127.0.0.1:4211';
export default defineConfig({
 outputDir:'test-results/app-recovery',testDir:'./tests/app-recovery',fullyParallel:false,workers:1,retries:0,timeout:60000,
 use:{baseURL,actionTimeout:10000,browserName:'chromium',trace:'off',video:'off'},
 webServer:live?undefined:{command:'npm run preview -- --host 127.0.0.1 --port 4211',url:baseURL,reuseExistingServer:false},
});
