'use strict';
let onlyExceptions=true;
const attention=item=>['누락','검토 필요','재계량 요청'].includes(item.status);
function weighItems(){
  return Object.values(db.weighing??{}).filter(item=>item.product===current().product)
    .sort((a,b)=>Number(attention(b))-Number(attention(a))||a.id.localeCompare(b.id));
}
function loadWeighSheet(text,source,demo=false){
  const items=JK.readWeights(text,db.rows);
  db.weighing=Object.assign(Object.create(null),db.weighing);
  if(demo&&items.some(item=>db.weighing[item.id]&&!db.weighing[item.id].demo)){
    say('이 품목에는 등록한 계량표가 있습니다. 다른 품목에서 예시를 열어보세요.');
    return;
  }
  for(const item of items){
    const old=db.weighing[item.id];
    const same=old&&['count','total','kg'].every(k=>old[k]===item[k]);
    if(same&&['확인 반영','재계량 요청'].includes(old.status))item.status=old.status;
    if(['자동 반영','확인 반영'].includes(item.status))JK.applyWeights(db.rows.find(r=>r.id===item.id),item);
    db.weighing[item.id]={...item,source,demo};
  }
  const selected=items.find(item=>attention(item)&&item.product===current().product)
    ??items.find(attention)??items[0];
  id=selected.id;
  onlyExceptions=items.some(attention);
  render();
  save(items.length+'회차의 계량표를 대조했습니다.');
}
function weighDetails(item){
  if(!item)return '<p class="hint">계량표를 불러오면 이 회차의 측정 근거가 표시됩니다.</p>';
  const ref=JK.models[JK.products.indexOf(item.product)];
  const measure=(value,unit)=>value===null?'미기록':fmt(value)+' '+unit;
  return `<p class="sub">${h(item.source)}</p>
    <div class="weigh-reading"><span>평균 조각 무게</span><strong>${measure(item.grams,'g')}</strong>
    <small>시료 총중량 ${measure(item.total,'g')} ÷ 시료 수 ${measure(item.count,'개')}</small></div>
    <table><thead><tr><th>항목</th><th>이번 계량</th><th>참고 중앙값</th></tr></thead><tbody>
    <tr><td>조각 무게</td><td>${measure(item.grams,'g')}</td><td>${measure(ref[0].center,'g')}</td></tr>
    <tr><td>투입량</td><td>${measure(item.kg,'kg')}</td><td>${measure(ref[1].center,'kg')}</td></tr></tbody></table>
    <p class="evidence">${h(item.status)}${item.issues.length?' — '+h(item.issues.join(', ')):''}</p>
    <p class="hint">${attention(item)?'검토 중에는 기존 생산 기록의 측정값을 유지합니다.':'계량값을 같은 회차의 생산 기록에 반영했습니다.'}</p>
    ${attention(item)?`<div class="tools">${item.grams!==null&&item.kg!==null?'<button id="weighAccept">측정값 확인 반영</button>':''}${item.status!=='재계량 요청'?'<button id="weighHold" class="outline">재계량 요청</button>':''}</div>
    ${item.status==='누락'||item.status==='재계량 요청'?'<p class="hint">다시 측정한 계량표를 같은 로트로 불러오세요.</p>':''}` : ''}`;
}
function raw(){
  const rows=weighItems(),pending=rows.filter(attention),list=onlyExceptions?pending:rows;
  const selected=db.weighing?.[id];
  return `<section class="panel"><div class="spread"><div><h2>원료 계량표 대조</h2>
    <p class="sub">계량표 한 장으로 여러 회차의 무게와 투입량을 확인합니다.</p></div>
    <div class="tools weigh-actions"><button id="demoSheet">예시 계량표 불러오기</button><button id="openSheet" class="outline">내 CSV 불러오기</button></div></div></section>
    <div class="grid block"><section class="panel"><div class="spread"><h2>${h(current().product)} 검수 대기열</h2><small>등록 ${rows.length}회차</small></div>
    <div class="tools weigh-filter"><button data-weigh-filter="pending" aria-pressed="${onlyExceptions}">확인 필요 ${pending.length}</button>
    <button data-weigh-filter="all" aria-pressed="${!onlyExceptions}">전체 ${rows.length}</button></div>
    ${list.length?list.map(item=>`<button class="weigh-lot" data-weigh-lot="${h(item.id)}" aria-pressed="${item.id===id}">
    <b>${h(item.id)}</b><span>${h(item.issues.join(', ')||'참고 범위 이내')}</span><small>${h(item.status)}</small></button>`).join(''):
      `<div class="weigh-empty">${rows.length?'확인이 필요한 회차가 없습니다.':'예시 계량표를 불러와 첫 검수를 시작하세요.'}</div>`}
    <p class="hint">같은 품목의 참고 80회와 비교합니다. 범위 안의 값은 생산 기록에 바로 반영됩니다.</p></section>
    <section class="panel"><div class="spread"><h2>${h(id)} 계량 상세</h2></div>${weighDetails(selected)}</section></div>`;
}
function openSheet(){
  modal('<h2>계량표 불러오기</h2><p>생산 기록에 등록된 로트별로 한 줄씩 넣으세요. 여러 품목을 한 파일에 담을 수 있습니다. 누락된 측정값은 빈칸으로 두세요.</p><button class="outline" id="sheetTemplate">계량표 양식 받기</button><form id="weighUpload"><label>계량 CSV<input type="file" name="file" accept=".csv,text/csv" required></label><p id="sheetError" role="status"></p><button>불러와 대조하기</button></form>');
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');
  if(!b)return;
  const group=()=>db.rows.filter(r=>r.product===current().product);
  if(b.id==='demoSheet'){
    const matrix=JK.weighSample(group());
    loadWeighSheet(matrix.map(row=>row.join(',')).join('\n'),'예시 계량표',true);
  }
  if(b.id==='sheetTemplate')csv('원료_계량표.csv',JK.weighSample(group()));
  if(b.id==='openSheet')openSheet();
  if(b.dataset.weighFilter){onlyExceptions=b.dataset.weighFilter==='pending';render()}
  if(b.dataset.weighLot){id=b.dataset.weighLot;render()}
  if(b.id==='weighAccept'||b.id==='weighHold'){
    const item=db.weighing[id];
    if(b.id==='weighAccept'){JK.applyWeights(current(),item);item.status='확인 반영'}
    else item.status='재계량 요청';
    render();
    save(id+' '+item.status);
  }
});
document.addEventListener('submit',async e=>{
  if(e.target.id!=='weighUpload')return;
  e.preventDefault();
  const file=e.target.elements.file.files[0];
  try{
    loadWeighSheet(await file.text(),file.name);
    $('#modal').close();
  }catch(error){$('#sheetError').textContent=error.message}
});
