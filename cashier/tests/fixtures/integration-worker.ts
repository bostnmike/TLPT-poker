// Test-only wrapper. Production continues to use worker.ts directly.
import worker from '../../worker';
import {fixedFeed,ready} from './integration-feeds';
import {LIVE_RSVP_URL} from '../../lib/live-rsvp.mjs';
globalThis.fetch=async input=>{
 const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 if(url===LIVE_RSVP_URL)return new Response('Fixture public transport denied',{status:403});
 return fixedFeed(input);
};
Date.now=()=>Date.parse('2026-11-13T20:00:00Z');
export default {fetch(request:Request,env:Cloudflare.Env & {TEST_RUN_ID:string}){
 return ready(request,env)||worker.fetch(request,env);
}};
