/*
 * Çalışma Planı ekranını içerir.
 * UI çekirdeği ve türetimlere dayanır.
 * ROUTES üzerinden çağrılır.
 */
"use strict";

/* ---------- 12) Bölüm: Çalışma Planı ---------- */
function renderPlanner(v){
  const ws=S.settings.weekStart;
  const base=parseDay(UI.plannerDate);
  const dow=(base.getDay()-ws+7)%7;
  const weekStartKey=addDaysKey(UI.plannerDate,-dow);
  const maxMin=S.settings.dailyMaxMin;
  const dayCol=key=>{
    const items=tasksForDay(key);
    const min=items.filter(x=>x.status==="planli").reduce((a,x)=>a+(x.estMinutes||0),0);
    const isRest=S.settings.restDays.includes(parseDay(key).getDay());
    const over=min>maxMin;
    return `<div class="pday ${key===todayKey()?"today":""}">
      <div class="pd-head"><span>${DAY_SHORT[parseDay(key).getDay()]}${isRest?" · dinlenme":""}</span><b>${parseDay(key).getDate()}</b></div>
      <div class="small" style="color:${over?"var(--danger)":"var(--faint)"}">${min?fmtDur(min):"—"}${over?" · sınır aşılıyor":""}</div>
      ${items.map(x=>`<button class="pmini ${x.status==="tamam"?"done":""}" onclick="App.taskModal('${x.id}')" title="Düzenle: ${esc(x.title)}">${esc(x.title)}</button>`).join("")}
      <button class="pmini" style="border-style:dashed;color:var(--muted);background:transparent" onclick="App.taskModal(null,'${key}')">+ görev</button>
    </div>`;};
  const week=[]; for(let i=0;i<7;i++)week.push(addDaysKey(weekStartKey,i));
  const uns=unscheduledTasks();
  const dayTasks= tasksForDay(UI.plannerDate);
  v.innerHTML=pageHead("Çalışma Planı","Haftalık veya günlük görünüm; görevleri taşı, ötele, tamamla",
    `<div class="seg"><button class="${UI.plannerView==="hafta"?"on":""}" onclick="UI.plannerView='hafta';render()">Hafta</button><button class="${UI.plannerView==="gun"?"on":""}" onclick="UI.plannerView='gun';render()">Gün</button></div>
     <button class="btn" onclick="App.taskModal()"><i data-lucide="plus"></i>Görev ekle</button>`)+
  `<div class="row" style="margin-bottom:14px">
    <button class="btn btn-sm btn-icon" onclick="App.shiftPlan(-7)" aria-label="Önceki hafta"><i data-lucide="chevron-left"></i></button>
    <input type="date" value="${UI.plannerDate}" onchange="UI.plannerDate=this.value||todayKey();render()" aria-label="Plan tarihi" style="width:auto">
    <button class="btn btn-sm btn-icon" onclick="App.shiftPlan(7)" aria-label="Sonraki hafta"><i data-lucide="chevron-right"></i></button>
    <button class="btn btn-sm btn-ghost" onclick="UI.plannerDate=todayKey();render()">Bugün</button>
  </div>
  ${UI.plannerView==="hafta"? `<div style="overflow-x:auto;padding-bottom:4px"><div class="planner" style="min-width:840px">${week.map(dayCol).join("")}</div></div>`:
  `<div class="dash"><div class="stack"><div class="card"><h3><i data-lucide="list-todo"></i>${fmtDay(UI.plannerDate,"uzun")} · ${dayTasks.filter(t=>t.status==="planli").reduce((a,x)=>a+(x.estMinutes||0),0)} dk planlı</h3>
    ${dayTasks.length?dayTasks.map(taskRow).join(""):`<div class="empty"><i data-lucide="coffee"></i><b>Bu gün boş</b><p>Dinlenme günü olarak bırakabilir ya da görev ekleyebilirsin.</p></div>`}</div></div>
    <div class="card"><h3><i data-lucide="inbox"></i>Planlanmamış görevler</h3>${unschedHtml(uns)}</div></div>`}
  ${UI.plannerView==="hafta"?`<div class="card" style="margin-top:16px"><h3><i data-lucide="inbox"></i>Planlanmamış görevler</h3>${unschedHtml(uns)}</div>`:""}`;
}
function unschedHtml(uns){
  return uns.length? uns.map(tk=>`<div class="task"><span class="badge b-warn">Tarihsiz</span>
    <div style="flex:1;min-width:150px"><div class="t-title">${esc(tk.title)}</div>
    <div class="small muted">${esc(subjName(tk.subjectId)||"Genel")} · ${fmtDur(tk.estMinutes||0)} · ${PRIOS[tk.priority].l} öncelik</div></div>
    <div class="acts"><button class="btn btn-sm" onclick="App.postponeTask('${tk.id}')"><i data-lucide="calendar-plus"></i>Tarihlendir</button>
    <button class="btn btn-sm btn-ghost" onclick="App.taskModal('${tk.id}')"><i data-lucide="pencil"></i></button>
    <button class="btn btn-sm btn-ghost" onclick="App.deleteTask('${tk.id}')"><i data-lucide="trash-2"></i></button></div></div>`).join("")
  :`<div class="empty" style="padding:16px"><p>Planlanmamış görev yok. Her şey yerli yerinde.</p></div>`;
}
function shiftPlan(n){ UI.plannerDate=addDaysKey(UI.plannerDate,n); render(); }
