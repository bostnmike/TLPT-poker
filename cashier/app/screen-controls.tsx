'use client';
import {memo,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Sun,Expand,Minimize} from 'lucide-react';
import {pageIsFullscreen,togglePageFullscreen} from '@/lib/fullscreen.mjs';
function ScreenControls(){
 const [fullscreen,setFullscreen]=useState(false),[standalone,setStandalone]=useState(false),[awake,setAwake]=useState(false),[awakePending,setAwakePending]=useState(false),[help,setHelp]=useState<'fullscreen'|'awake'|null>(null);
 const lock=useRef<WakeLockSentinel|null>(null),wanted=useRef(false),requesting=useRef(false);
 async function acquire(){
  if(lock.current)return true;if(requesting.current)return false;requesting.current=true;setAwakePending(true);
  try{
   if(!navigator.wakeLock?.request)throw Error('Wake lock unavailable');
   const sentinel=await navigator.wakeLock.request('screen');
   if(!wanted.current){await sentinel.release();return false;}
   lock.current=sentinel;setAwake(true);sentinel.addEventListener('release',()=>{if(lock.current===sentinel){lock.current=null;setAwake(false);}});return true;
  }catch{setAwake(false);return false;}finally{requesting.current=false;setAwakePending(false);}
 }
 useEffect(()=>{
  const sync=()=>setFullscreen(pageIsFullscreen(document));sync();setStandalone(window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches||!!(navigator as any).standalone);
  const visible=()=>{if(document.visibilityState==='visible'&&wanted.current)void acquire();};
  document.addEventListener('fullscreenchange',sync);document.addEventListener('webkitfullscreenchange',sync);document.addEventListener('visibilitychange',visible);
  return()=>{wanted.current=false;void lock.current?.release();document.removeEventListener('fullscreenchange',sync);document.removeEventListener('webkitfullscreenchange',sync);document.removeEventListener('visibilitychange',visible);};
 },[]);
 async function keepAwake(){
  if(requesting.current)return;
  if(lock.current){wanted.current=false;await lock.current.release();return;}
  wanted.current=true;if(!await acquire())setHelp('awake');
 }
 async function fullScreen(){try{if(await togglePageFullscreen(document)==='unavailable')setHelp('fullscreen');}catch{setHelp('fullscreen');}}
 useEffect(()=>{if(!help)return;const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setHelp(null);};document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);},[help]);
 return <><div className="screen-controls" role="group" aria-label="Screen controls"><button className="awake-switch" role="switch" aria-label="Keep screen awake" aria-checked={awake} aria-busy={awakePending} disabled={awakePending} onClick={()=>void keepAwake()}><Sun aria-hidden="true"/><span>Keep screen awake</span><span className="awake-switch-track" aria-hidden="true"><span/></span><span className="awake-switch-state" aria-hidden="true">{awakePending?'…':awake?'On':'Off'}</span></button>{standalone&&!fullscreen?<span className="app-window-status">App window</span>:<button aria-pressed={fullscreen} onClick={()=>void fullScreen()}>{fullscreen?<Minimize aria-hidden="true"/>:<Expand aria-hidden="true"/>}{fullscreen?'Exit full screen':'Full screen'}</button>}<form method="post" action="/auth/logout"><button type="submit">Sign out</button></form></div>
 {help&&createPortal(<div className="overlay"><section className="modal screen-help" role="dialog" aria-modal="true" aria-labelledby="screen-help-title"><button className="close" onClick={()=>setHelp(null)} aria-label="Close screen help">×</button><p className="eyebrow">IPAD SCREEN</p><h2 id="screen-help-title">{help==='fullscreen'?'Full screen on iPad':'Keep the iPad awake'}</h2>{help==='fullscreen'?<><p>This browser couldn’t switch the tab to full screen. Open the register as a Home Screen app to use it without the browser’s address bar.</p><p><a href="/install.html">Set up the TLPT Cashier iPad app →</a></p><p>Open that setup page in Safari, choose <b>Share → Add to Home Screen</b>, and leave <b>Open as Web App</b> on if shown. Then launch the new poker-chip icon from the Home Screen.</p></>:<><p>The browser couldn’t keep the screen awake automatically.</p><p>On the iPad, open <b>Settings → Display &amp; Brightness → Auto-Lock → Never</b> for the event. You can restore your usual Auto-Lock setting afterward.</p></>}<div className="modalbuttons"><button className="primary" onClick={()=>setHelp(null)}>Got it</button></div></section></div>,document.body)}</>;
}
export default memo(ScreenControls);
