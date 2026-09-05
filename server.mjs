import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const root = new URL('.', import.meta.url).pathname.replace(/^\/(.:)/, '$1');
const mime = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml' };
const port = Number(process.env.PORT || 4173);
createServer(async (req,res) => { try { const pathname = decodeURIComponent(new URL(req.url,'http://local').pathname); let file = normalize(join(root, pathname === '/' ? 'index.html' : pathname)); if (!file.startsWith(normalize(root))) throw new Error('bad path'); if ((await stat(file)).isDirectory()) file=join(file,'index.html'); const body=await readFile(file); res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream','cache-control':'no-cache'});res.end(body)} catch {res.writeHead(404);res.end('Not found')} }).listen(port,()=>console.log(`http://localhost:${port}`));
