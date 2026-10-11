import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {checkSimpleMode} from './browser-simple-checks.mjs';
const port=process.env.BROWSER_TEST_PORT||'4179',url=process.env.BROWSER_TEST_URL||('http://localhost:'+port);
const server=process.env.BROWSER_TEST_URL?null:spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:port},stdio:'ignore',windowsHide:true});
let browser;
try{
  for(let i=0;i<50;i++){try{if((await fetch(url)).ok)break}catch{}await new Promise(resolve=>setTimeout(resolve,100))}
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
  await checkSimpleMode(browser,url);
}finally{await browser?.close();server?.kill()}