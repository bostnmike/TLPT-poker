export function installationPlatform(nav){
 if(/iPhone|iPad|iPod/i.test(nav.userAgent)||nav.platform==='MacIntel'&&nav.maxTouchPoints>1)return 'ios';
 return /Android/i.test(nav.userAgent)?'android':'desktop';
}
export function standalone(win){return !!win.navigator.standalone||win.matchMedia('(display-mode: standalone)').matches;}
export function initInstallation(win,doc){
 const banner=doc.querySelector('#install-banner'),dialog=doc.querySelector('#install-dialog'),native=doc.querySelector('#native-install'),status=doc.querySelector('#install-status'),footer=doc.querySelector('#installation-help');
 let pending=null,installed=standalone(win),selectedPlatform=installationPlatform(win.navigator);
 function platform(value){
  selectedPlatform=value;
  doc.querySelectorAll('[data-install-platform]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.installPlatform===value)));
  doc.querySelectorAll('[data-install-steps]').forEach(p=>p.hidden=p.dataset.installSteps!==value);update();
 }
 function update(){banner.hidden=installed;footer.hidden=installed;native.hidden=installed||!pending||selectedPlatform!==installationPlatform(win.navigator);}
 function help(){platform(installationPlatform(win.navigator));dialog.showModal();update();}
 async function install(){
  if(!pending){help();return;}
  const prompt=pending;pending=null;update();
  try{await prompt.prompt();const choice=await prompt.userChoice;status.textContent=choice.outcome==='accepted'?'Finish adding TLPT RSVP in your browser, then open its Home Screen icon.':'You can still add TLPT RSVP from your browser menu.';}
  catch{status.textContent='Use the steps below to add TLPT RSVP from your browser menu.';}
  if(!installed&&!dialog.open)help();
 }
 doc.querySelector('#add-to-home-screen').addEventListener('click',install);
 footer.addEventListener('click',help);native.addEventListener('click',install);
 doc.querySelectorAll('[data-install-platform]').forEach(b=>b.addEventListener('click',()=>platform(b.dataset.installPlatform)));
 win.addEventListener('beforeinstallprompt',event=>{event.preventDefault();if(installed)return;pending=event;update();});
 win.addEventListener('appinstalled',()=>{installed=true;pending=null;status.textContent='TLPT RSVP was added. Open it from your Home Screen.';update();});
 win.matchMedia('(display-mode: standalone)').addEventListener?.('change',()=>{installed=standalone(win);update();});
 if('serviceWorker' in win.navigator)win.navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(()=>{});
 platform(installationPlatform(win.navigator));update();
}
if(typeof window!=='undefined')initInstallation(window,document);
