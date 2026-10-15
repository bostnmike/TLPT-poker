export function pageIsFullscreen(doc){return !!(doc.fullscreenElement||doc.webkitFullscreenElement);}
export async function togglePageFullscreen(doc){
 if(pageIsFullscreen(doc)){
  const exit=doc.exitFullscreen||doc.webkitExitFullscreen;if(!exit)return 'unavailable';await exit.call(doc);return 'exited';
 }
 const root=doc.documentElement;
 if(root.requestFullscreen&&doc.fullscreenEnabled!==false){await root.requestFullscreen();return 'entered';}
 if(root.webkitRequestFullscreen&&doc.webkitFullscreenEnabled!==false){await root.webkitRequestFullscreen();return 'entered';}
 return 'unavailable';
}
// Transport timestamps change on every poll without changing anything visible.
export function registerViewKey(data){const {serverAt,scheduleCheckedAt,...view}=data;return JSON.stringify(view);}
