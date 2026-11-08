import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {releaseSnapshot} from '../scripts/lib/release-snapshot.mjs';

function fixture(run) {
 const root=mkdtempSync(join(tmpdir(),'tlpt-release-unit-'));
 const git=args=>execFileSync('git',['-c','core.hooksPath=/dev/null','-c','commit.gpgsign=false','-c','user.name=Local fixture','-c','user.email=fixture@example.test','-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:10000});
 try{git(['init']);mkdirSync(join(root,'rsvp'));writeFileSync(join(root,'rsvp/worker.mjs'),'committed');git(['add','.']);git(['commit','-m','Synthetic fixture']);run(root,git);}finally{rmSync(root,{recursive:true,force:true});}
}
test('publication snapshot contains checked committed source despite later working-copy edits',()=>fixture((root,git)=>{
 const revision=git(['rev-parse','HEAD']).trim();
 writeFileSync(join(root,'rsvp/worker.mjs'),'dirty edit after checks');writeFileSync(join(root,'rsvp/private-untracked.txt'),'never publish');
 writeFileSync(join(root,'rsvp/.gitignore'),'ignored.txt');writeFileSync(join(root,'rsvp/ignored.txt'),'never publish');
 const captured=releaseSnapshot(root,revision);
 try{assert.equal(readFileSync(join(captured.root,'worker.mjs'),'utf8'),'committed');assert.equal(existsSync(join(captured.root,'private-untracked.txt')),false);assert.equal(existsSync(join(captured.root,'ignored.txt')),false);}finally{captured.cleanup();}
 assert.equal(existsSync(captured.root),false);
}));
test('publication snapshot rejects non-revisions and tracked symlinks',()=>fixture((root,git)=>{
 assert.throws(()=>releaseSnapshot(root,'HEAD'),/Invalid checked/);
 symlinkSync('../outside.mjs',join(root,'rsvp/linked.mjs'));git(['add','.']);git(['commit','-m','Synthetic linked input']);
 assert.throws(()=>releaseSnapshot(root,git(['rev-parse','HEAD']).trim()),/without external symlinks/);
}));
