/*
 * Genel Bakış ekranını ve yardımcılarını içerir.
 * UI çekirdeği, türetimler ve öneri motoruna dayanır.
 * ROUTES üzerinden çağrılır.
 */
"use strict";

/* ---------- 10) Bölüm: Genel Bakış ---------- */
function greeting(){ const h=new Date().getHours();
  const g=h<6?"İyi geceler":h<12?"Günaydın":h<18?"İyi günler":"İyi akşamlar";
  return S.settings.name?`${g}, ${S.settings.name}`:g; }
function renderOverview(v){
  const t=todayKey();
  const exams=S.exams.filter(e=>e.date>=t).sort((a,b)=>a.date<b.date?-1:1);
  const today=tasksForDay(t);
  const planMin=today.filter(x=>x.status==="planli").reduce((a,x)=>a+(x.estMinutes||0),0);
  const wk=weekSummary();
  const recos=Recommendations.generate();
  const due=dueReviews();
  const overLimit=planMin>S.settings.dailyMaxMin;

  const examList= exams.length? exams.slice(0,4).map(ex=>{
    const topicIds=examTopicIds(ex),inc=examIncomplete(ex);
    const dl=daysUntilExam(ex),tot=topicIds?topicIds.length:0,incCount=inc?inc.length:0;
    const urgent=dl<=S.settings.examWarnDays&&dl>=0;
    return `<div class="exam-row">
      <div class="countdown" style="color:${urgent?"var(--danger)":"var(--text)"}">${dl===0?"Bugün":dl}<small>${dl===0?"sınav günü":dl===1?"1 gün kaldı":"gün kaldı"}</small></div>
      <div style="min-width:170px;flex:1">
        <div class="row"><b style="font-weight:600">${esc(ex.title)}</b>${urgent?'<span class="badge b-danger">Yakın</span>':""}</div>
        <div class="small muted">${esc(subjName(ex.subjectId)||"—")} · ${fmtShort(ex.date)}${ex.time?" · "+esc(ex.time):""} · ${ex.importance===1?'<span style="color:var(--danger)">Yüksek öneme</span>':"önemli"}</div>
      </div>
      <div class="small">${!topicIds?`<span class="badge b-danger">Kapsam verisi geçersiz</span>`:tot?`<span class="badge ${incCount?"b-warn":"b-ok"}">${tot-incCount}/${tot} konu hazır</span>`:`<span class="badge b-mut">Kapsam belirtilmemiş</span>`}</div>
      <button class="btn btn-sm" onclick="App.openExamDetail('${ex.id}')">Detay <i data-lucide="arrow-right"></i></button>
    </div>`;}).join("") :
    `<div class="empty"><i data-lucide="calendar-x"></i><b>Yaklaşan sınav yok</b><p>Sınav Takvimi bölümünden ekleyebilirsin. Geri sayımlar burada listelenir.</p></div>`;

  const taskList= today.length? today.map(taskRow).join("") :
    `<div class="empty"><i data-lucide="clipboard-check"></i><b>Bugün için görev yok</b><p>Planlanmamış görevleri bugüne alabilir ya da yeni bir görev ekleyebilirsin.</p></div>`;

  const subjList= S.subjects.filter(s=>!s.archived).length? S.subjects.filter(s=>!s.archived).map(s=>{
    const st=subjectStats(s.id); const p=st.topics.length?Math.round(st.done/st.topics.length*100):0;
    const lastTxt=st.lastDay?relDays(daysBetween(st.lastDay,t)):"hiç";
    return `<div class="subj-row">
      <span class="color-dot" style="background:${s.color}"></span>
      <span class="subj-name" style="min-width:110px">${esc(s.name)}</span>
      <span class="subj-meta">
        ${st.nextExam?`<span>Sınav: <b>${fmtShort(st.nextExam.date)}</b> · <b>${daysUntilExam(st.nextExam)} gün</b></span>`:""}
        <span>Konu: <b>${st.topics.length-st.done}/${st.topics.length}</b> eksik</span>
        <span>Süre: <b>${st.totalMin?fmtDur(st.totalMin):"—"}</b></span>
        ${st.qa>0?`<span>Doğruluk: <b>%${st.accuracy}</b> (${st.qa} soru)</span>`:""}
        <span>Son: <b>${lastTxt}</b></span>
      </span>
      <span class="sbar" title="Konu durumu: öğrenilen / toplam"><span style="width:${p}%;background:${s.color}"></span></span>
      <button class="btn btn-sm btn-ghost" onclick="App.gotoSubject('${s.id}')">Konular <i data-lucide="chevron-right"></i></button>
    </div>`;}).join("") :
    `<div class="empty"><i data-lucide="library"></i><b>Henüz ders eklenmemiş</b><p>Dersler ve Konular bölümünden derslerini ekleyerek başla.</p></div>`;

  v.innerHTML=`
  <div class="page-head">
    <div><h1>${esc(greeting())}</h1><div class="sub">${fmtDay(t,S.settings.dateStyle)} · ${today.length?`bugün ${today.length} görev, tahmini ${fmtDur(planMin)}`:"bugün planlı görev yok"}${overLimit?` · <span style="color:var(--danger)">günlük sınır aşıyor</span>`:""}</div></div>
    <div class="head-actions">
      <button class="btn btn-primary" onclick="App.startSessionModal()"><i data-lucide="play"></i>Oturum başlat</button>
      <button class="btn" onclick="App.taskModal(null,'${t}')"><i data-lucide="plus"></i>Görev ekle</button>
    </div>
  </div>
  ${S.settings.demoActive?`<div class="card" style="margin-bottom:16px;padding:11px 16px;border-style:dashed"><div class="row small"><span class="badge b-demo">DEMO VERİSİ</span><span class="muted">Uygulama örnek kayıtlarla başladı; bunlar gerçek ilerlemen değil. Ayarlar → Veri Yönetimi'nden temizleyebilirsin.</span></div></div>`:""}
  <div class="dash">
    <div class="stack">
      <div class="card"><h3><i data-lucide="alarm-clock"></i>Yaklaşan sınavlar</h3>${examList}
        <div style="margin-top:10px"><button class="btn btn-sm btn-ghost" onclick="setRoute('exams')">Tüm sınavlar <i data-lucide="arrow-right"></i></button></div></div>
      <div class="card"><h3><i data-lucide="list-todo"></i>Bugünün planı ${today.length?`<span class="badge b-mut">${fmtDur(planMin)} tahmini</span>`:""}</h3>
        ${taskList}
        <div class="row" style="margin-top:10px">
          <button class="btn btn-sm" onclick="App.taskModal(null,'${t}')"><i data-lucide="plus"></i>Bugüne görev ekle</button>
          <button class="btn btn-sm btn-ghost" onclick="setRoute('planner')">Planı aç</button>
        </div></div>
      <div class="card"><h3><i data-lucide="library"></i>Derslerin durumu
        <span class="small muted" style="margin-left:auto;font-weight:400">Konu durumları, süre ve doğruluk gerçek kayıtlardan</span></h3>${subjList}</div>
    </div>
    <div class="stack">
      <div class="card"><h3><i data-lucide="lightbulb"></i>Şu an önerilen</h3>
        ${recos.length?recos.map(r=>`<div class="reco"><i data-lucide="${r.icon}" style="${r.danger?"color:var(--warn)":""}"></i><div class="rt">${esc(r.text)}${r.act?` <button class="btn btn-sm btn-ghost" style="padding:2px 8px" onclick="setRoute('${r.act.route}')">${esc(r.act.label)} →</button>`:""}</div></div>`).join(""):`<div class="empty" style="padding:14px"><p>Şu an için özel bir öneri yok.</p></div>`}
      </div>
      <div class="card"><h3><i data-lucide="zap"></i>Hızlı işlemler</h3>
        <div class="qa-grid">
          <button class="qa" onclick="App.taskModal()"><i data-lucide="plus"></i>Görev ekle</button>
          <button class="qa" onclick="App.topicModal()"><i data-lucide="book-plus"></i>Konu ekle</button>
          <button class="qa" onclick="App.examModal()"><i data-lucide="calendar-plus"></i>Sınav ekle</button>
          <button class="qa" onclick="App.startSessionModal()"><i data-lucide="play"></i>Oturum başlat</button>
          <button class="qa" onclick="App.logQuestionsModal()"><i data-lucide="target"></i>Soru kaydet</button>
          <button class="qa" onclick="setRoute('review')"><i data-lucide="rotate-ccw"></i>Tekrarlar${due.length?` (${due.length})`:""}</button>
        </div></div>
      <div class="card"><h3><i data-lucide="activity"></i>Son 7 gün</h3>
        <div class="stat-line"><span class="muted">Gerçek çalışma süresi</span><span class="v mono-num">${fmtDur(wk.totalMin)}</span></div>
        <div class="stat-line"><span class="muted">Tamamlanan oturum</span><span class="v mono-num">${wk.n}</span></div>
        <div class="stat-line"><span class="muted">Sorular (doğru / deneme)</span><span class="v mono-num">${wk.qc} / ${wk.qa}${wk.qa?` · %${pct(wk.qc,wk.qa)}`:""}</span></div>
        <div class="stat-line"><span class="muted">Görevler (tamam / planlı)</span><span class="v mono-num">${wk.doneTasks} / ${wk.totTasks}</span></div>
        <div class="stat-line" style="border:none;flex-direction:column;align-items:stretch;gap:0"><span class="muted" style="margin-bottom:2px">Çalışma tutarlılığı (7 günde ${wk.activeDays} gün)</span>
          <div class="wk-dots">${wk.days.map(d=>`<div class="wk-day"><div class="wk-bar${d.min?"":" zero"}" style="${d.min?`height:${Math.max(10,d.min/wk.maxMin*30)}px`:""}" title="${d.label}: ${d.min?fmtDur(d.min):"oturum yok"}"></div><span class="wk-lab">${d.s}</span></div>`).join("")}</div>
          <span class="help">Tutarlılık yalnızca kayıtlı oturum olan günleri sayar; öğrenme ölçüsü değildir.</span>
        </div>
        ${wk.hasDemo?`<span class="badge b-demo" style="margin-top:8px">DEMO oturumları dahil</span>`:""}
      </div>
    </div>
  </div>`;
}
function weekSummary(){
  const t=todayKey(); const from=addDaysKey(t,-6);
  const sess=S.sessions.filter(s=>{const k=dayKey(new Date(s.startedAt));return k>=from&&k<=t;});
  const days=[]; for(let i=6;i>=0;i--){const k=addDaysKey(t,-i);
    days.push({key:k,s:DAY_SHORT[parseDay(k).getDay()],label:fmtShort(k),min:Math.round(sess.filter(x=>dayKey(new Date(x.startedAt))===k).reduce((a,x)=>a+x.elapsedMs,0)/60000)});}
  const tasks=S.tasks.filter(x=>x.date>=from&&x.date<=t&&x.status!=="iptal");
  return{ totalMin:Math.round(sess.reduce((a,s)=>a+s.elapsedMs,0)/60000), n:sess.length,
    qa:sess.reduce((a,s)=>a+(s.qAttempted||0),0), qc:sess.reduce((a,s)=>a+(s.qCorrect||0),0),
    totTasks:tasks.length, doneTasks:tasks.filter(x=>x.status==="tamam").length,
    days, activeDays:days.filter(d=>d.min>0).length, maxMin:Math.max(30,...days.map(d=>d.min)),
    hasDemo:sess.some(s=>s.demo)};
}
function taskRow(tk){
  const t=topicById(tk.topicId);
  return `<div class="task ${tk.status==="tamam"?"done":""}">
    <button class="chk ${tk.status==="tamam"?"on":""}" onclick="App.toggleTask('${tk.id}')" aria-label="Görevi tamamlandı olarak işaretle"><i data-lucide="check"></i></button>
    ${prioDot(tk.priority)}
    <div style="min-width:150px;flex:1">
      <div class="t-title">${esc(tk.title)}</div>
      <div class="small muted">${esc(subjName(tk.subjectId)||"Genel")}${t?" · "+esc(t.title):""} · ${fmtDur(tk.estMinutes||0)} · ${esc(SESSION_TYPES[tk.type]||"Görev")}</div>
    </div>
    <div class="acts">
      ${tk.status==="tamam"?`<button class="btn btn-sm btn-ghost" onclick="App.toggleTask('${tk.id}')" title="Geri al"><i data-lucide="undo-2"></i></button>`:
      `<button class="btn btn-sm" onclick="App.startSessionForTask('${tk.id}')" title="Oturum başlat"><i data-lucide="play"></i></button>
       <button class="btn btn-sm btn-ghost" onclick="App.postponeTask('${tk.id}')" title="Ertele"><i data-lucide="calendar-clock"></i></button>`}
      <button class="btn btn-sm btn-ghost" onclick="App.taskModal('${tk.id}')" title="Düzenle"><i data-lucide="pencil"></i></button>
      <button class="btn btn-sm btn-ghost" onclick="App.deleteTask('${tk.id}')" title="Sil"><i data-lucide="trash-2"></i></button>
    </div></div>`;
}
