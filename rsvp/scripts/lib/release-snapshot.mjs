import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';

// Bundle only committed RSVP files, never an ignored/untracked working copy or
// an edit made after the clean-source gate. No database export is involved.
export function releaseSnapshot(repository,revision) {
  if(!/^[a-f0-9]{40}$/.test(revision||''))throw Error('Invalid checked source revision.');
  const options={timeout:15000,maxBuffer:32*1024*1024};
  const tree=execFileSync('git',['-C',repository,'ls-tree','-r',revision,'--','rsvp'],{...options,encoding:'utf8'});
  if(!tree.trim()||/^120000 /m.test(tree))throw Error('RSVP publication requires tracked regular source files, without external symlinks.');
  const temp=mkdtempSync(join(tmpdir(),'tlpt-rsvp-release-'));
  try{
    const archive=execFileSync('git',['-C',repository,'archive','--format=tar',revision,'rsvp'],options);
    execFileSync('tar',['-xf','-','-C',temp],{...options,input:archive});
    return {root:join(temp,'rsvp'),cleanup:()=>rmSync(temp,{recursive:true,force:true})};
  }catch(error){rmSync(temp,{recursive:true,force:true});throw error;}
}
