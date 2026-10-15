// Owner enters a new password only on this loopback form. No password or secret is logged or written to disk.
import {createServer} from 'node:http';
import {randomBytes,pbkdf2Sync,timingSafeEqual} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const configPath=process.argv[2]||'wrangler.deploy.local.json';
if(!/^wrangler\.[a-z-]+\.local\.json$/.test(configPath))throw Error('Use the ignored deployment config in this directory.');
const config=JSON.parse(readFileSync(configPath,'utf8'));
if(config.vars?.AUTH_MODE!=='password'||!['staging','production'].includes(config.vars?.CASHIER_ENV)||!/^tlpt-cashier(?:-staging)?$/.test(config.name))throw Error('Use a cashier deployment configured for password sign-in.');
const csrf=randomBytes(32).toString('hex'),origin='http://127.0.0.1:8790';let busy=false,complete=false;
const page=(message='')=>`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TLPT · Set Cashier Password</title><style>body{background:#080d17;color:#eef2fa;font:18px system-ui;margin:0;display:grid;place-items:center;min-height:100svh}main{width:min(440px,calc(100% - 40px));padding:28px 0}p{color:#b6c1d4;line-height:1.5}label{display:block;margin:22px 0 8px}input,button{box-sizing:border-box;width:100%;border-radius:10px;padding:14px;font:inherit}input{background:#142033;color:#fff;border:1px solid #65758c}button{background:#f6bb51;border:0;margin-top:24px;font-weight:700}strong{color:#fff}</style><main><p>THE LITTLE POKER TOUR</p><h1>Set your cashier password.</h1><p>This sets the password for the <strong>${config.vars.CASHIER_ENV} cashier</strong>. Use at least 16 characters; four unrelated words work well. Save it in your password manager.</p><p>Your password is handled on this computer. Only a salted password hash and a separate session key are sent to Cloudflare’s encrypted secrets. Neither is saved in GitHub or displayed in chat.</p>${message?'<p role="alert">'+message+'</p>':''}${complete?'<p>You can close this setup tab and sign into the new cashier.</p>':`<form method="post" action="/password"><input type="hidden" name="csrf" value="${csrf}"><label for="password">New cashier password</label><input id="password" name="password" type="password" autocomplete="new-password" minlength="16" maxlength="128" required><label for="confirm">Repeat password</label><input id="confirm" name="confirm" type="password" autocomplete="new-password" minlength="16" maxlength="128" required><button>Save cashier password</button></form>`}</main></html>`;
const server=createServer(async(req,res)=>{
 const send=(status,text,html=true)=>{res.writeHead(status,{'Content-Type':html?'text/html;charset=utf-8':'text/plain;charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});res.end(text);};
 if(req.headers.host!=='127.0.0.1:8790')return send(403,'Invalid host',false);
 if(req.method==='GET'&&req.url==='/')return send(200,page());
 if(req.method!=='POST'||req.url!=='/password')return send(404,'Not found',false);
 if(req.headers.origin!==origin)return send(403,'Invalid origin',false);
 if(busy||complete)return send(409,page(complete?'Password already saved.':'A save is in progress.'));
 let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>4096)return send(413,'Request too large',false);}
 const form=new URLSearchParams(raw),candidate=form.get('csrf')||'';
 if(!/^[a-f0-9]{64}$/.test(candidate)||!timingSafeEqual(Buffer.from(candidate),Buffer.from(csrf)))return send(403,'Invalid form',false);
 const password=form.get('password')||'';
 if(password.length<16||password.length>128||password.trim().length<16||password!==form.get('confirm'))return send(400,page('Use matching passwords with 16–128 characters.'));
 busy=true;
 try{
  const salt=randomBytes(16),hash=pbkdf2Sync(password,salt,100000,32,'sha256');
  const secrets={CASHIER_PASSWORD_HASH:`v1:100000:${salt.toString('base64url')}:${hash.toString('base64url')}`,SESSION_SECRET:randomBytes(32).toString('base64url')};
  const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','secret','bulk','--config',configPath],{env:{...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false'},stdio:['pipe','ignore','ignore']});
  const result=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error('Secret upload failed')));});
  child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(secrets));await result;
  complete=true;send(200,page('Password saved securely.'));console.log('Cashier password configured successfully. No credential values were logged.');
  server.close();setTimeout(()=>process.exit(0),1500).unref();
 }catch{send(503,page('The password could not be saved. Check the Cloudflare connection, then try again.'));}finally{busy=false;}
});
server.listen(8790,'127.0.0.1',()=>console.log('Private password setup ready at '+origin));
setTimeout(()=>{console.log('Password setup expired. Run this helper again to retry.');server.close();process.exit(1);},20*60*1000).unref();
