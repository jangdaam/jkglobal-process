'use strict';
const JK=(()=>{
 const products=['순살 가라아게','뼈 있는 치킨'];
 const base=[[176,162,164,168,172,174,175,176,175,175,176,175,175],[179,163,165,169,173,176,177,179,178,178,179,178,178]];
 const sample=(n,d=1)=>+n.toFixed(d);
 function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
 function reference(k,i,rnd){
   const error=span=>(rnd()+rnd()-1)*span;
   return {id:'REF-'+k+'-'+(i+1),product:products[k],grams:sample((k?105:39)+error(k?12:5)),kg:sample((k?16:13)+error(2)),brine:Math.round((k?100:80)+error(10)),acid:sample(.8+error(.24),2),oil:base[k].map(x=>sample(x+error(1.4)))};
 }
 const median=a=>{const b=[...a].sort((x,y)=>x-y),n=b.length;return (b[(n-1)>>1]+b[n>>1])/2};
 const recovery=r=>{const gate=r.oil[0]-3;const index=r.oil.findIndex((v,i)=>i>0&&v>=gate);return index===-1?null:index};
 const names=['평균 조각 무게','회차 투입량','염지 시간','시작 산가','유온 하락폭','회복 시간'];
 const units=['g','kg','분','mg KOH/g','°C','분'];
 const vector=r=>[r.grams,r.kg,r.brine,r.acid,r.oil[0]-Math.min(...r.oil),recovery(r)??13];
 const refs=products.map((_,k)=>{const rnd=random(142+k);return Array.from({length:80},(_,i)=>reference(k,i,rnd))});
 const models=refs.map(rows=>{const v=rows.map(vector);return names.map((_,j)=>{const col=v.map(x=>x[j]),center=median(col);return {center,scale:Math.max([1,.5,2,.08,1,1][j],1.4826*median(col.map(n=>Math.abs(n-center))))}})});
 function analyze(r){const model=models[products.indexOf(r.product)],v=vector(r);const diff=v.map((n,j)=>({name:names[j],unit:units[j],value:n,center:model[j].center,z:Math.abs(n-model[j].center)/model[j].scale})).sort((a,b)=>b.z-a.z);return {score:sample(diff[0].z,2),diff}}
 function seeds(){
 const rnd=random(17);return Array.from({length:10},(_,i)=>{const k=i%2,r=reference(k,i,rnd);r.id='F-'+String(101+i);r.order=i+1;r.label=false;
 if(i===2){r.kg=18.2;r.grams=44;r.oil=[176,156,154,157,161,165,168,171,173,174,175,176,176];r.label=true}
 if(i===5){r.acid=1.46;r.label=true}if(i===7){r.brine=73;r.label=true}return r;});
 }
 const headers=['로트','생산순번','제품','조각무게_g','투입량_kg','염지_분','산가_mgKOH_g','경과_분','유온_C'];
 function csvRows(rows){return [headers,...rows.flatMap(r=>r.oil.map((v,i)=>[r.id,r.order,r.product,r.grams,r.kg,r.brine,r.acid,i,v]))]}
 function parse(text){
 const data=[];let row=[],value='',quote=false;const raw=text.replace(/^\uFEFF/,'');function end(){row.push(value.trim());if(row.some(Boolean))data.push(row);row=[];value=''}
 for(let i=0;i<raw.length;i++){const c=raw[i];if(c==='"'){if(quote&&raw[i+1]==='"'){value+='"';i++}else quote=!quote}else if(c===','&&!quote){row.push(value.trim());value=''}else if(!quote&&/[\n\r]/.test(c)){if(c==='\r'&&raw[i+1]==='\n')i++;end()}else value+=c}if(quote)throw Error('따옴표가 닫히지 않았습니다.');end();return data;
 }
 function importRecords(src,existing){
 const [h,...rows]=parse(src);if(!h||h.join('|')!==headers.join('|')||!rows.length)throw Error('연습 CSV의 제목 행과 0~12분 기록이 필요합니다.');
 const byId=new Map(),ids=new Set(existing.map(x=>x.id)),orders=new Set(existing.map(x=>x.order));
 for(const [i,line] of rows.entries()){const [id,os,p,...vals]=line;const order=Number(os);const [grams,kg,brine,acid,t,temp]=vals.map(Number);
 if(line.length!==9||line.some(v=>v==='')||!/^[-A-Za-z0-9_]{1,32}$/.test(id)||!products.includes(p)||!Number.isSafeInteger(order)||order<1||!vals.every(v=>Number.isFinite(Number(v)))||Math.min(grams,kg,brine)<=0||acid<0||!Number.isInteger(t)||t<0||t>12)throw Error((i+2)+'행의 제품, 단위 또는 숫자를 확인하세요.');
 let r=byId.get(id);if(!r){r={id,order,product:p,grams,kg,brine,acid,label:null,oil:Array(13).fill(null)};byId.set(id,r)}
 if(r.order!==order||r.product!==p||r.grams!==grams||r.kg!==kg||r.brine!==brine||r.acid!==acid||r.oil[t]!==null)throw Error(id+'의 공통값 또는 중복 시점을 확인하세요.');r.oil[t]=temp;
 }
 const added=[];let duplicate=0;for(const r of byId.values()){if(r.oil.includes(null))throw Error(r.id+'의 0~12분 기록 중 누락된 값이 있습니다.');if(ids.has(r.id)){duplicate++;continue}if(orders.has(r.order))throw Error('이미 등록된 생산순번입니다. '+r.order);orders.add(r.order);added.push(r)}return {added,duplicate};
 }
 return {products,refs,models,seeds,analyze,recovery,median,csvRows,importRecords};
})();
if(typeof module!=='undefined')module.exports=JK;

