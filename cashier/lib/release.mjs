export function releaseInfo(env){
 return {app:'tlpt-cashier',revision:env.RELEASE_SHA||'unreleased',versionId:env.CASHIER_VERSION?.id||null};
}
