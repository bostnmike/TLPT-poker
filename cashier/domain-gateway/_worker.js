// Pages supports an externally managed subdomain. The cashier Worker remains
// responsible for authentication, assets, imports, and the single live ledger.
export default {
 async fetch(request,env){
  if(!env.CASHIER?.fetch)return new Response('Cashier connection is being configured.',{status:503,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow, noarchive'}});
  return env.CASHIER.fetch(request);
 }
};
