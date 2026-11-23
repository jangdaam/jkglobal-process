'use strict';
const $=s=>document.querySelector(s),key='jkglobal.recorder.v1',h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function initial(){return {rows:JK.seeds(),limit:3,pins:{},notes:[]}}
let db;try{db=JSON.parse(localStorage.getItem(key));if(!db?.rows?.length||!db.pins||!Array.isArray(db.notes)||!Number.isFinite(db.limit))db=initial()}catch{db=initial()}
let id=db.rows.find(r=>r.id==='F-103')?.id??db.rows[0].id,peer='',tab='play',minute=2,ticker=0,toastTimer;
const current=()=>db.rows.find(r=>r.id===id),compare=()=>db.rows.find(r=>r.id===peer);
const options=(values,v)=>values.map(x=>`<option ${x===v?'selected':''}>${h(x)}</option>`).join('');
const clock=n=>String(n).padStart(2,'0')+':00';
const fmt=n=>Number(n.toFixed(2)).toString();
const signed=n=>(n>0?'+':'')+fmt(n);
function say(text){$('#toast').textContent=text;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').textContent='',2900)}
function save(msg){try{localStorage.setItem(key,JSON.stringify(db));say(msg)}catch{say('브라우저 저장이 차단되어 현재 화면에만 반영됩니다.')}}
function modal(html){stop();$('#body').innerHTML=html;$('#modal').showModal()}
function csv(name,rows){
 const cell=x=>{let s=String(x??'');return '"'+(/^[=+@\-\t\r]/.test(s)?"'":'')+s.replaceAll('"','""')+'"'};
 const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(v=>v.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function stop(){clearInterval(ticker);ticker=0;if($('#toggle'))$('#toggle').textContent='재생'}
function sync(){
 const r=current(),group=db.rows.filter(x=>x.product===r.product).sort((a,b)=>a.order-b.order);
 const peers=group.filter(x=>x.id!==id);
 if(!peers.some(x=>x.id===peer))peer=(peers.filter(x=>x.order<r.order).at(-1)??peers[0]).id;
 $('#product').innerHTML=options(JK.products,r.product);$('#batch').innerHTML=options(group.map(x=>x.id),r.id);$('#compare').innerHTML=options(peers.map(x=>x.id),peer);
 document.querySelectorAll('[data-tab]').forEach(b=>{if(b.dataset.tab===tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
}
function defs(rows){return '<dl class="facts">'+rows.map(([label,v])=>`<div><dt>${h(label)}</dt><dd>${h(v)}</dd></div>`).join('')+'</dl>'}
function field(name,label,value,unitStep='0.1',min='0.1'){return `<label>${label}<input type="number" name="${name}" required min="${min}" step="${unitStep}" value="${value}"></label>`}
function raw(){
 const r=current(),c=compare();
 return `<div class="grid"><section class="panel"><h2>${h(id)} 원료 검수표</h2><p class="sub">${h(r.product)} 생산순번 ${r.order}</p><form id="rawForm" class="form">${field('grams','평균 조각 무게 (g)',r.grams)}${field('kg','회차 투입량 (kg)',r.kg)}${field('brine','염지 시간 (분)',r.brine)}${field('acid','시작 산가 (mg KOH/g)',r.acid,'0.01','0')}<button>검수값 저장</button></form><div class="tools"><button class="outline" id="sample">연습 CSV 받기</button><button class="outline" id="import">생산 기록 등록</button></div></section><section class="panel"><h2>회차 간 차이</h2><p class="sub">${h(id)}에서 ${h(peer)}의 값을 뺀 결과입니다.</p>${defs([['조각 무게',signed(r.grams-c.grams)+' g'],['투입량',signed(r.kg-c.kg)+' kg'],['염지 시간',signed(r.brine-c.brine)+'분'],['시작 산가',signed(r.acid-c.acid)+' mg KOH/g']])}</section></div>`
}
function maxGap(r,c){let best=0;r.oil.forEach((n,i)=>{if(Math.abs(n-c.oil[i])>Math.abs(r.oil[best]-c.oil[best]))best=i});return best}
function chart(r,c){
 const values = [...r.oil, ...c.oil];
 const lo = Math.floor((Math.min(...values)-2)/5)*5;
 const hi = Math.ceil((Math.max(...values)+2)/5)*5;
 const x = i => 50+i*49.6;
 const y = n => 167-142*(n-lo)/(hi-lo);
 const path = data => data.map((v,i) => (i?'L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1)).join(' ');
 const grid = Array.from({length:5},(_,i) => lo+(hi-lo)*i/4).map(n =>
   `<path class="gridline" d="M49 ${y(n)}H648"/><text x="41" y="${y(n)+4}" text-anchor="end">${fmt(n)}</text>`).join('');
 const ticks = [0,2,4,6,8,10,12].map(i => `<text x="${x(i)}" y="192" text-anchor="middle">${i}분</text>`).join('');
 return `<svg id="graph" viewBox="0 0 670 206" role="img" aria-label="생산 회차와 비교 회차의 0분부터 12분까지 유온 추이">
   <defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#158579" stop-opacity=".23"/><stop offset="1" stop-color="#158579" stop-opacity=".02"/></linearGradient></defs>
   ${grid}${ticks}<path d="${path(r.oil)} L${x(12)} 167 H50 Z" fill="url(#area)"/>
   <path class="compare-line" d="${path(c.oil)}"/><path class="current-line" d="${path(r.oil)}"/>
   <line class="cursor" x1="${x(minute)}" x2="${x(minute)}" y1="15" y2="167"/>
   <circle class="peer-dot" cx="${x(minute)}" cy="${y(c.oil[minute])}" r="4"/>
   <circle class="current-dot" cx="${x(minute)}" cy="${y(r.oil[minute])}" r="6"/></svg>`;
}
function pinNow(){const r=current(),c=compare();return {id,peer,minute,value:r.oil[minute],other:c.oil[minute]}}
function pinText(p){return `${p.id} / ${clock(p.minute)} / ${fmt(p.value)} °C (비교 ${p.peer}: ${fmt(p.other)} °C)`}
function updateFrame(){
 const r=current(),c=compare();$('#plot').innerHTML=chart(r,c);$('#at').textContent=clock(minute);$('#temperature').textContent=fmt(r.oil[minute])+' °C';
 $('#delta').textContent='비교 회차 대비 '+signed(r.oil[minute]-c.oil[minute])+' °C';$('#scrub').value=minute;
 const action=minute===0?'투입 직전':minute===1?'원료 투입':minute===12?'기록 종료':'투입 후 '+minute+'분';$('#event').textContent=action;
}
function renderEvidence(){const p=db.pins[id];return p?`<p class="evidence">${h(pinText(p))}</p>`:'<p class="hint">재생 화면에서 시점을 담으면 두 회차의 온도가 여기에 남습니다.</p>'}
function recoveryBar(row,minutes,other=false){
 const value = minutes===null ? '미회복' : minutes+'분';
 return `<div class="recovery-row ${other?'other':''}"><span>${h(row.id)}</span><div class="track" aria-hidden="true"><i style="width:${(minutes??12)/12*100}%"></i></div><strong>${value}</strong></div>`;
}
function replay(){
 const r=current(),c=compare(),a=JK.analyze(r),r1=JK.recovery(r),r2=JK.recovery(c);
 return `<div class="grid playback">
   <section class="panel monitor">
     <div class="spread"><h2>유온 기록</h2><span class="timecode" id="at"></span></div>
     <div class="readout"><strong id="temperature" class="live"></strong><span id="event"></span></div>
     <div class="sub" id="delta"></div><div id="plot"></div>
     <div class="legend"><span><i></i>${h(id)}</span><span><i class="peer"></i>${h(peer)} 비교</span></div>
     <div class="transport"><label class="sr-only" for="scrub">재생 위치</label><input type="range" id="scrub" min="0" max="12" step="1" value="${minute}">
     <div class="tools"><button id="toggle">재생</button><button class="outline" id="jump">최대 편차로</button><button class="outline" id="pin">이 시점 담기</button></div></div>
   </section>
   <section class="panel summary"><h2>회차 비교</h2>
     <div class="tiles"><div><span>최저 유온</span><strong>${fmt(Math.min(...r.oil))}<small>°C</small></strong></div><div><span>최대 편차 시점</span><strong>${maxGap(r,c)}<small>분</small></strong></div></div>
     <h3>유온 회복 시간</h3>
     ${recoveryBar(r,r1)}${recoveryBar(c,r2,true)}
     <p class="hint">투입 직전보다 3 °C 낮은 온도까지 다시 오르는 데 걸린 시간입니다.</p>
     <div class="pinned"><h3>일지에 담은 시점</h3><div id="evidence">${renderEvidence()}</div></div>
   </section></div>
   <section class="panel block"><div class="spread"><h2>점검 후보 선별</h2><strong class="mark">${a.score>=db.limit?'점검 후보':'참고 범위'} / 점수 ${fmt(a.score)}</strong></div>
     <div class="analysis"><div><p class="sub">제품별 참고 기록 80회에서 차이가 큰 항목을 골랐습니다.</p>
     <table><thead><tr><th>비교 항목</th><th>참고 중앙값</th><th>${h(id)}</th></tr></thead><tbody>${a.diff.slice(0,3).map(x=>`<tr><td>${x.name}</td><td>${fmt(x.center)} ${x.unit}</td><td>${x.name==='회복 시간'&&r1===null?'미회복':fmt(x.value)+' '+x.unit}</td></tr>`).join('')}</tbody></table></div>
     <div class="threshold"><label class="check">점검 기준 <b id="lim">${db.limit.toFixed(1)}</b><input type="range" id="limit" min="1" max="10" step="0.1" value="${db.limit}"></label><p class="sub" id="validation"></p></div></div>
   </section>`;
}
function metrics(){let fp=0,fn=0,n=0;for(const r of db.rows){if(typeof r.label!=='boolean')continue;n++;const is=JK.analyze(r).score>=db.limit;if(is&&!r.label)fp++;if(!is&&r.label)fn++}$('#validation').textContent=`별도 검증 ${n}건 중 오탐 ${fp}건, 누락 ${fn}건`}
function followText(r,f){if(!f)return '';const recovery=x=>JK.recovery(x)===null?'미회복':JK.recovery(x)+'분';return `${r.id} → ${f.id} / 투입량 ${r.kg} → ${f.kg} kg / 회복 ${recovery(r)} → ${recovery(f)}`}
function action(){
 const r=current(),after=db.rows.filter(x=>x.product===r.product&&x.order>r.order).sort((a,b)=>a.order-b.order);
 const ns=db.notes.filter(n=>n.id===id).slice().reverse();
 return `<div class="grid"><section class="panel"><h2>${h(id)} 점검 일지</h2>${renderEvidence()}<form id="noteForm" class="form"><label>검토 결과<select name="decision">${options(['재점검 요청','조건 확인','오탐으로 기록'],'재점검 요청')}</select></label><label>후속 생산 회차<select name="after" id="after"><option value="">연결하지 않음</option>${options(after.map(x=>x.id),'')}</select></label><p class="sub full" id="after-preview"></p><label class="full">조치 내용<textarea name="note" maxlength="1200" required placeholder="확인한 내용과 다음 작업자에게 전달할 사항을 적으세요."></textarea></label><div class="tools full"><button type="button" class="outline" id="fill">초안 채우기</button><button>일지 저장</button></div></form></section><section class="panel"><h2>저장한 기록 (${ns.length})</h2>${ns.map(n=>`<div class="log"><b>${h(n.decision)}</b><p>${h(n.note)}</p>${n.pin?`<p class="sub">${h(pinText(n.pin))}</p>`:''}<p class="sub">${h(n.follow||'후속 회차 미연결')}</p></div>`).join('')||'<p class="hint">저장한 일지가 여기에 쌓입니다.</p>'}<div class="tools"><button id="export" class="outline">전체 일지 내려받기</button></div></section></div>`
}
function render(){stop();sync();$('#work').innerHTML=tab==='raw'?raw():tab==='play'?replay():action();if(tab==='play'){updateFrame();metrics()}}
$('#batch').onchange=e=>{id=e.target.value;minute=2;render()};
$('#product').onchange=e=>{id=db.rows.find(r=>r.product===e.target.value).id;peer='';minute=2;render()};
$('#compare').onchange=e=>{peer=e.target.value;render()};
document.addEventListener('input',e=>{if(e.target.id==='scrub'){stop();minute=+e.target.value;updateFrame()}if(e.target.id==='limit')$('#lim').textContent=(+e.target.value).toFixed(1)});
document.addEventListener('change',e=>{if(e.target.id==='limit'){db.limit=+e.target.value;save('점검 기준을 적용했습니다.');render();$('#limit').focus()}if(e.target.id==='after')$('#after-preview').textContent=followText(current(),db.rows.find(r=>r.id===e.target.value))});
document.addEventListener('click',e=>{
 const graph=e.target.closest('#graph');if(graph){stop();const point=new DOMPoint(e.clientX,e.clientY).matrixTransform(graph.getScreenCTM().inverse());minute=Math.min(12,Math.max(0,Math.round((point.x-50)/49.6)));updateFrame();return}
 const b=e.target.closest('button');if(!b)return;if(b.dataset.tab){tab=b.dataset.tab;render();return}
 const r=current(),c=compare();
 switch(b.id){
 case 'toggle':if(ticker){stop();break}if(minute>=12)minute=0;updateFrame();b.textContent='일시 정지';ticker=setInterval(()=>{minute++;updateFrame();if(minute>=12)stop()},750);break;
 case 'jump':stop();minute=maxGap(r,c);updateFrame();break;
 case 'pin':stop();db.pins[id]=pinNow();$('#evidence').innerHTML=renderEvidence();save(clock(minute)+' 시점을 일지에 담았습니다.');break;
 case 'fill':{const f=$('#noteForm').elements,p=db.pins[id],reason=JK.analyze(r).diff[0];f.note.value=(p?pinText(p)+' 확인. ':'')+(f.decision.value==='오탐으로 기록'?'비교 회차의 원료 규격과 투입 조건을 다시 대조해 오탐 사유를 남긴다.':reason.name+' 기록을 원료 검수표와 대조하고 다음 생산 회차의 유온 추이를 확인한다.');break}
 case 'sample':{const m=Math.max(...db.rows.map(x=>x.order))+1;csv('생산기록_연습.csv',JK.csvRows([{...JK.seeds()[2],id:'SAMPLE-01',order:m}]));break}
 case 'import':modal('<h2>생산 기록 등록</h2><p>연습 CSV의 한글 열 이름을 사용하세요. 로트별로 0분부터 12분까지 한 줄씩 넣습니다.</p><form id="upload"><label>CSV 파일<input type="file" name="file" accept=".csv,text/csv" required></label><p id="error" role="status"></p><button>등록</button></form>');break;
 case 'export':if(!db.notes.length){say('먼저 점검 일지를 저장하세요.');break}csv('가공_점검일지.csv',[['생산 회차','저장 시각','검토 결과','조치 내용','검토 시점','후속 비교'],...db.notes.map(n=>[n.id,n.time,n.decision,n.note,n.pin?pinText(n.pin):'',n.follow])]);break;
 case 'data':modal('<h2>자료 관리</h2><p>이 브라우저에 생산 기록과 점검 일지를 보관합니다.</p><div class="tools"><button id="allcsv">생산 기록 CSV</button><button id="reset" class="outline">기본 자료 복원</button></div><div id="confirm"></div>');break;
 case 'allcsv':csv('생산기록.csv',JK.csvRows(db.rows));break;
 case 'reset':$('#confirm').innerHTML='<p class="hint">추가한 생산 기록, 담아 둔 시점과 일지를 지우고 기본 10회차로 돌아갑니다.</p><button id="resetYes">복원 확인</button>';break;
 case 'resetYes':db=initial();id='F-103';peer='';minute=2;$('#modal').close();render();save('기본 자료를 복원했습니다.');break;
 }
});
document.addEventListener('submit',async e=>{
 const f=e.target;if(!['rawForm','noteForm','upload'].includes(f.id))return;e.preventDefault();const el=f.elements,r=current();
 if(f.id==='upload'){try{const {added,duplicate}=JK.importRecords(await el.file.files[0].text(),db.rows);db.rows.push(...added);if(added.length){id=added[0].id;peer=''}$('#modal').close();render();save('신규 '+added.length+'회차, 중복 제외 '+duplicate+'회차')}catch(err){$('#error').textContent=err.message}return}
 if(f.id==='rawForm'){const fields=['grams','kg','brine','acid'];if(fields.some(k=>r[k]!==+el[k].value)){fields.forEach(k=>r[k]=+el[k].value);r.label=null}render();save('검수값을 저장했습니다.');return}
 const note=el.note.value.trim();if(!note){say('조치 내용을 입력하세요.');return}const follow=db.rows.find(x=>x.id===el.after.value);
 db.notes.push({id,time:new Date().toISOString(),pin:db.pins[id]?{...db.pins[id]}:null,follow:followText(r,follow),decision:el.decision.value,note});render();save('점검 일지에 저장했습니다.');
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
render();

