declare namespace Cloudflare {
 interface Env {
  DB:D1Database;
  ASSETS:Fetcher;
  CASHIER_ENV:'local'|'staging'|'production';
  OWNER_EMAIL:string;
  CF_ACCESS_TEAM_DOMAIN:string;
  CF_ACCESS_AUD:string;
  IMPORT_TOKEN?:string;
  LOCAL_OWNER_EMAIL?:string;
 }
}
