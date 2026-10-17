// Some iPad versions save the current page instead of the manifest start URL.
// In that case launch the register inside the existing standalone window.
export function launchInstalledCashier(win){
 const installed=!!win.navigator?.standalone||!!win.matchMedia?.('(display-mode: standalone), (display-mode: fullscreen)').matches;
 if(installed)win.location.replace('/');
 return installed;
}
if(typeof window!=='undefined')launchInstalledCashier(window);
