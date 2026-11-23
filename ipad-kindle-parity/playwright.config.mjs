import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
 testDir:'./tests',testMatch:'*.spec.mjs',timeout:30000,
 use:{baseURL:'http://127.0.0.1:4173',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[
 {name:'desktop-chromium',use:{...devices['Desktop Chrome']}},
 {name:'iphone-13-emulation',use:{...devices['iPhone 13'],browserName:'chromium'}},
 {name:'ipad-emulation',use:{...devices['iPad (gen 7)'],browserName:'chromium'}},
 {name:'kindle-sized-emulation',use:{...devices['Desktop Chrome'],viewport:{width:800,height:1280},isMobile:true,hasTouch:true}}
 ],
 webServer:{command:'python3 -m http.server 4173 --bind 127.0.0.1',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI,timeout:30000}
});
