// Test-only wrapper. Production continues to use worker.ts directly.
import worker from '../../worker';
import {fixedFeed,ready} from './integration-feeds';
globalThis.fetch=async input=>fixedFeed(input);
Date.now=()=>Date.parse('2026-11-13T20:00:00Z');
export default {fetch(request:Request,env:Cloudflare.Env & {TEST_RUN_ID:string}){
 return ready(request,env)||worker.fetch(request,env);
}};
