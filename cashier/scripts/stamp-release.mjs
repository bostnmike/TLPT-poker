import {writeFileSync} from 'node:fs';
import {shaPattern} from './release-tools.mjs';
const sha=process.argv[2];if(!shaPattern.test(sha||''))throw Error('Stamp builds with a full commit SHA.');
writeFileSync('dist/release.json',JSON.stringify({app:'tlpt-cashier',revision:sha})+'\n');
