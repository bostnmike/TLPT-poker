// Local service-binding caller. No production config references this module.
export default {async fetch(request,env){
 const path=new URL(request.url).pathname;
 if(path==='/health')return Response.json({ok:true});
 if(path==='/preview')return Response.json(await env.CLOSEOUT.preview(await request.json()));
 if(path==='/close')return Response.json(await env.CLOSEOUT.close(await request.json()));
 return env.INSPECT.fetch(request);
}};
