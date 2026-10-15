import {env} from 'cloudflare:workers';
export function db(){if(!env.DB)throw new Error('Register database unavailable');return env.DB;}
export function json(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});}
export function browserAuth(req:Request,write=false){if(!req.headers.get('x-tlpt-authenticated-user-id'))return json({error:'Sign in to use the register.'},401);if(write&&req.headers.get('Origin')!==new URL(req.url).origin)return json({error:'Invalid request origin'},403);}
export async function body(req:Request){const raw=await req.text();if(raw.length>250000)throw new Error('Request too large');return JSON.parse(raw);}
