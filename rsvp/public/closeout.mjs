const $=selector=>document.querySelector(selector);
const dialog=$('#closeout-dialog'),form=$('#closeout-form'),fields=$('#closeout-fields');
const status=$('#closeout-status'),preview=$('#closeout-preview'),dismiss=$('#closeout-dismiss');
let plan=null,saving=false,opening=0,initialTarget=new URLSearchParams(location.search).get('closeout');
async function request(path,body){
  const response=await fetch('/api/'+path,{cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
  const data=await response.json();
  if(!response.ok||data.ok===false){const error=new Error(data.error||'Could not verify close-out.');error.pending=data.pending;throw error;}
  return data;
}
function updated(message){document.dispatchEvent(new CustomEvent('tlpt-closeout-updated',{detail:{message}}));}
async function open(eventId){
  if(saving)return;
  const token=++opening;plan=null;form.reset();preview.hidden=true;fields.disabled=true;
  $('#closeout-game').textContent='';status.textContent='Checking the finished game, published results and Cashier records…';
  dismiss.disabled=false;if(!dialog.open)dialog.showModal();
  try{
    const result=await request('closeout?'+new URLSearchParams({eventId}));
    if(token!==opening||!dialog.open)return;
    if(result.complete){dialog.close();updated('This game has already been closed out.');return;}
    plan=result;
    $('#closeout-game').textContent=result.event.title+' · '+result.event.date;
    const cashier=result.cashier,evidence=cashier.evidence;
    $('#closeout-results').textContent=cashier.alreadyClosed?'Cashier cleanup is already confirmed. Resume to finish clearing RSVP.':'Published final results verified: '+evidence.title+' · '+evidence.date;
    $('#closeout-counts').textContent=`${result.responses} RSVP ${result.responses===1?'response':'responses'} · ${result.waitlist} waitlisted · ${result.coffeeOrders} coffee ${result.coffeeOrders===1?'order':'orders'}. `+(cashier.alreadyClosed?'Cashier records have been cleared.':`${cashier.records} Cashier payment ${cashier.records===1?'record':'records'}, including ${cashier.review} needing review.`);
    form.querySelector('[type=submit]').textContent=result.event.pending?'Resume close-out':'Close out event';
    preview.hidden=false;fields.disabled=false;
    status.textContent=result.event.pending?'Close-out is pending. Confirm below to safely resume.':'Review the game and confirm below before clearing its working data.';
  }catch(error){if(token===opening)status.textContent=error.message;}
}
form.addEventListener('submit',async event=>{
  event.preventDefault();if(!plan||saving||!form.reportValidity())return;
  saving=true;fields.disabled=true;dismiss.disabled=true;status.textContent='Closing out the game in Cashier and RSVP…';
  try{
    const cashier=plan.cashier;
    await request('closeout',{eventId:plan.event.id,confirmationDate:plan.event.date,requestId:plan.requestId,rsvpRevision:plan.rsvpRevision,expectedRevision:cashier.historyRevision,expectedResultsRevision:cashier.evidence?.revision||cashier.receipt?.resultsRevision,payoutsConfirmed:true,receiptsReviewed:true,resultsConfirmed:true});
    dialog.close();updated('Event closed out. RSVP and Cashier working data cleared; final reports and results are kept.');
  }catch(error){status.textContent=error.message;updated(error.pending?'Close-out is pending. Use Resume close-out to finish.':null);plan=null;preview.hidden=true;}
  finally{saving=false;dismiss.disabled=false;}
});
dismiss.addEventListener('click',()=>{if(!saving)dialog.close();});
dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
dialog.addEventListener('close',()=>{opening++;plan=null;});
document.addEventListener('click',event=>{const button=event.target.closest('[data-closeout-event]');if(button&&!button.disabled)open(button.dataset.closeoutEvent);});
document.addEventListener('tlpt-activity-change',({detail})=>{if(detail.commish&&!detail.preview&&initialTarget){const target=initialTarget;initialTarget=null;open(target);}});
if(initialTarget&&document.querySelector('[role=tab][aria-selected=true]')){const target=initialTarget;initialTarget=null;open(target);}
