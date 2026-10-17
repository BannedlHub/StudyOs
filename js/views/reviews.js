/*
 * Tekrar Merkezi ekranını içerir.
 * UI çekirdeği ve türetimlere dayanır.
 * ROUTES üzerinden çağrılır.
 */
"use strict";

/* ---------- 16) Bölüm: Tekrar Merkezi ---------- */
function renderReview(v){
  const due=dueReviews(),up=upcomingReviews(),strug=strugglingTopics();
  const revItem=(topic,late)=>{
    const overdue=topic.nextReviewAt<todayKey();
    return `<div class="rev-item">
      <span class="color-dot" style="background:${subjectById(topic.subjectId)?.color||"var(--faint)"}"></span>
      <div style="flex:1;min-width:160px"><b style="font-weight:500">${esc(topic.title)}</b>
        <div class="small muted">${esc(subjName(topic.subjectId)||"—")} · ${overdue?`<span style="color:var(--warn)">${daysBetween(topic.nextReviewAt,todayKey())} gün gecikmiş`:"bugün tekrar zamanı"}</div></div>
      ${statusBadge(topic.status)}
      <button class="btn btn-sm btn-primary" onclick="App.reviewModal('${topic.id}')"><i data-lucide="check"></i>Tekrarı yap</button>
      <button class="btn btn-sm btn-ghost" onclick="App.rescheduleReview('${topic.id}')" title="Tarihi değiştir"><i data-lucide="calendar-clock"></i></button>
    </div>`;};
  v.innerHTML=pageHead("Tekrar Merkezi","Hatırlama pratiği: notları açmadan önce hatırlamayı dene, sonra kendini test et",
    `<button class="btn" onclick="App.schedulePickModal()"><i data-lucide="calendar-plus"></i>Tekrar planla</button>`)+
  `<div class="dash"><div class="stack">
    <div class="card"><h3><i data-lucide="bell-ring"></i>Bugün ve gecikmiş tekrarlar</h3>
      ${due.length?due.map(tp=>revItem(tp,true)).join(""):`<div class="empty" style="padding:16px"><i data-lucide="check-circle-2"></i><p>Şu an bekleyen tekrar yok. Ara vermek de planın bir parçası.</p></div>`}</div>
    <div class="card"><h3><i data-lucide="flame"></i>Zorlandığın konular</h3>
      ${strug.length?strug.map(tp=>`<div class="rev-item"><span class="badge b-warn">Üst üste zor</span>
        <div style="flex:1"><b style="font-weight:500">${esc(tp.title)}</b><div class="small muted">${esc(subjName(tp.subjectId)||"—")} · son tekrarlarda "zordu/hatırlayamadım" işaretlendi</div></div>
        <button class="btn btn-sm" onclick="App.topicDetail('${tp.id}')">Konuyu aç</button></div>`).join("")
      :`<div class="empty" style="padding:16px"><p>Tekrarlarında zorlandığın olarak işaretlenen konu yok.</p></div>`}
      <div class="help">Bu liste yalnızca geri bildirimlerinden üretilir; uygulama neyi bildiğini doğrudan ölçemez.</div></div>
    <div class="card"><h3><i data-lucide="history"></i>Son tekrar kayıtları</h3>
      ${S.reviewLog.length?[...S.reviewLog].reverse().slice(0,8).map(r=>`<div class="sess-row">
        <span class="badge ${r.feedback==="kolay"?"b-ok":r.feedback==="zor"?"b-warn":"b-danger"}">${FEEDBACK[r.feedback]}</span>
        <span style="font-weight:500">${esc(topicById(r.topicId)?.title||"Silinmiş konu")}</span>
        <span class="small muted">${fmtShort(r.date)}</span></div>`).join(""):`<div class="empty" style="padding:16px"><p>Henüz tekrar kaydı yok.</p></div>`}</div>
  </div>
  <div class="stack">
    <div class="card"><h3><i data-lucide="calendar-check"></i>Yaklaşan tekrarlar (7 gün)</h3>
      ${up.length?up.map(tp=>`<div class="sess-row"><span class="badge b-info">${daysBetween(todayKey(),tp.nextReviewAt)} gün sonra</span>
        <span style="font-weight:500">${esc(tp.title)}</span><span class="small muted">${esc(subjName(tp.subjectId)||"—")}</span></div>`).join("")
      :`<div class="empty" style="padding:16px"><p>Önümüzdeki 7 günde planlı tekrar yok.</p></div>`}</div>
    <div class="card"><h3><i data-lucide="lightbulb"></i>Hatırlama pratiği ipuçları</h3>
      <ul class="small muted" style="line-height:1.7;padding-left:16px">
        <li>Notları açmadan önce konuyu <b>sessizce anlatmayı dene</b> — eksikler hemen görünür.</li>
        <li>Soruları çözümlere bakmadan çöz; yanlışları biriktirip <b>ayrı bir turda</b> tekrar ele al.</li>
        <li>Tekrardan sonra güven puanını yeniden değerlendir; test edilmeden yükseltme.</li>
      </ul>
      <div class="help">Aralık önerileri (1/3/7/14 gün) yaygın hatırlama pratiğinden esinlenen pratik değerlerdir; bilimsel garanti değildir, dilediğin gibi değiştirebilirsin.</div></div>
  </div></div>`;
}
