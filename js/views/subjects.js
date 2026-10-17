/*
 * Dersler ve Konular ekranını içerir.
 * UI çekirdeği ve türetimlere dayanır.
 * ROUTES üzerinden çağrılır.
 */
"use strict";

/* ---------- 11) Bölüm: Dersler ve Konular ---------- */
function gotoSubject(id){ UI.topicSubj=id; UI.topicQ=""; setRoute("subjects"); }
function filteredTopics(){
  let list=S.topics.filter(t=>!t.parentId);
  if(UI.topicSubj!=="all")list=list.filter(t=>t.subjectId===UI.topicSubj);
  if(UI.topicStatus!=="all")list=list.filter(t=>t.status===UI.topicStatus);
  if(UI.topicQ){const q=UI.topicQ.toLowerCase();
    const matchAll=S.topics.filter(t=>(t.title+" "+(subjName(t.subjectId)||"")).toLowerCase().includes(q)).map(t=>t.id);
    list=list.filter(t=>matchAll.includes(t.id)||S.topics.some(x=>x.parentId===t.id&&matchAll.includes(x.id)));}
  const exBonus=t=>{const ex=S.exams.find(e=>{const ids=examTopicIds(e);return ids&&ids.includes(t.id);});return ex?daysUntilExam(ex):999;};
  const sorts={
    exam:(a,b)=>(a.examRelevance!==b.examRelevance?b.examRelevance-a.examRelevance:exBonus(a)-exBonus(b)),
    review:(a,b)=>((a.nextReviewAt||"9999")<(b.nextReviewAt||"9999")?-1:1),
    est:(a,b)=>(b.estMinutes||0)-(a.estMinutes||0),
    alpha:(a,b)=>a.title.localeCompare(b.title,"tr")};
  return list.sort(sorts[UI.topicSort]||sorts.exam);
}
function renderSubjects(v){
  const list=filteredTopics();
  const subjects=S.subjects.filter(s=>!s.archived);
  v.innerHTML=pageHead("Dersler ve Konular","Konu ekle, durumunu ve güvenini güncelle; tekrar tarihlerini planla",
    `<button class="btn" onclick="App.subjectModal()"><i data-lucide="plus"></i>Ders ekle</button><button class="btn btn-primary" onclick="App.topicModal()"><i data-lucide="book-plus"></i>Konu ekle</button>`)+
  `<div class="card" style="margin-bottom:16px">
    <div class="filters">
      <div class="row" style="flex:1;min-width:200px"><i data-lucide="search" style="color:var(--faint)"></i>
        <input id="topic-q" placeholder="Konu veya ders ara…" value="${esc(UI.topicQ)}" oninput="UI.topicQ=this.value;render()" style="border:none;background:transparent;padding:6px 2px" aria-label="Konu ara"></div>
      <select onchange="UI.topicSubj=this.value;render()" aria-label="Ders filtresi" style="width:auto">
        <option value="all">Tüm dersler</option>
        ${subjects.map(s=>`<option value="${s.id}" ${UI.topicSubj===s.id?"selected":""}>${esc(s.name)}</option>`).join("")}</select>
      <select onchange="UI.topicStatus=this.value;render()" aria-label="Durum filtresi" style="width:auto">
        <option value="all">Tüm durumlar</option>
        ${Object.entries(TOPIC_STATUS).map(([k,l])=>`<option value="${k}" ${UI.topicStatus===k?"selected":""}>${l}</option>`).join("")}</select>
      <select onchange="UI.topicSort=this.value;render()" aria-label="Sıralama" style="width:auto">
        <option value="exam" ${UI.topicSort==="exam"?"selected":""}>Sınav önemine göre</option>
        <option value="review" ${UI.topicSort==="review"?"selected":""}>Tekrar tarihine göre</option>
        <option value="est" ${UI.topicSort==="est"?"selected":""}>Kalan süreye göre</option>
        <option value="alpha" ${UI.topicSort==="alpha"?"selected":""}>A→Z</option></select>
    </div>
    ${UI.topicSel.size?`<div class="row" style="margin-top:10px"><span class="small muted">${UI.topicSel.size} konu seçildi</span>
      <select id="bulk-st" style="width:auto" aria-label="Toplu durum"><option value="">Durumu değiştir…</option>${Object.entries(TOPIC_STATUS).map(([k,l])=>`<option value="${k}">${l}</option>`).join("")}</select>
      <button class="btn btn-sm" onclick="App.bulkStatus()">Uygula</button>
      <button class="btn btn-sm btn-ghost" onclick="UI.topicSel.clear();render()">Seçimi bırak</button></div>`:""}
  </div>
  <div class="card">
    ${list.length? list.map(t=>{
      const subs=S.topics.filter(x=>x.parentId===t.id);
      const p=topicPrep(t);
      return `<div class="topic-row">
        <input type="checkbox" ${UI.topicSel.has(t.id)?"checked":""} onchange="App.selTopic('${t.id}')" aria-label="Konuyu seç" style="width:15px;height:15px">
        <button class="chk ${t.status==="ogrenildi"?"on":""}" style="cursor:default" title="${TOPIC_STATUS[t.status]}" onclick="App.topicDetail('${t.id}')"><i data-lucide="check"></i></button>
        <div style="flex:1;min-width:180px;cursor:pointer" onclick="App.topicDetail('${t.id}')">
          <div class="row"><span class="top-title">${esc(t.title)}</span>
            ${t.examRelevance===3?'<span class="badge b-danger">Sınav için kritik</span>':t.examRelevance===2?'<span class="badge b-warn">Sınavda çıkabilir</span>':""}
            ${t.nextReviewAt&&t.nextReviewAt<=todayKey()?'<span class="badge b-warn">Tekrarı gecikmiş</span>':""}</div>
          <div class="small muted">${esc(subjName(t.subjectId)||"—")} · kalan tahmin ${fmtDur(t.estMinutes||60)} · son çalışma ${t.lastStudiedAt?relDays(daysBetween(t.lastStudiedAt,todayKey())):"yok"}</div>
          ${subs.length?`<div class="subtopics">${subs.map(s=>`<div class="small row" style="padding:3px 0"><i data-lucide="corner-down-right" style="width:12px;height:12px;color:var(--faint)"></i><span style="cursor:pointer" onclick="App.topicDetail('${s.id}');event.stopPropagation()">${esc(s.title)}</span> ${statusBadge(s.status)}</div>`).join("")}</div>`:""}
        </div>
        <span class="conf-stars" title="Öz-güven: ${t.confidence}/5">${[1,2,3,4,5].map(i=>`<i data-lucide="star" style="color:${i<=t.confidence?"var(--warn)":"var(--border2)"};fill:${i<=t.confidityCouldFix}",opacity:${i<=(t.confidence||1)?1:.35}"></i>`).join("")}</span>
        ${statusBadge(t.status)}
        <button class="btn btn-sm btn-ghost" onclick="App.topicModal(null,'${t.subjectId}','${t.id}')" title="Alt konu ekle"><i data-lucide="git-branch"></i></button>
        <button class="btn btn-sm btn-ghost" onclick="App.topicModal('${t.id}')" title="Düzenle"><i data-lucide="pencil"></i></button>
      </div>`;}).join("") :
    `<div class="empty"><i data-lucide="book-open"></i><b>Konu bulunamadı</b><p>${S.topics.length?"Filtreleri değiştirmeyi dene ya da yeni bir konu ekle.":"İlk konunu ekleyerek başla; ister alt konularla böl."}</p></div>`}
  </div>`;
}
