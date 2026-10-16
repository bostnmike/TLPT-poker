import {readFileSync,appendFileSync} from 'node:fs';
let receipt={};try{receipt=JSON.parse(readFileSync('deployment-receipt.json','utf8'));}catch{}
const status=process.env.RELEASE_STATUS||'unknown';
const lines=[`## TLPT Cashier production: ${status}`,`Commit: \`${process.env.GITHUB_SHA}\``,`Live cashier: https://cashier.tlpt.org`, `Shortcut: https://tlpt.org/cashier.html`, '', '```json',JSON.stringify(receipt,null,2),'```','','Recovery and rollback: cashier/DEPLOYMENT.md'];
if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
console.log(`Cashier production release: ${status}. See the deployment receipt and recovery guide.`);
