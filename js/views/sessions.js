/*
 * Çalışma Oturumları ekranı ve kronometreyi içerir.
 * UI çekirdeği ve türetimlere dayanır.
 * ROUTES üzerinden çağrılır.
 */
"use strict";

/* ---------- 14) Bölüm: Çalışma Oturumları ---------- */
function renderSessions(v){
  const list=[...S.sessions].sort((a,b)=>b.startedAt<a.startedAt?-1:1).slice(0,60);
  const week=weekSummary();
  v.innerHTML=pageHead("Çalışma Oturumları","Zaman damgası tabanlı kronometre; sayfa yenilense bile oturum kaybolmaz",
    `<button class="btn" onclick="App.manualSessionModal()"><i data-lucide="keyboard"></i>Elle giriş</button>
     <button class="btn btn-primary" onclick="App.startSessionModal()"><i data-lucide="play"></i>Oturum başlat</button>`)+
  `<div class="card" style="margin-bottom:16px"><div class="row">
    <i data-lucide="activity" style="color:var(--accent)"></i>
    <span>Bu hafta: <b>${fmtDur(week.totalMin)}</b> gerçek çalışma · ${week.n} oturum</span>
    ${week.hasDemo?'<span class="badge b-demo">DEMO oturumları dahil</span>':""}
    <span class="small muted" style="margin-left:auto">Süre, duraklatmalar hariç geçen süredir.</span></div></div>
  <div class="card">
    ${list.length? list.map(s=>{
      const t=topicById(s.topicId);
      return `<div class="sess-row">
        <span class="badge ${s.demo?"b-demo":"b-mut"}">${s.demo?"DEMO":esc(SESSION_TYPES[s.type]||s.type)}</span>
        <div style="flex:1;min-width:170px"><b style="font-weight:500">${esc(subjName(s.subjectId)||"—")}${t?" · "+esc(t.title):""}</b>
          <div class="small muted">${fmtShort(dayKey(new Date(s.startedAt)))} · ${new Date(s.startedAt).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"})}–${s.endedAt?new Date(s.endedAt).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"}):""}</div>
          ${s.notes?`<div class="small muted" style="margin-top:2px">“${esc(s.notes)}”</div>`:""}</div>
        <span class="mono-num" style="font-weight:600">${fmtDur(Math.round((s.elapsedMs||0)/60000))}</span>
        ${s.qAttempted?`<span class="badge b-info">${s.qCorrect}/${s.qAttempted} doğru · %${pct(s.qCorrect,s.qAttempted)}</span>`:""}
        <button class="btn btn-sm btn-ghost" onclick="App.deleteSession('${s.id}')" title="Kaydı sil"><i data-lucide="trash-2"></i></button>
      </div>`;}).join("") :
    `<div class="empty"><i data-lucide="timer"></i><b>Kayıtlı oturum yok</b><p>Kronometreyle ya da elle giriş yaparak ilk oturumunu kaydet. Yalnızca kaydedilen oturumlar istatistiklerde sayılır.</p></div>`}
  </div>`;
}
function renderLiveBar(){
  const old=$("#live-bar"); if(old)old.remove();
  const a=S.activeSession; if(!a)return;
  const paused=!!a.pausedAt;
  const bar=document.createElement("div"); bar.id="live-bar";
  bar.innerHTML=`<span class="pulse ${paused?"paused":""}"></span>
    <div style="min-width:130px"><b style="font-weight:600">${esc(subjName(a.subjectId)||"—")}</b>
    <div class="small muted">${esc(SESSION_TYPES[a.type]||"")}${a.topicId?" · "+esc(topicById(a.topicId)?.title||""):""}</div></div>
    <span id="live-timer">${fmtClock(activeElapsed())}</span>
    <button class="btn btn-sm" onclick="App.togglePause()"><i data-lucide="${paused?"play":"pause"}"></i>${paused?"Devam":"Duraklat"}</button>
    <button class="btn btn-sm btn-primary" onclick="App.finishSessionModal()"><i data-lucide="square"></i>Bitir</button>
    <button class="btn btn-sm btn-ghost" onclick="App.cancelActive()" title="Oturumu iptal et"><i data-lucide="x"></i></button>`;
  document.body.appendChild(bar); lucide.createIcons();
}
function activeElapsed(){ const a=S.activeSession; if(!a)return 0;
  return (a.accumulatedMs||0)+(a.pausedAt?0:Date.now()-(a.runningSince||a.startedAt)); }
setInterval(()=>{ const el=$("#live-timer"); if(el&&S.activeSession)el.textContent=fmtClock(activeElapsed()); },500);
