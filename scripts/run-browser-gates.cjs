// Serve and test the exact Pages artifact, never the repository root.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const root = path.resolve(__dirname, '../.site-release');
const types = {'.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript',
  '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp',
  '.mp3':'audio/mpeg', '.mp4':'video/mp4', '.pdf':'application/pdf',
  '.woff2':'font/woff2', '.vtt':'text/vtt', '.wasm':'application/wasm'};
const server = http.createServer((req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file = path.resolve(root, '.' + pathname + (pathname.endsWith('/')?'index.html':''));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404);res.end('Not found');return;
    }
    const size=fs.statSync(file).size, range=req.headers.range;
    let start=0,end=size-1,status=200;
    if(range) {
      const match=/^bytes=(\d+)-(\d*)$/.exec(range);
      if(!match){res.writeHead(416);res.end();return;}
      start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),end):end;status=206;
      if(start>end){res.writeHead(416);res.end();return;}
      res.setHeader('Content-Range',`bytes ${start}-${end}/${size}`);
    }
    res.writeHead(status,{'Content-Type':types[path.extname(file)]||'application/octet-stream',
      'Content-Length':end-start+1,'Accept-Ranges':'bytes','Cache-Control':'no-store'});
    if(req.method==='HEAD'){res.end();return;}
    fs.createReadStream(file,{start,end}).pipe(res);
  } catch {res.writeHead(400);res.end('Bad request');}
});
const run=(script,base)=>new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[path.join(__dirname,script),base],{stdio:'inherit',env:process.env});
  child.on('error',reject);
  child.on('exit',code=>code===0?resolve():reject(Error(script+' failed: '+code)));
});
(async()=>{
  if(!fs.existsSync(path.join(root,'release.json')))throw Error('Run package-site.py first');
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  try {
    for(const script of ['test-shared-shell-browser.cjs','test-player-rename-browser.cjs','test-control-deck-browser.cjs','test-mobile-density-browser.cjs',
      'test-norm-narration-browser.cjs','test-stats-guides-browser.cjs','test-sunday-games-browser.cjs']) await run(script,base);
    console.log('PASS: required desktop, tablet, mobile, dropdown, help and audio gates');
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
