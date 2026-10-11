import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { checkSeamlessNavigation } from './browser-navigation-checks.mjs';

const port=process.env.BROWSER_TEST_PORT||'4178';
const url=process.env.BROWSER_TEST_URL||`http://localhost:${port}`;
const server=process.env.BROWSER_TEST_URL?null:spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:port},stdio:'ignore',windowsHide:true});
let browser;
try {
  for(let attempt=0;attempt<50;attempt++){
    try {if((await fetch(url)).ok)break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
  await checkSeamlessNavigation(browser,url);
} finally {await browser?.close();server?.kill();}
