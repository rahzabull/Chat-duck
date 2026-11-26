// Execute ONLY the app's pure validators for differential tests; no Electron.
const fs=require('node:fs'), path=require('node:path'), {stripTypeScriptTypes}=require('node:module');
const root=process.argv[2], contract=JSON.parse(fs.readFileSync(process.argv[3],'utf8')), cache={};
const stubs={
  'src/core/dialogue/index.ts':{POLICIES:contract.policies},
  'src/core/dialogue/lines.ts':{TALK_LINES:contract.talk},
  'src/shared/schemas/settings.ts':{isRecord:v=>v!==null&&typeof v==='object'&&!Array.isArray(v)},
  'src/shared/schemas/settings/index.ts':{isRecord:v=>v!==null&&typeof v==='object'&&!Array.isArray(v)}
};
function load(file) {
  file=file.replaceAll('\\','/'); if(stubs[file])return stubs[file]; if(cache[file])return cache[file];
  if(!fs.existsSync(path.join(root,file)))file=file.replace(/\.ts$/,'/index.ts');
  if(stubs[file])return stubs[file]; if(cache[file])return cache[file];
  if(!['src/ai/response-validation/index.ts','src/core/content-safety/index.ts','src/core/awareness/vision.ts','src/animation/adapter/index.ts','src/core/conversation/validation.ts','src/core/conversation/types.ts','src/core/conversation/output.ts'].includes(file))throw Error('Unapproved import '+file);
  let source=stripTypeScriptTypes(fs.readFileSync(path.join(root,file),'utf8'),{mode:'transform'});
  source=source.replace(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g,(_m,names,ref)=>`const {${names.replace(/\bas\b/g,':')}} = require(${JSON.stringify(ref)});`);
  let names=[]; source=source.replace(/export\s+(const|function|class)\s+(\w+)/g,(_m,kind,name)=>{names.push(name);return kind+' '+name});
  source=source.replace(/export\s*\{\s*\};?/g,'');
  const exports={}; cache[file]=exports;
  new Function('require','exports',source+'\nObject.assign(exports,{'+names.join(',')+'});')(ref=>load(path.posix.normalize(path.posix.join(path.posix.dirname(file),ref+'.ts'))),exports);
  return exports;
}
const ambient=load('src/ai/response-validation/index.ts'), conversation=load('src/core/conversation/validation.ts');
let input=''; process.stdin.setEncoding('utf8'); process.stdin.on('data',s=>input+=s); process.stdin.on('end',()=>{
  const results=JSON.parse(input).map(test=>{
    try {
      if(test.row.kind==='ambient')return ambient.validateResponse(test.raw,test.row.context,test.recent||[]);
      return {kind:'conversation',value:conversation.validateReply(test.raw,test.row.context.availableTools)};
    } catch(e) {return {kind:'invalid'};}
  });
  process.stdout.write(JSON.stringify(results));
});
