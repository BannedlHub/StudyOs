/*
 * Soru Arşivi ekranını içerir.
 * UI çekirdeği, durum ve depolama yardımcılarına dayanır.
 * ROUTES ve App eylemleri kullanır.
 */
"use strict";

/* ---------- 17) Bölüm: Soru Arşivi ---------- */
function questionStatusBadge(status){
  const cls=status==="Öğrendim"?"b-ok":status==="Tekrar çözeceğim"?"b-warn":"b-mut";
  return `<span class="badge ${cls}">${esc(status)}</span>`;
}
function releaseQuestionArchiveUrls(){
  UI.questionArchiveUrls.forEach(url=>URL.revokeObjectURL(url));
  UI.questionArchiveUrls=[];
}
function renderQuestionArchive(v){
  const topics=[...new Set(S.questionArchive.map(q=>q.topic).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"tr"));
  v.innerHTML=pageHead("Soru Arşivi","Çözemediğin soruları kaydet, tekrar çöz ve öğrendiklerini işaretle",
    `<button class="btn btn-primary" onclick="App.questionModal()"><i data-lucide="plus"></i>Soru ekle</button>`)+
    `<div class="card question-filters">
      ${fld("Ders",`<select aria-label="Ders filtresi" onchange="App.setQuestionFilter('subject',this.value)">
        <option value="all">Tüm dersler</option>${QUESTION_SUBJECTS.map(subject=>`<option value="${esc(subject)}" ${UI.questionSubject===subject?"selected":""}>${esc(subject)}</option>`).join("")}</select>`)}
      ${fld("Konu",`<select aria-label="Konu filtresi" onchange="App.setQuestionFilter('topic',this.value)">
        <option value="">Tüm konular</option>${topics.map(topic=>`<option value="${esc(topic)}" ${UI.questionTopic===topic?"selected":""}>${esc(topic)}</option>`).join("")}</select>`)}
      ${fld("Durum",`<select aria-label="Durum filtresi" onchange="App.setQuestionFilter('status',this.value)">
        <option value="all">Tüm durumlar</option>${QUESTION_STATUSES.map(status=>`<option value="${esc(status)}" ${UI.questionStatus===status?"selected":""}>${esc(status)}</option>`).join("")}</select>`)}
      ${fld("Konu ve notlarda ara",`<input type="search" value="${esc(UI.questionSearch)}" placeholder="Örn. türev, ipucu…" oninput="App.searchQuestions(this.value)" aria-label="Konu ve notlarda ara">`)}
    </div><div id="question-archive-list" aria-live="polite"></div>`;
  renderQuestionArchiveList();
}
function renderQuestionArchiveList(){
  releaseQuestionArchiveUrls();
  const request=++UI.questionArchiveRender,target=$("#question-archive-list");
  if(!target)return;
  const query=UI.questionSearch.trim().toLocaleLowerCase("tr-TR");
  const records=S.questionArchive.filter(question=>{
    if(UI.questionSubject!=="all"&&question.subject!==UI.questionSubject)return false;
    if(UI.questionTopic&&question.topic!==UI.questionTopic)return false;
    if(UI.questionStatus!=="all"&&question.status!==UI.questionStatus)return false;
    return !query||[question.topic,question.notes,question.solution].some(text=>
      String(text||"").toLocaleLowerCase("tr-TR").includes(query));
  }).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
  if(!records.length){
    target.innerHTML=`<div class="card empty question-empty"><i data-lucide="archive"></i>
      <b>${S.questionArchive.length?"Filtreye uygun soru yok":"Arşiv henüz boş"}</b>
      <p>${S.questionArchive.length?"Filtreleri değiştir veya başka bir kelime ara.":"Çözemediğin bir soruyu fotoğrafıyla ya da fotoğrafsız ekleyebilirsin."}</p>
    </div>`;
    lucide.createIcons();
    return;
  }
  target.innerHTML=`<div class="question-list">${records.map(question=>{
    const created=Number.isFinite(Date.parse(question.createdAt))?
      new Date(question.createdAt).toLocaleDateString("tr-TR"):"—";
    return `<article class="card question-card">
      <div class="question-card-head"><div class="row">
        <span class="badge b-info">${esc(question.subject)}</span>${questionStatusBadge(question.status)}
        <span class="small muted">${esc(created)}</span></div>
        <span class="small muted">${esc(question.reason)}</span></div>
      <div class="question-card-body">
        ${question.imageId?`<div class="question-photo" data-question-image="${esc(question.id)}"><span class="small muted">Fotoğraf yükleniyor…</span></div>`:""}
        <div class="question-copy"><h3>${esc(question.topic)}</h3>
          ${question.notes?`<div class="question-note"><span class="muted">Notum</span><p>${esc(question.notes)}</p></div>`:""}
          ${question.solution?`<div class="question-note"><span class="muted">Çözüm / ipucu</span><p>${esc(question.solution)}</p></div>`:""}
        </div>
      </div>
      <div class="question-actions">
        <button class="btn btn-sm" onclick="App.questionDetail('${esc(question.id)}')"><i data-lucide="eye"></i>Görüntüle</button>
        <button class="btn btn-sm" onclick="App.questionModal('${esc(question.id)}')"><i data-lucide="pencil"></i>Düzenle</button>
        ${question.status!=="Öğrendim"?`<button class="btn btn-sm btn-primary" onclick="App.markQuestionLearned('${esc(question.id)}')"><i data-lucide="check"></i>Öğrendim</button>`:""}
        <button class="btn btn-sm btn-ghost" onclick="App.deleteQuestion('${esc(question.id)}')" aria-label="Soruyu sil"><i data-lucide="trash-2"></i></button>
      </div>
    </article>`;
  }).join("")}</div>`;
  for(const question of records.filter(item=>item.imageId)){
    questionImageRequest("get",question.imageId).then(record=>{
      if(UI.route!=="question-archive"||request!==UI.questionArchiveRender)return;
      const image=target.querySelector(`[data-question-image="${question.id}"]`);
      if(!image)return;
      if(!record||!(record.blob instanceof Blob))throw new Error("Kaydedilmiş soru fotoğrafı bulunamadı.");
      const url=URL.createObjectURL(record.blob);
      UI.questionArchiveUrls.push(url);
      image.innerHTML=`<img src="${url}" alt="${esc(question.topic)} soru fotoğrafı" loading="lazy">`;
    }).catch(error=>{
      if(UI.route!=="question-archive"||request!==UI.questionArchiveRender)return;
      const image=target.querySelector(`[data-question-image="${question.id}"]`);
      if(image)image.textContent="Fotoğraf yüklenemedi";
      toast("Soru fotoğrafı yüklenemedi."+ (error?.message?" "+error.message:""),"err",6000);
    });
  }
  lucide.createIcons();
}
function loadQuestionModalImage(imageId,targetSelector){
  if(!imageId)return;
  const request=++UI.questionModalRequest;
  questionImageRequest("get",imageId).then(record=>{
    if(request!==UI.questionModalRequest)return;
    const target=$(targetSelector);
    if(!target)return;
    if(!record||!(record.blob instanceof Blob))throw new Error("Kaydedilmiş soru fotoğrafı bulunamadı.");
    UI.questionModalUrl=URL.createObjectURL(record.blob);
    target.innerHTML=`<img src="${UI.questionModalUrl}" alt="Soru fotoğrafı">`;
  }).catch(error=>{
    if(request!==UI.questionModalRequest)return;
    const target=$(targetSelector);
    if(target)target.textContent="Fotoğraf yüklenemedi.";
    toast("Soru fotoğrafı yüklenemedi."+ (error?.message?" "+error.message:""),"err",6000);
  });
}
