import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const logo=readFileSync(root+'public/bittrees_logo_tree.png');
const out=root+'public/contributor-artwork/v1/';mkdirSync(out,{recursive:true});
const levels=['Advisor','Part Time','Half Time','Full Time'];
const ranks=['Contributor','Senior Contributor','Lead Contributor'];
const states=['Active','Suspended','Ended','Revoked','Not yet effective','Expired'];
const sha=b=>createHash('sha256').update(b).digest('hex');
const files={};
for(let l=0;l<4;l++)for(let r=0;r<3;r++)for(let s=0;s<6;s++){
 const color=s===0?'#28683d':s===1?'#865a14':s===3?'#a33336':'#52616c';
 const rankColor=['#4b9156','#738591','#bc8a24'][r];
 const rings=Array.from({length:r+1},(_,i)=>`<rect x="${21+i*7}" y="${21+i*7}" width="${758-i*14}" height="${958-i*14}" rx="18" fill="none" stroke="${rankColor}" stroke-width="2"/>`).join('');
 const marks=Array.from({length:4},(_,i)=>`<rect x="${548+i*24}" y="698" width="16" height="16" rx="3" fill="${i<=l?'#28683d':'#dce6df'}"/>`).join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000"><title>Bittrees Contributor — ${levels[l]}, ${ranks[r]}, ${states[s]}</title><rect width="800" height="1000" rx="24" fill="#f7fbf8"/>${rings}<text x="400" y="107" text-anchor="middle" font-family="Georgia,serif" font-size="44" fill="#204d32">Bittrees</text><text x="400" y="143" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" fill="#52655a">Contributor credential</text><image x="185" y="166" width="430" height="430" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${logo.toString('base64')}"/><g font-family="Arial,sans-serif"><text x="400" y="653" text-anchor="middle" font-size="32" fill="#204d32">${ranks[r]}</text><path d="M100 678H700" stroke="#cddbd0"/><text x="100" y="717" font-size="25" fill="#204d32">${levels[l]}</text>${marks}<rect x="100" y="751" width="600" height="69" rx="12" fill="${color}"/><text x="400" y="795" text-anchor="middle" font-size="27" fill="white">${states[s]}</text><text x="400" y="864" text-anchor="middle" font-size="21" fill="#204d32">Memorandum of contribution</text><text x="400" y="898" text-anchor="middle" font-size="16" fill="#52655a">Individual terms recorded in the signed memorandum</text><text x="400" y="943" text-anchor="middle" font-size="17" fill="#52655a">Non-transferable</text></g></svg>`;
 const name=`${l}-${r}-${s}.svg`;writeFileSync(out+name,svg);files[name]=sha(svg);
}
writeFileSync(out+'manifest.json',JSON.stringify({version:1,logoSource:'public/bittrees_logo_tree.png',logoSha256:sha(logo),logoEmbeddedByteForByte:true,levels,ranks,states,files},null,2)+'\n');
console.log(`Generated ${Object.keys(files).length} status cards using original logo ${sha(logo)}`);
