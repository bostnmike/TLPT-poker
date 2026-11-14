import {LIVE_RSVP_URL} from '../../lib/live-rsvp.mjs';
import {fixedFeed} from './integration-feeds';

export default {
 fetch(request:Request){
  if(request.url!==LIVE_RSVP_URL||request.method!=='GET')return new Response(null,{status:404});
  return fixedFeed(request);
 }
};
