/*
 * Ders, konu, sınav, tekrar ve oturum türetimlerini hesaplar.
 * helpers.js ve state.js dosyalarına dayanır.
 * Öneri motoru ve görünümler kullanır.
 */
"use strict";

/* ---------- 6) Türetiler (hesaplamalar) ---------- */
const subjectById=id=>S.subjects.find(x=>x.id===id);
const topicById=id=>S.topics.find(x=>x.id===id);
const examById=id=>S.exams.find(x=>x.id===id);
const subjName=id=>{const s=subjectById(id);return s?s.name:null;};
function sessionsOfSubject(sid){return S.sessions.filter(x=>x.subjectId===sid);}
function subjectStats(sid){
  const topics=S.topics.filter(t=>t.subjectId===sid);
  const done=topics.filter(t=>t.status==="ogrenildi").length;
  const sess=sessionsOfSubject(sid);
  const totalMin=Math.round(sess.reduce((a,s)=>a+(s.elapsedMs||0),0)/60000);
  const qa=sess.reduce((a,s)=>a+(s.qAttempted||0),0), qc=sess.reduce((a,s)=>a+(s.qCorrect||0),0);
  const lastSess=sess.length?sess.reduce((a,s)=>s.startedAt>a.startedAt?s:a):null;
  const lastDay=lastSess?dayKey(new Date(lastSess.startedAt)):null;
  const ex=S.exams.filter(e=>e.subjectId===sid&&e.date>=todayKey()).sort((a,b)=>a.date<b.date?-1:1)[0]||null;
  return{topics,done,totalMin,qa,qc,lastDay,accuracy:pct(qc,qa),nextExam:ex};
}
function topicPrep(t){ // Açıklanabilir tahmin: durum %40, öz-güven %30, doğruluk %30 (veri yoksa yeniden dağıtılır)
  const sw={baslanmadi:0,calisiliyor:.45,tekrar:.6,ogrenildi:.95}[t.status]||0;
  const cf=(clampNum(t.confidence,1,5)-1)/4;
  const topicSessions=S.sessions.filter(s=>s.topicId===t.id);
  const qa=(t.qAttempted||0)+topicSessions.reduce((a,s)=>a+(s.qAttempted||0),0);
  const qc=(t.qCorrect||0)+topicSessions.reduce((a,s)=>a+(s.qCorrect||0),0);
  const acc=qa>0?qc/qa:null;
  const score= acc==null? sw*.55+cf*.45 : sw*.4+cf*.3+acc*.3;
  return{score:Math.round(score*100),qa,qc,acc};
}
const clampNum=(v,a,b)=>Math.min(b,Math.max(a,Number(v)||a));
function examTopicIds(ex){
  if(Array.isArray(ex.topicIds))return ex.topicIds;
  return ex.topicIds==null?[]:null;
}
function examPrep(ex){
  const topicIds=examTopicIds(ex);
  if(!topicIds)return null;
  const ts=topicIds.map(topicById).filter(Boolean);
  if(!ts.length)return null;
  return Math.round(ts.reduce((a,t)=>a+topicPrep(t).score,0)/ts.length);
}
function examIncomplete(ex){
  const topicIds=examTopicIds(ex);
  return topicIds?topicIds.map(topicById).filter(t=>t&&t.status!=="ogrenildi"):null;
}
function examEstimate(ex){ // Kapsamdaki eksik konuların kalan tahmini (dakika)
  const inc=examIncomplete(ex);
  if(!inc)return null;
  if(!inc.length)return 0;
  return inc.reduce((a,t)=>a+(Number(t.estMinutes)||60),0);
}
function examEst(ex){ return examEstimate(ex); }
function daysUntilExam(ex){ return daysBetween(todayKey(),ex.date); }
function dueReviews(){ return S.topics.filter(t=>t.nextReviewAt&&t.nextReviewAt<=todayKey()&&t.status!=="ogrenildi")
  .sort((a,b)=>a.nextReviewAt<b.nextReviewAt?-1:1); }
function upcomingReviews(){ return S.topics.filter(t=>t.nextReviewAt&&t.nextReviewAt>todayKey()&&t.nextReviewAt<=addDaysKey(todayKey(),7)); }
function strugglingTopics(){ // Son tekrarlarda üst üste zorlanan konular
  return S.topics.filter(t=>{ const log=S.reviewLog.filter(r=>r.topicId===t.id).slice(-3);
    return log.length>=2&&log.filter(r=>r.feedback!=="kolay").length>=2; });
}
function tasksForDay(key){ return S.tasks.filter(x=>x.date===key&&x.status!=="iptal").sort((a,b)=>a.priority-b.priority); }
function unscheduledTasks(){ return S.tasks.filter(x=>!x.date&&x.status!=="iptal").sort((a,b)=>a.priority-b.priority); }
function anaRangeStart(){
  if(UI.anaRange==="7")return addDaysKey(todayKey(),-6);
  if(UI.anaRange==="30")return addDaysKey(todayKey(),-29);
  if(UI.anaRange==="all")return "0000-01-01";
  return UI.anaFrom;
}
function sessionsInRange(){ const a=anaRangeStart(),b=UI.anaRange==="custom"?UI.anaTo:todayKey();
  return S.sessions.filter(s=>{
    // Gece yarısını aşan oturum, yerel başlangıç gününe aittir.
    const k=dayKey(new Date(s.startedAt));return k>=a&&k<=b;
  }); }
