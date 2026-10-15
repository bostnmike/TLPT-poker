declare namespace Cloudflare {
 interface Env {
  DB:D1Database;
  ASSETS:Fetcher;
  CASHIER_ENV:'local'|'staging'|'production';
  OWNER_EMAIL:string;
  AUTH_MODE?:'password'|'access';
  CASHIER_PASSWORD_HASH?:string;
  SESSION_SECRET?:string;
  CF_ACCESS_TEAM_DOMAIN:string;
  CF_ACCESS_AUD:string;
  IMPORT_TOKEN?:string;
  LOCAL_OWNER_EMAIL?:string;
 }
}
