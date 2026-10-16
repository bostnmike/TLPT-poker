// Pages supports an externally managed subdomain. The cashier Worker remains
// responsible for authentication, assets, imports, and the single live ledger.
export default {
 async fetch(request,env){
  const result=env.CASHIER?.fetch?await env.CASHIER.fetch(request):new Response('Cashier connection is being configured.',{status:503,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow, noarchive'}});
  const headers=new Headers(result.headers);
  if(env.GATEWAY_SOURCE_HASH)headers.set('X-TLPT-Gateway-Source',env.GATEWAY_SOURCE_HASH);
  return new Response(result.body,{status:result.status,statusText:result.statusText,headers});
 }
};
