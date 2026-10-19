import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startProdServer} from 'vinext/server/prod-server';

process.env.VGM_PAGES_BUILD='1';
process.env.NEXT_PUBLIC_BASE_PATH??='/VGMPulse';
process.env.NEXT_PUBLIC_SITE_ORIGIN??='https://jamxi233.github.io';

execFileSync(process.execPath,[resolve('node_modules/vinext/dist/cli.js'),'build'],{stdio:'inherit'});

const {server,port}=await startProdServer({port:0,host:'127.0.0.1',outDir:resolve('dist')});
try{
 const response=await fetch(`http://127.0.0.1:${port}${process.env.NEXT_PUBLIC_BASE_PATH}/`);
 if(!response.ok)throw Error(`Page export failed: HTTP ${response.status}`);
 const html=(await response.text()).replace(/(["'(])\/assets\//g,(_,prefix)=>`${prefix}${process.env.NEXT_PUBLIC_BASE_PATH}/assets/`);
 if(!html.includes('__VINEXT_RSC_DONE__'))throw Error('Page export is missing its initial payload.');
 await writeFile('dist/client/index.html',html);
 await writeFile('dist/client/.nojekyll','');
 console.log('Static site ready in dist/client.');
}finally{
 await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
}
