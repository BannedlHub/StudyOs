/*
 * Sınav Takvimi ekranını içerir.
 * UI çekirdeği ve türetimlere dayanır.
 * ROUTES üzerinden çağrılır.
 */
"use strict";

/* ---------- 13) Bölüm: Sınav Takvimi ---------- */
function renderExams(v){
  const now=todayKey();
  const up=S.exams.filter(e=>e.date>=now).sort((a,b)=>a.date<b.date?-1:1);
  const past=S.exams.filter(e=>e.date<now).sort((a,b)=>a.date<b.date?-1:1).slice(-5).reverse();
  const cal=renderCalendar();
  v.innerHTML=pageHead("Sınav Takvimi","Tarihler tamamen sana ait; geri sayımlar gerçek tarihlerden hesaplanır",
    `<button class="btn btn-primary" onclick="App.examModal()"><i data-lucide="calendar-plus"></i>Sınav ekle</button>`)+
  `<div class="dash"><div class="stack">
    <div class="card"><h3><i data-lucide="alarm-clock"></i>Yaklaşan sınavlar</h3>
    ${up.length? up.map(ex=>{
      const topicIds=examTopicIds(ex),inc=examIncomplete(ex);
      const dl=daysUntilExam(ex),tot=topicIds?topicIds.length:0,incCount=inc?inc.length:0,est=examEst(ex);
      const feas=dl>=0&&est!==null&&est>dl*S.settings.dailyTargetMin;
      return `<div class="exam-row">
        <div class="countdown" style="color:${dl<=S.settings.examWarnDays?"var(--danger)":"var(--text)"}">${dl}<small>${dl===1?"1 gün kaldı":dl===0?"bugün":"gün kaldı"}</small></div>
        <div style="flex:1;min-width:170px"><div class="row"><b>${esc(ex.title)}</b>${ex.importance===1?'<span class="badge b-danger">Yüksek öneme</span>':ex.importance===2?'<span class="badge b-warn">Orta öneme</span>':''}</div>
        <div class="small muted">${esc(subjName(ex.subjectId)||"—")} · ${fmtShort(ex.date)}${ex.time?" "+esc(ex.time):""}${ex.targetGrade?` · hedef ${esc(ex.targetGrade)}`:""}</div></div>
        <div class="small">${!topicIds?`<span class="badge b-danger">kapsam verisi geçersiz</span>`:tot?`<span class="badge ${incCount?"b-warn":"b-ok"}">${tot-incCount}/${tot} konu</span>`:`<span class="badge b-mut">kapsam yok</span>`}
        ${topicIds&&tot&&est?`<span class="badge ${feas?"b-danger":"b-info"}" title="Eksik konuların kalan tahmini">${feas?"Süre riskli":"tahmini "+fmtDur(est)}</span>`:""}</div>
        <button class="btn btn-sm" onclick="App.openExamDetail('${ex.id}')">Detay</button>
        <button class="btn btn-sm btn-ghost" onclick="App.examModal('${ex.id}')"><i data-lucide="pencil"></i></button>
        <button class="btn btn-sm btn-ghost" onclick="App.deleteExam('${ex.id}')"><i data-lucide="trash-2"></i></button>
      </div>`;}).join("") : `<div class="empty"><i data-lucide="calendar-x"></i><b>Yaklaşan sınav yok</b><p>Bir sınav ekle; kalan gün, eksik konu ve süre uygunluğu otomatik hesaplanır.</p></div>`}</div>
    ${past.length?`<div class="card"><h3><i data-lucide="history"></i>Geçmiş sınavlar</h3>${past.map(ex=>`<div class="sess-row"><span class="badge b-mut">Geçti</span><b style="font-weight:500">${esc(ex.title)}</b><span class="small muted">${esc(subjName(ex.subjectId)||"—")} · ${fmtShort(ex.date)}</span>
      <div class="acts" style="margin-left:auto"><button class="btn btn-sm btn-ghost" onclick="App.openExamDetail('${ex.id}')">Detay</button></div></div>`).join("")}</div>`:""}
  </div>
  <div class="stack"><div class="card"><h3><i data-lucide="calendar-days"></i>Takvim</h3>${cal}</div>
  <div class="card"><h3><i data-lucide="info"></i>Nasıl çalışır?</h3><p class="small muted" style="line-height:1.6">Sınav kapsamını sen belirlediğin için eksik konu sayısı yalnızca seçtiğin konulardan hesaplanır. "Süre riskli" etiketi, eksik konuların tahmini kalan süresinin kalan gün × günlük süre hedefini aşması durumunda görünür — bu bir tahmindir, garanti değildir.</p></div></div></div>`;
}
function renderCalendar(){
  const y=UI.calY,m=UI.calM;
  const first=new Date(y,m,1); const startDow=(first.getDay()-S.settings.weekStart+7)%7;
  const dim=new Date(y,m+1,0).getDate(); const prevDim=new Date(y,m,0).getDate();
  const monthName=first.toLocaleDateString("tr-TR",{month:"long",year:"numeric"});
  const head=[...Array(7)].map((_,i)=>DAY_SHORT[(i+S.settings.weekStart)%7]);
  let cells="";
  for(let i=0;i<42;i++){
    let dNum,out=false,dk;
    if(i<startDow){dNum=prevDim-startDow+1+i;out=true;dk=null;}
    else if(i-startDow+1>dim){dNum=i-startDow+1-dim;out=true;dk=null;}
    else{dNum=i-startDow+1;dk=dayKey(new Date(y,m,dNum));}
    const evs=dk?S.exams.filter(e=>e.date===dk):[];
    cells+=`<div class="cal-cell ${out?"out":""} ${dk===todayKey()?"today":""}">
      <span class="cdn">${dNum}</span>
      ${evs.map(e=>`<button class="cal-ev" onclick="App.openExamDetail('${e.id}')" title="${esc(e.title)}">${esc(subjName(e.subjectId)||"")}</button>`).join("")}
    </div>`;
  }
  return `<div class="spread" style="margin-bottom:10px">
    <button class="btn btn-sm btn-icon" onclick="App.calNav(-1)" aria-label="Önceki ay"><i data-lucide="chevron-left"></i></button>
    <b style="font-family:var(--font-head);text-transform:capitalize">${monthName}</b>
    <button class="btn btn-sm btn-icon" onclick="App.calNav(1)" aria-label="Sonraki ay"><i data-lucide="chevron-right"></i></button></div>
    <div class="cal-grid" style="margin-bottom:4px">${head.map(h=>`<div class="small faint" style="text-align:center;padding:3px 0">${h}</div>`).join("")}</div>
    <div class="cal-grid">${cells}</div>`;
}
function calNav(n){ UI.calM+=n; if(UI.calM<0){UI.calM=11;UI.calY--;} if(UI.calM>11){UI.calM=0;UI.calY++;} render(); }
