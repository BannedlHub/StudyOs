/*
 * Kural tabanlı öneri motorunu içerir.
 * derived.js ve state.js dosyalarına dayanır.
 * Genel Bakış görünümü önerileri kullanır.
 */
"use strict";

/* ---------- 7) Öneri motoru (kural tabanlı, veriye dayalı) ---------- */
/* Arayüz notu: Recommendations.generate(state) saf bir fonksiyondur; ileride isteğe bağlı bir
   sağlayıcı (plan rafine etme, hata açıklama vb.) aynı imzayla beslenebilir. Sağlayıcı yoksa
   uygulama bu kural tabanlı motorla eksiksiz çalışır. Hiçbir metin uydurma veriye dayanmaz. */
/* Her kuralı mevcut sınav, konu ve çalışma kayıtlarına uygular; böylece öneriler gerekçelendirilebilir ve uydurma veri içermez.
   Sonuçları sınırlandırarak Genel Bakış'ı kısa tutar; kurallar yeni verilerle her çalıştırmada yeniden değerlendirilir. */
const Recommendations={
  generate(){
    const out=[],t=todayKey();
    // 1) Yaklaşan sınav + eksik konu
    for(const ex of S.exams.filter(e=>e.date>=t).sort((a,b)=>a.date<b.date?-1:1).slice(0,3)){
      const dl=daysUntilExam(ex),inc=examIncomplete(ex);
      if(inc&&inc.length&&dl<=14) out.push({icon:"alarm-clock",text:`${subjName(ex.subjectId)} sınavına ${dl===0?"bugün":dl+" gün"} kaldı ve ${inc.length} konu henüz tamamlanmadı.`,
        act:{label:"Konuları gör",route:"subjects"}});
      const est=examEst(ex), avail=dl*S.settings.dailyTargetMin;
      if(est>avail&&dl>=0) out.push({icon:"alert-triangle",danger:true,text:`${subjName(ex.subjectId)} sınavı için tahmini kalan çalışma (${fmtDur(est)}), mevcut süre hedefine göre fazla görünüyor. Konuları öncelik sırasına dizmayı düşün.`,act:{label:"Planla",route:"planner"}});
    }
    // 2) Gecikmiş tekrarlar
    const od=dueReviews().filter(r=>r.nextReviewAt<t);
    if(od.length) out.push({icon:"rotate-ccw",text:`${od.length} tekrarın gecikmiş. Kısa tekrarlar bile eksikleri kapatmak için etkilidir.`,act:{label:"Tekrar Merkezi",route:"review"}});
    // 3) Bugünün planı sınırı aşıyor mu
    const today=tasksForDay(t), planMin=today.filter(x=>x.status==="planli").reduce((a,x)=>a+(x.estMinutes||0),0);
    if(planMin>S.settings.dailyMaxMin) out.push({icon:"gauge",danger:true,text:`Bugünün planı (${fmtDur(planMin)}) günlük çalışma sınırını (${fmtDur(S.settings.dailyMaxMin)}) aşıyor. Düşük önceliklileri ileri taşıyabilirsin.`,act:{label:"Planı aç",route:"planner"}});
    // 4) Düşük doğruluk (yeterli örneklemde)
    for(const s of S.subjects){
      const st=subjectStats(s.id);
      if(st.qa>=10&&st.accuracy!==null&&st.accuracy<50)
        out.push({icon:"target",text:`${s.name}: ${st.qa} soruda doğruluk %${st.accuracy}. Konuyu baştan özetleyip kolay sorulardan başlamak işe yarayabilir.`});
    }
    // 5) Bugün oturum yok + görev var
    const todaySess=S.sessions.some(x=>dayKey(new Date(x.startedAt))===t);
    if(!todaySess&&today.length) out.push({icon:"play",text:`Bugün henüz kayıtlı oturum yok. İlk görevle kısa bir oturum başlatmak günü rayına oturtur.`});
    // 6) Tamamlanan tekrarlar → zamanı başka derse kaydır önerisi
    if(!dueReviews().length&&S.topics.some(x=>x.nextReviewAt))
      out.push({icon:"check-circle-2",text:`Planlanan tekrarların hepsi tamam. Kalan zamanı en yakın sınavının dersine ayırmayı düşünebilirsin.`});
    // 7) Hiç veri yoksa dürüst başlangıç önerisi
    if(!S.sessions.length&&!out.length)
      out.push({icon:"sparkles",text:`Henüz kayıtlı oturum yok. Bir ders seçip 25 dakikalık kısa bir oturumla başlamak için yeterli.`});
    return out.slice(0,6);
  }
};
