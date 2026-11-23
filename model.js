'use strict';
const JK=(()=>{
 // Each profile describes synthetic training data, including a full fryer trace.
 const profiles=[
   {name:'순살 가라아게', grams:39, spread:5, kg:13, brine:80, oil:[176,162,164,168,172,174,175,176,175,175,176,175,175]},
   {name:'뼈 있는 치킨', grams:105, spread:12, kg:16, brine:100, oil:[179,163,165,169,173,176,177,179,178,178,179,178,178]},
   {name:'닭껍질 튀김', grams:12, spread:2, kg:7, brine:30, oil:[172,165,168,170,171,172,172,171,172,171,172,172,172], issue:{acid:1.42}},
   {name:'닭똥집 튀김', grams:23, spread:4, kg:10, brine:60, oil:[175,163,162,165,168,171,173,174,174,175,175,174,175], issue:{grams:34}},
   {name:'오징어 가라아게', grams:18, spread:3, kg:8, brine:25, oil:[174,160,162,166,169,172,173,174,173,174,174,173,174], issue:{kg:12.6,oil:[174,155,153,155,158,161,165,168,170,172,173,174,174]}},
   {name:'순살 간장치킨', grams:48, spread:6, kg:14, brine:85, oil:[177,164,163,166,170,172,175,176,177,176,177,177,176], issue:{brine:57}}
 ];
 const products=profiles.map(p=>p.name);
 const sample=(n,d=1)=>+n.toFixed(d);
 function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
 function reference(k,i,rnd){
   const error=span=>(rnd()+rnd()-1)*span;
   const p=profiles[k];
   return {id:'REF-'+k+'-'+(i+1),product:p.name,grams:sample(p.grams+error(p.spread)),kg:sample(p.kg+error(2)),brine:Math.round(p.brine+error(10)),acid:sample(.8+error(.24),2),oil:p.oil.map(x=>sample(x+error(1.4)))};
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
 const rnd=random(17);const rows=Array.from({length:10},(_,i)=>{const k=i%2,r=reference(k,i,rnd);r.id='F-'+String(101+i);r.order=i+1;r.label=false;
 if(i===2){r.kg=18.2;r.grams=44;r.oil=[176,156,154,157,161,165,168,171,173,174,175,176,176];r.label=true}
 if(i===5){r.acid=1.46;r.label=true}if(i===7){r.brine=73;r.label=true}return r;});
 for(let k=2;k<profiles.length;k++){
   const rng=random(480+k);
   for(let i=0;i<5;i++){
     const order=rows.length+1;
     const row={...reference(k,i,rng),id:'F-'+(100+order),order,label:i===1};
     if(row.label) Object.assign(row,profiles[k].issue);
     rows.push(row);
   }
 }
 return rows;
 }
 // Older browsers can already contain imported lots using the new IDs or orders.
 function extendCatalog(db){
   if(db.catalogVersion===2)return false;
   const existingIds=new Set(db.rows.map(r=>r.id));
   let next=db.rows.reduce((n,r)=>Math.max(n,r.order),0);
   for(const row of seeds().slice(10)){
     const baseId=row.id;
     let suffix=1;
     while(existingIds.has(row.id))row.id=baseId+'-'+suffix++;
     existingIds.add(row.id);
     row.order=++next;
     db.rows.push(row);
   }
   db.catalogVersion=2;
   return true;
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
 const weighHeaders=['로트','제품','시료수_개','시료총중량_g','투입량_kg'];
 function weighSample(rows){
   return [weighHeaders,...rows.map((r,i)=>[r.id,r.product,10,i===rows.length-1?'':sample(r.grams*10),r.kg])];
 }
 function readWeights(text,rows){
   const [head,...lines]=parse(text);
   if(!head||head.join('|')!==weighHeaders.join('|')||!lines.length)throw Error('계량표 양식의 제목과 한 줄 이상의 계량 기록이 필요합니다.');
   const lots=new Map(rows.map(r=>[r.id,r])),seen=new Set();
   return lines.map((line,i)=>{
     const [id,product,...cells]=line;
     if(line.length!==5||!lots.has(id)||lots.get(id).product!==product)throw Error((i+2)+'행의 로트와 제품을 생산 기록에서 찾을 수 없습니다.');
     if(seen.has(id))throw Error(id+' 회차가 두 줄 이상입니다. 회차마다 한 줄로 정리하세요.');
     seen.add(id);
     const [count,total,kg]=cells.map(s=>s===''?null:Number(s));
     if([count,total,kg].some(n=>n!==null&&(!Number.isFinite(n)||n<=0))||(count!==null&&!Number.isSafeInteger(count)))throw Error((i+2)+'행의 계량 단위와 숫자를 확인하세요.');
     const grams=count&&total?sample(total/count):null;
     if(grams!==null&&(!Number.isFinite(grams)||grams<=0))throw Error((i+2)+'행의 시료 수량과 중량을 확인하세요.');
     const issues=[];
     const model=models[products.indexOf(product)];
     for(const [n,value] of [grams,kg].entries()){
       const name=n===0?'평균 조각 무게':'투입량';
       if(value===null){issues.push(name+' 누락');continue}
       const distance=(value-model[n].center)/model[n].scale;
       if(Math.abs(distance)>=3)issues.push(name+(distance>0?' 높음':' 낮음'));
     }
     const status=grams===null||kg===null?'누락':issues.length?'검토 필요':'자동 반영';
     return {id,product,count,total,grams,kg,issues,status};
   });
 }
 function applyWeights(row,item){
   if(item.grams===null||item.kg===null)throw Error('누락된 측정값이 있습니다.');
   if(row.grams!==item.grams||row.kg!==item.kg)row.label=null;
   row.grams=item.grams;
   row.kg=item.kg;
 }
 return {products,refs,models,seeds,extendCatalog,analyze,recovery,median,csvRows,importRecords,weighSample,readWeights,applyWeights};
})();
if(typeof module!=='undefined')module.exports=JK;

