import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const target=new URL('./engine/sentencepiece.js',import.meta.url);
const expected='44715f185863e6247194638b6dfa10db8a906a7047601fc891d3bcbe43741f32';
try {const bytes=await fs.readFile(target);if(crypto.createHash('sha256').update(bytes).digest('hex')===expected)process.exit(0);}catch{}
const response=await fetch('https://raw.githubusercontent.com/hemanth/pocket-voice/a4496c429f1dcd6ea8faef55a21dc4b7d45636a9/sentencepiece.js');
if(!response.ok)throw new Error('Tokenizer download failed.');
const bytes=Buffer.from(await response.arrayBuffer());
if(crypto.createHash('sha256').update(bytes).digest('hex')!==expected)throw new Error('Tokenizer integrity check failed.');
await fs.mkdir(new URL('./engine/',import.meta.url),{recursive:true});await fs.writeFile(target,bytes);
