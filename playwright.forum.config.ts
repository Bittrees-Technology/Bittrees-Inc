import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/forum',outputDir:'test-results/forum',workers:1,timeout:60000,use:{baseURL:'http://127.0.0.1:4226',browserName:'chromium'},webServer:{command:'npm run preview -- --host 127.0.0.1 --port 4226',url:'http://127.0.0.1:4226',reuseExistingServer:false}});
