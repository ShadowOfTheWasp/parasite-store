'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8');
assert.match(source,/catch\(err\)\{if\(e\.request\.mode==='navigate'&&!toolPath\.test\(u\.pathname\)\)/);
assert.doesNotMatch(source,/catch\(e\)\{if\(e\.request\.mode/);
assert.match(source,/parasite-v3-offline-integrity-20261123-v2/);
new vm.Script(source,{filename:'sw.js'});
console.log('PASS: offline navigation guard, event scope, cache bump, syntax');
