// Local service-binding caller. No production config references this module.
let open=true;
export default {async fetch(request,env){
 const path=new URL(request.url).pathname;
 if(path==='/api/public/events')return Response.json({schemaVersion:1,revision:open?1:2,events:[{id:'stable-mtt',slot:'mtt',date:'2020-01-01',rsvpOpen:open}]});
 if(path==='/freeze')open=false;
 if(path==='/health')return Response.json({ok:true});
 if(path==='/preview')return Response.json(await env.CLOSEOUT.preview(await request.json()));
 if(path==='/close')return Response.json(await env.CLOSEOUT.close(await request.json()));
 return env.INSPECT.fetch(request);
}};
