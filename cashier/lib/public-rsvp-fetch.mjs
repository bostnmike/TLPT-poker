import {LIVE_RSVP_URL} from './live-rsvp.mjs';
// Read only the same public feed through an account-local service binding.
// No browser cookie, private key, arbitrary path or write is forwarded.
export function publicRsvpFetch(binding,external=fetch){
 return (url,init)=>binding&&String(url)===LIVE_RSVP_URL&&(!init?.method||init.method==='GET')
  ?binding.fetch(new Request(LIVE_RSVP_URL,{method:'GET',headers:{Accept:'application/json'}}))
  :external(url,init);
}
