import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const bundle = path.dirname(fileURLToPath(import.meta.url));
const targetArg = process.argv.slice(2).find(a => a !== '--check');
if (!targetArg) {
  console.error('Usage: node update-existing.mjs "C:\\path\\to\\existing\\servicetrack" [--check]');
  process.exit(1);
}
const target = fs.realpathSync(path.resolve(targetArg));
const source = path.join(bundle, 'servicetrack');
if (target === fs.realpathSync(source)) throw new Error('Choose your OLD project folder, not the new source folder in this ZIP.');
const packageFile = path.join(target, 'package.json');
if (!fs.existsSync(packageFile) || JSON.parse(fs.readFileSync(packageFile)).name !== 'servicetrack') throw new Error('Target is not a ServiceTrack project root.');
const manifest = JSON.parse(fs.readFileSync(path.join(bundle, 'update-manifest.json')));
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const pending = [], conflicts = [];
for (const item of manifest) {
  const dst = path.join(target, item.file), src = path.join(source, item.file);
  // Manifest is limited to shipped source/docs; never environment, data or dependencies.
  if (path.isAbsolute(item.file) || item.file.split(/[\\/]/).some(p => ['..','.env','.data','node_modules','.git'].includes(p))) throw new Error('Unsafe update path.');
  if (digest(src) !== item.after) throw new Error(`New source was modified: ${item.file}`);
  let exists = fs.existsSync(dst);
  if (exists && fs.lstatSync(dst).isSymbolicLink()) throw new Error(`Refusing symbolic link: ${item.file}`);
  let parent = path.dirname(dst);
  while(parent !== target){
    if(fs.existsSync(parent) && fs.lstatSync(parent).isSymbolicLink()) throw new Error(`Refusing linked directory: ${parent}`);
    parent=path.dirname(parent);
  }
  if (exists && digest(dst) === item.after) continue;
  if (exists && !item.before.includes(digest(dst))) conflicts.push(item.file);
  else pending.push(item);
}
if (conflicts.length) {
  console.error('No files changed. These files have local edits that need reviewing first:\n'+conflicts.join('\n'));
  process.exit(2);
}
console.log(`${pending.length} files can be updated. Your .env, .data and dependencies are preserved.`);
if (process.argv.includes('--check') || !pending.length) process.exit(0);
const backup = path.join(target, 'update-backups', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(backup, {recursive:true});
const added=[];
for (const {file} of pending) {
 const dst=path.join(target,file), old=path.join(backup,file);
 if(fs.existsSync(dst)){fs.mkdirSync(path.dirname(old),{recursive:true});fs.copyFileSync(dst,old);}
 else added.push(file);
}
fs.writeFileSync(path.join(backup,'added-files.json'),JSON.stringify(added,null,2));
const written=[];
try {
 for(const {file} of pending){const dst=path.join(target,file);fs.mkdirSync(path.dirname(dst),{recursive:true});written.push(file);fs.copyFileSync(path.join(source,file),dst);}
}catch(error){
 for(const file of written.reverse()){const dst=path.join(target,file),old=path.join(backup,file);if(fs.existsSync(old))fs.copyFileSync(old,dst);else if(fs.existsSync(dst))fs.unlinkSync(dst);}
 throw error;
}
console.log(`Update complete. Source backup: ${backup}\nIn your existing project run npm ci, then npm run build, then restart the app. No seed/reset is needed. Import sample catalogue in Inventory if wanted.`);
