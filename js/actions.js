/*
 * Kullanıcı eylemlerini App nesnesinde toplar.
 * Durum, depolama, UI çekirdeği ve görünümlere dayanır.
 * Inline handler’lar kullanır.
 */
"use strict";

/* ---------- 19) Eylemler (App) ---------- */
const App={
  setQuestionFilter(filter,value){
    if(filter==="subject")UI.questionSubject=value;
    else if(filter==="topic")UI.questionTopic=value;
    else if(filter==="status")UI.questionStatus=value;
    render();
  },
  searchQuestions(value){
    UI.questionSearch=value;
    renderQuestionArchiveList();
  },
  questionModal(id){
    const question=id?S.questionArchive.find(item=>item.id===id):null;
    if(id&&!question){toast("Arşiv sorusu bulunamadı.","err");return;}
    const body=fld("Ders",`<select id="qa-subject">${QUESTION_SUBJECTS.map(subject=>
      `<option value="${esc(subject)}" ${question?.subject===subject?"selected":""}>${esc(subject)}</option>`).join("")}</select>`)+
      fld("Konu adı",`<input id="qa-topic" maxlength="120" required value="${esc(question?.topic||"")}" placeholder="Örn. İkinci dereceden denklemler">`)+
      fld("Çözememe nedeni",`<select id="qa-reason">${QUESTION_REASONS.map(reason=>
        `<option value="${esc(reason)}" ${question?.reason===reason?"selected":""}>${esc(reason)}</option>`).join("")}</select>`)+
      fld("Kendi notum",`<textarea id="qa-notes" rows="3" maxlength="5000" placeholder="Nerede takıldığını yaz…">${esc(question?.notes||"")}</textarea>`)+
      fld("Çözüm / ipuçları",`<textarea id="qa-solution" rows="3" maxlength="5000" placeholder="Daha sonra ekleyebilirsin…">${esc(question?.solution||"")}</textarea>`)+
      fld("Durum",`<select id="qa-status">${QUESTION_STATUSES.map(status=>
        `<option value="${esc(status)}" ${question?.status===status?"selected":""}>${esc(status)}</option>`).join("")}</select>`)+
      fld("Soru fotoğrafı (isteğe bağlı)",`<input type="file" id="qa-photo" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp">
        <div class="help">JPG, PNG veya WebP; en fazla 15 MB. Fotoğraf cihazında IndexedDB içinde saklanır.</div>`)+
      (question?.imageId?`<div class="question-photo question-modal-photo" id="question-edit-photo"><span class="small muted">Fotoğraf yükleniyor…</span></div>
        <label class="question-remove-image"><input type="checkbox" id="qa-remove-photo"> Fotoğrafı kaldır</label>`:"");
    openModal({title:question?"Soruyu düzenle":"Arşive soru ekle",body,
      footer:`<button class="btn" onclick="closeModal()">Vazgeç</button>
        <button class="btn btn-primary" onclick="App.saveQuestion('${question?esc(question.id):""}')"><i data-lucide="check"></i>Kaydet</button>`,
      wide:true});
    if(question?.imageId)loadQuestionModalImage(question.imageId,"#question-edit-photo");
  },
  async saveQuestion(id){
    const modalRequest=UI.questionModalRequest;
    const existing=id?S.questionArchive.find(item=>item.id===id):null;
    if(id&&!existing){toast("Arşiv sorusu bulunamadı.","err");return;}
    const topic=$("#qa-topic").value.trim();
    if(!topic){toast("Lütfen konu adını girin.","err");$("#qa-topic").focus();return;}
    const file=$("#qa-photo").files[0]||null;
    const values={subject:$("#qa-subject").value,reason:$("#qa-reason").value,
      notes:$("#qa-notes").value.trim(),solution:$("#qa-solution").value.trim(),
      status:$("#qa-status").value,removeImage:!!$("#qa-remove-photo")?.checked};
    if(file){
      const validationError=await validateImageFile(file,"Soru fotoğrafı");
      if(modalRequest!==UI.questionModalRequest)return;
      if(validationError){toast(validationError,"err",6000);return;}
    }
    const previousImageId=existing?.imageId||null;
    let imageId=values.removeImage?null:previousImageId;
    try{
      if(file){
        imageId=uid();
        const extension=file.name.split(".").pop().toLowerCase();
        const mime={jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp"}[extension];
        await questionImageRequest("put",imageId,{key:imageId,
          blob:file.slice(0,file.size,file.type||mime),mime,updatedAt:new Date().toISOString()});
        if(modalRequest!==UI.questionModalRequest){
          try{await questionImageRequest("delete",imageId);}
          catch(error){toast("İptal edilen fotoğraf temizlenemedi."+
            (error?.message?" "+error.message:""),"warn",6000);}
          return;
        }
      }
    }catch(error){
      if(modalRequest!==UI.questionModalRequest)return;
      toast("Soru fotoğrafı kaydedilemedi. Tarayıcı depolama alanını kontrol edin."+
        (error?.message?" ("+error.message+")":""),"err",7000);
      return;
    }
    const updated={id:existing?.id||uid(),subject:values.subject,topic,
      reason:values.reason,notes:values.notes,solution:values.solution,
      createdAt:existing?.createdAt||new Date().toISOString(),status:values.status,imageId};
    if(existing)S.questionArchive[S.questionArchive.indexOf(existing)]=updated;
    else S.questionArchive.push(updated);
    if(!persist()){
      if(file&&imageId){
        try{await questionImageRequest("delete",imageId);}
        catch(error){toast("Kaydedilemeyen soru fotoğrafı temizlenemedi."+
          (error?.message?" "+error.message:""),"warn",6000);}
      }
      return;
    }
    closeModal();render();
    toast(existing?"Soru güncellendi.":"Soru arşive eklendi.");
    if(previousImageId&&previousImageId!==imageId){
      try{await questionImageRequest("delete",previousImageId);}
      catch(error){toast("Eski fotoğraf temizlenemedi; soru kaydı korunuyor."+
        (error?.message?" "+error.message:""),"warn",6000);}
    }
  },
  questionDetail(id){
    const question=S.questionArchive.find(item=>item.id===id);
    if(!question){toast("Arşiv sorusu bulunamadı.","err");return;}
    const created=Number.isFinite(Date.parse(question.createdAt))?
      new Date(question.createdAt).toLocaleString("tr-TR"):"—";
    const body=`<div class="row" style="margin-bottom:12px"><span class="badge b-info">${esc(question.subject)}</span>
      ${questionStatusBadge(question.status)}<span class="small muted">${esc(created)}</span></div>
      <h4 class="question-detail-title">${esc(question.topic)}</h4>
      <div class="small muted" style="margin-bottom:12px">Çözememe nedeni: ${esc(question.reason)}</div>
      ${question.imageId?`<div class="question-photo question-detail-photo" id="question-detail-photo"><span class="small muted">Fotoğraf yükleniyor…</span></div>`:""}
      ${question.notes?`<div class="question-detail-text"><b>Kendi notum</b><p>${esc(question.notes)}</p></div>`:""}
      ${question.solution?`<div class="question-detail-text"><b>Çözüm / ipuçları</b><p>${esc(question.solution)}</p></div>`:""}`;
    openModal({title:"Arşiv sorusu",body,wide:true,
      footer:`<button class="btn" onclick="closeModal()">Kapat</button>
        <button class="btn" onclick="closeModal();App.questionModal('${esc(question.id)}')"><i data-lucide="pencil"></i>Düzenle</button>
        ${question.status!=="Öğrendim"?`<button class="btn btn-primary" onclick="App.markQuestionLearned('${esc(question.id)}')"><i data-lucide="check"></i>Öğrendim</button>`:""}`});
    if(question.imageId)loadQuestionModalImage(question.imageId,"#question-detail-photo");
  },
  markQuestionLearned(id){
    const question=S.questionArchive.find(item=>item.id===id);
    if(!question){toast("Arşiv sorusu bulunamadı.","err");return;}
    question.status="Öğrendim";
    if(!persist())return;
    closeModal();render();toast("Soru “Öğrendim” olarak işaretlendi.");
  },
  deleteQuestion(id){
    const question=S.questionArchive.find(item=>item.id===id);
    if(!question){toast("Arşiv sorusu bulunamadı.","err");return;}
    confirmDialog({title:"Arşiv sorusunu sil",confirmText:"Soruyu sil",
      message:`<b>${esc(question.topic)}</b> sorusu kalıcı olarak silinecek.`,
      onConfirm:async()=>{
        S.questionArchive=S.questionArchive.filter(item=>item.id!==id);
        if(!persist())return;
        render();toast("Soru arşivden silindi.");
        if(question.imageId){
          try{await questionImageRequest("delete",question.imageId);}
          catch(error){toast("Soru silindi ancak fotoğraf deposu temizlenemedi."+
            (error?.message?" "+error.message:""),"warn",6000);}
        }
      }});
  },
  chooseSchoolScheduleImage(){
    if(UI.schoolScheduleSaving)return;
    $("#school-schedule-file")?.click();
  },
  async uploadSchoolSchedule(input){
    const file=input.files&&input.files[0]; input.value="";
    if(!file)return;
    try{
      const validationError=await validateImageFile(file,"Program görseli");
      if(validationError){toast(validationError,"err",5000);return;}
      UI.schoolScheduleSaving=true;
      const content=$("#school-schedule-content");
      if(content)content.setAttribute("aria-busy","true");
      const extension=file.name.split(".").pop().toLowerCase();
      const fallbackMime={jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp"}[extension];
      await schoolScheduleRequest("put",{key:SCHOOL_SCHEDULE_KEY,blob:file.slice(0,file.size,file.type||fallbackMime),
        name:file.name,updatedAt:new Date().toISOString()});
      UI.schoolScheduleSaving=false;
      toast("Okul programı görseli kaydedildi.","ok");
      if(UI.route==="school-schedule")render();
    }catch(error){
      UI.schoolScheduleSaving=false;
      toast("Okul programı kaydedilemedi. Tarayıcı depolama alanını veya izinlerini kontrol edin."+
        (error?.message?" ("+error.message+")":""),"err",7000);
      if(UI.route==="school-schedule")render();
    }
  },
  deleteSchoolSchedule(){
    confirmDialog({title:"Okul programı görselini kaldır",confirmText:"Görseli kaldır",
      message:"Kaydedilmiş okul programı görseli bu tarayıcıdan kalıcı olarak silinecek.",
      onConfirm:async()=>{
        UI.schoolScheduleSaving=true;
        try{
          await schoolScheduleRequest("delete");
          UI.schoolScheduleSaving=false;
          toast("Okul programı görseli kaldırıldı.");
          if(UI.route==="school-schedule")render();
        }catch(error){
          UI.schoolScheduleSaving=false;
          toast("Okul programı silinemedi. Tarayıcı depolama alanını veya izinlerini kontrol edin."+
            (error?.message?" ("+error.message+")":""),"err",7000);
          if(UI.route==="school-schedule")render();
        }
      }});
  },
  toggleTheme(){ S.settings.theme=S.settings.theme==="dark"?"light":"dark";
    document.documentElement.dataset.theme=S.settings.theme; if(!persist())return; render(); },
  togDay(list,i){ const arr=S.settings[list]; const k=arr.indexOf(i);
    if(k>=0)arr.splice(k,1);else arr.push(i); if(!persist())return; render(); },
  saveSettings(){
    const num=(id,mn,mx,d)=>{const v=parseInt($(id).value);return isNaN(v)?d:Math.min(mx,Math.max(mn,v));};
    S.settings.name=$("#s-name").value.trim();
    S.settings.theme=$("#s-theme").value; S.settings.weekStart=parseInt($("#s-week").value);
    S.settings.dateStyle=$("#s-datestyle").value;
    S.settings.dailyTargetMin=num("#s-target",15,720,180); S.settings.dailyMaxMin=num("#s-max",30,900,300);
    S.settings.sessionLen=num("#s-sess",10,180,40); S.settings.breakLen=num("#s-break",0,60,10);
    S.settings.examWarnDays=num("#s-warn",1,30,5);
    document.documentElement.dataset.theme=S.settings.theme;
    if(!persist())return; render(); toast("Ayarlar kaydedildi.");
  },

  /* --- Görevler --- */
  taskModal(id,presetDate){
    const tk=id?S.tasks.find(x=>x.id===id):null;
    const date=tk?tk.date||"":(presetDate||"");
    const subjs=S.subjects.filter(s=>!s.archived);
    openModal({title:tk?"Görevi düzenle":"Yeni görev",body:
      fld("Görev başlığı *",`<input id="tk-title" value="${esc(tk?.title||"")}" maxlength="120" placeholder="örn. Dörtgenler soru seti">`)+
      `<div class="frow">${fld("Ders",`<select id="tk-subj" onchange="App.fillTopicSelect('tk-topic',this.value)"><option value="">Genel</option>${subjs.map(s=>`<option value="${s.id}" ${tk?.subjectId===s.id?"selected":""}>${esc(s.name)}</option>`).join("")}</select>`)}
      ${fld("Konu (isteğe bağlı)",`<select id="tk-topic"><option value="">—</option></select>`)}</div>`+
      `<div class="frow">${fld("Tarih (boş = planlanmamış)",`<input type="date" id="tk-date" value="${date}">`)}
      ${fld("Tahmini süre (dk)",`<input type="number" id="tk-min" min="5" max="480" value="${tk?.estMinutes??45}">`)}</div>`+
      `<div class="frow">${fld("Öncelik",`<select id="tk-prio">${[1,2,3].map(p=>`<option value="${p}" ${(tk?.priority??2)===p?"selected":""}>${PRIOS[p].l}</option>`).join("")}</select>`)}
      ${fld("Tür",`<select id="tk-type">${Object.entries(SESSION_TYPES).map(([k,l])=>`<option value="${k}" ${(tk?.type||"konu")===k?"selected":""}>${l}</option>`).join("")}</select>`)}</div>`,
      footer:`${tk?`<button class="btn btn-danger" onclick="closeModal();App.deleteTask('${tk.id}')"><i data-lucide="trash-2"></i>Sil</button>`:""}
        <button class="btn" onclick="closeModal()">Vazgeç</button><button class="btn btn-primary" onclick="App.saveTask('${id||""}')">Kaydet</button>`,
      onMount:()=>App.fillTopicSelect("tk-topic",tk?.subjectId||"")});
  },
  fillTopicSelect(selId,subjId){
    const sel=$("#"+selId); if(!sel)return; const cur=sel.value;
    const topics=subjId?S.topics.filter(t=>t.subjectId===subjId):[];
    sel.innerHTML=`<option value="">—</option>`+topics.map(t=>`<option value="${t.id}">${esc(t.title)}</option>`).join("");
    if(cur&&topics.some(t=>t.id===cur))sel.value=cur;
  },
  saveTask(id){
    const title=$("#tk-title").value.trim();
    if(!title){toast("Görev başlığı boş olamaz.","err");$("#tk-title").focus();return;}
    const data={title,subjectId:$("#tk-subj").value||null,topicId:$("#tk-topic").value||null,
      date:$("#tk-date").value||null,estMinutes:clampNum($("#tk-min").value,5,480,45),
      priority:parseInt($("#tk-prio").value),type:$("#tk-type").value};
    if(data.topicId){const t=topicById(data.topicId);if(t)data.subjectId=t.subjectId;}
    if(id){Object.assign(S.tasks.find(x=>x.id===id),data);}
    else S.tasks.push({id:uid(),...data,status:"planli",createdAt:todayKey()});
    if(!persist())return; closeModal();render();toast(id?"Görev güncellendi.":"Görev eklendi.");
  },
  toggleTask(id){ const tk=S.tasks.find(x=>x.id===id); if(!tk)return;
    if(tk.status==="tamam"){tk.status="planli";}
    else{tk.status="tamam";toast("Görev tamamlandı olarak işaretlendi.","ok");}
    if(!persist())return; render(); },
  deleteTask(id){ confirmDialog({title:"Görevi sil",message:"Bu görev listeden kaldırılacak. Geri alınamaz.",onConfirm:()=>{
    S.tasks=S.tasks.filter(x=>x.id!==id);if(!persist())return;render();toast("Görev silindi.");}}); },
  postponeTask(id){ const tk=S.tasks.find(x=>x.id===id); if(!tk)return;
    openModal({title:"Görevi ertele",body:
      `<p class="small muted" style="margin-bottom:12px">“${esc(tk.title)}” için yeni bir tarih seç ya da görevi planlanmamış kuyruğuna taşı. Görev asla kaybolmaz, kopyası oluşmaz.</p>`+
      fld("Yeni tarih",`<input type="date" id="pp-date" value="${addDaysKey(todayKey(),1)}" min="${todayKey()}">`),
      footer:`<button class="btn" onclick="App.unscheduleTask('${id}')">Planlanmamışlara al</button>
        <button class="btn" onclick="closeModal()">Vazgeç</button>
        <button class="btn btn-primary" onclick="App.applyPostpone('${id}')">Tarihe taşı</button>`});
  },
  applyPostpone(id){ const tk=S.tasks.find(x=>x.id===id);
    const d=$("#pp-date").value; if(!d){toast("Bir tarih seçmelisin.","err");return;}
    tk.date=d; if(!persist())return;closeModal();render();toast(`Görev ${fmtShort(d)} gününe taşındı.`); },
  unscheduleTask(id){ const tk=S.tasks.find(x=>x.id===id); tk.date=null;
    if(!persist())return;closeModal();render();toast("Görev planlanmamış kuyruğuna alındı."); },
  startSessionForTask(id){ const tk=S.tasks.find(x=>x.id===id); if(!tk)return;
    if(S.activeSession){toast("Zaten devam eden bir oturum var. Önce onu bitir.","warn");return;}
    App.startSessionModal(tk.subjectId,tk.topicId,tk.type); },

  /* --- Dersler --- */
  subjectModal(id){
    const sb=id?subjectById(id):null;
    openModal({title:sb?"Dersi düzenle":"Yeni ders",body:
      fld("Ders adı *",`<input id="sb-name" value="${esc(sb?.name||"")}" maxlength="50" placeholder="örn. Matematik">`)+
      `<div class="frow">${fld("Renk",`<select id="sb-color">${SUBJ_COLORS.map(c=>`<option value="${c}" ${sb?.color===c?"selected":""}>${c}</option>`).join("")}</select>`)}
      ${fld("Öncelik",`<select id="sb-prio">${[1,2,3].map(p=>`<option value="${p}" ${(sb?.priority??2)===p?"selected":""}>${PRIOS[p].l}</option>`).join("")}</select>`)}</div>`+
      `<div class="frow">${fld("Hedef not (isteğe bağlı)",`<input id="sb-grade" value="${esc(sb?.targetGrade||"")}" maxlength="10">`)}</div>`+
      fld("Notlar",`<textarea id="sb-notes" rows="2">${esc(sb?.notes||"")}</textarea>`),
      footer:`${sb?`<button class="btn btn-danger" onclick="closeModal();App.deleteSubject('${sb.id}')"><i data-lucide="trash-2"></i>Sil</button>`:""}
        <button class="btn" onclick="closeModal()">Vazgeç</button><button class="btn btn-primary" onclick="App.saveSubject('${id||""}')">Kaydet</button>`});
  },
  saveSubject(id){
    const name=$("#sb-name").value.trim();
    if(!name){toast("Ders adı boş olamaz.","err");return;}
    const data={name,color:$("#sb-color").value,priority:parseInt($("#sb-prio").value),
      targetGrade:$("#sb-grade").value.trim(),notes:$("#sb-notes").value.trim()};
    if(id){Object.assign(subjectById(id),data);}
    else S.subjects.push({id:uid(),...data,archived:false});
    if(!persist())return;closeModal();render();toast(id?"Ders güncellendi.":"Ders eklendi.");
  },
  deleteSubject(id){
    const sb=subjectById(id); if(!sb)return;
    const nT=S.topics.filter(t=>t.subjectId===id).length;
    const nE=S.exams.filter(e=>e.subjectId===id).length;
    const nS=S.sessions.filter(s=>s.subjectId===id).length;
    confirmDialog({title:"Dersi sil",confirmText:"Dersi ve bağlantılarını sil",
      message:`<b>${esc(sb.name)}</b> dersi silinecek. Bu dersin <b>${nT} konusu</b> ve <b>${nE} sınavı</b> da silinir.<br><br>Çalışma oturumu geçmişin <b>silinmez</b> — ${nS} oturum kaydı ders adıyla korunur, istatistikler bozulmaz.`,
      onConfirm:()=>{
        const ids=new Set(S.topics.filter(t=>t.subjectId===id).map(t=>t.id));
        S.sessions.forEach(s=>{if(s.subjectId===id&&!s.subjectName)s.subjectName=sb.name;});
        S.topics=S.topics.filter(t=>t.subjectId!==id);
        S.exams=S.exams.filter(e=>e.subjectId!==id);
        S.tasks=S.tasks.filter(t=>t.subjectId!==id);
        S.subjects=S.subjects.filter(s=>s.id!==id);
        if(!persist())return;render();toast("Ders silindi; oturum geçmişi korundu.");}});
  },
  gotoSubject(id){ gotoSubject(id); },

  /* --- Konular --- */
  selTopic(id){ UI.topicSel.has(id)?UI.topicSel.delete(id):UI.topicSel.add(id); render(); },
  bulkStatus(){ const st=$("#bulk-st").value; if(!st){toast("Önce bir durum seç.","warn");return;}
    let n=0; UI.topicSel.forEach(id=>{const t=topicById(id);if(t){t.status=st;n++;}});
    UI.topicSel.clear(); if(!persist())return;render();toast(n+" konunun durumu güncellendi."); },
  topicModal(id,subjId,parentId){
    const tp=id?topicById(id):null;
    const subjs=S.subjects.filter(s=>!s.archived);
    if(!subjs.length){toast("Önce bir ders ekle.","warn");setRoute("subjects");return;}
    openModal({title:tp?"Konuyu düzenle":parentId?"Alt konu ekle":"Yeni konu",body:
      fld("Konu başlığı *",`<input id="tp-title" value="${esc(tp?.title||"")}" maxlength="120" placeholder="örn. Dörtgenler">`)+
      fld("Ders *",`<select id="tp-subj">${subjs.map(s=>`<option value="${s.id}" ${(tp?.subjectId||subjId)===s.id?"selected":""}>${esc(s.name)}</option>`).join("")}</select>`)+
      `<div class="frow">${fld("Sınav önemi",`<select id="tp-er">${[["0","Genel"],["1","Düşük"],["2","Sınavda çıkabilir"],["3","Kritik"]].map(([v,l])=>`<option value="${v}" ${(tp?.examRelevance??1)==v?"selected":""}>${l}</option>`).join("")}</select>`)}
      ${fld("Kalan tahmini süre (dk)",`<input type="number" id="tp-em" min="10" max="600" value="${tp?.estMinutes??60}">`)}</div>`+
      `<div class="frow">${fld("Durum",`<select id="tp-st">${Object.entries(TOPIC_STATUS).map(([k,l])=>`<option value="${k}" ${(tp?.status||"baslanmadi")===k?"selected":""}>${l}</option>`).join("")}</select>`)}
      ${fld("Öz-güven (1–5)",`<select id="tp-cf">${[1,2,3,4,5].map(i=>`<option value="${i}" ${(tp?.confidence??1)===i?"selected":""}>${i}</option>`).join("")}</select>`)}</div>`+
      `<div class="frow">${fld("Son çalışma",`<input type="date" id="tp-ls" value="${tp?.lastStudiedAt||""}">`)}
      ${fld("Sonraki tekrar",`<input type="date" id="tp-nr" value="${tp?.nextReviewAt||""}">`)}</div>`+
      fld("Kaynak / bağlantı (isteğe bağlı)",`<input id="tp-res" value="${esc(tp?.resources||"")}" placeholder="örn. kitap sayfası veya video bağlantısı">`)+
      fld("Notlar",`<textarea id="tp-notes" rows="2">${esc(tp?.notes||"")}</textarea>`),
      footer:`${tp?`<button class="btn btn-danger" onclick="closeModal();App.deleteTopic('${tp.id}')"><i data-lucide="trash-2"></i>Sil</button>`:""}
        <button class="btn" onclick="closeModal()">Vazgeç</button><button class="btn btn-primary" onclick="App.saveTopic('${id||""}','${parentId||""}')">Kaydet</button>`});
  },
  saveTopic(id,parentId){
    const title=$("#tp-title").value.trim();
    if(!title){toast("Konu başlığı boş olamaz.","err");return;}
    const data={title,subjectId:$("#tp-subj").value,examRelevance:parseInt($("#tp-er").value),
      estMinutes:clampNum($("#tp-em").value,10,600,60),status:$("#tp-st").value,
      confidence:parseInt($("#tp-cf").value),lastStudiedAt:$("#tp-ls").value||null,
      nextReviewAt:$("#tp-nr").value||null,resources:$("#tp-res").value.trim(),notes:$("#tp-notes").value.trim()};
    if(id){Object.assign(topicById(id),data);}
    else S.topics.push({id:uid(),parentId:parentId||null,qAttempted:0,qCorrect:0,...data});
    if(!persist())return;closeModal();render();toast(id?"Konu güncellendi.":"Konu eklendi.");
  },
  deleteTopic(id){
    const tp=topicById(id); if(!tp)return;
    const subs=S.topics.filter(t=>t.parentId===id);
    confirmDialog({title:"Konuyu sil",message:`<b>${esc(tp.title)}</b> silinecek.${subs.length?` Bağlı <b>${subs.length} alt konusu</b> da silinir.`:""} Soru ve oturum kayıtları geçmişte kalır.`,
      onConfirm:()=>{ const kill=new Set([id,...S.topics.filter(t=>t.parentId===id).map(t=>t.id)]);
        S.topics=S.topics.filter(t=>!kill.has(t.id));
        S.exams.forEach(e=>{const ids=examTopicIds(e);if(ids)e.topicIds=ids.filter(x=>!kill.has(x));});
        S.tasks.forEach(t=>{if(t.topicId&&kill.has(t.topicId))t.topicId=null;});
        if(!persist())return;render();toast("Konu silindi.");}});
  },
  topicDetail(id){
    const tp=topicById(id); if(!tp)return;
    const p=topicPrep(tp), subs=S.topics.filter(t=>t.parentId===id);
    const sess=S.sessions.filter(s=>s.topicId===id);
    const sessMin=Math.round(sess.reduce((a,s)=>a+s.elapsedMs,0)/60000);
    openModal({title:tp.title,wide:true,body:
      `<div class="row" style="margin-bottom:12px">${subjTag(tp.subjectId)}${statusBadge(tp.status)}
        <span class="badge b-mut">Öz-güven ${tp.confidence}/5</span>
        ${tp.examRelevance===3?'<span class="badge b-danger">Sınav için kritik</span>':""}
        ${tp.nextReviewAt&&tp.nextReviewAt<=todayKey()?'<span class="badge b-warn">Tekrar gecikmiş</span>':""}</div>
      <div class="stat-line"><span class="muted">Kayıtlı oturum</span><span class="v">${sess.length} · ${fmtDur(sessMin)}</span></div>
      <div class="stat-line"><span class="muted">Sorular (bu konuda)</span><span class="v">${p.qc} / ${p.qa}${p.qa?` · %${pct(p.qc,p.qa)}`:""}</span></div>
      <div class="stat-line"><span class="muted">Tahmini hazırlık</span><span class="v">%${p.score}</span></div>
      <div class="help" style="margin:4px 0 12px">Tahmin: konum durumu (%40) + öz-güven (%30)${p.acc!==null?" + soru doğruluğu (%30)":" (soru verisi yoksa öz-güven ağırlığı artar)"} — bilgi ölçümü değil, bir tahmindir.</div>
      ${tp.notes?`<div class="card" style="padding:10px 12px;background:var(--surface2);margin-bottom:10px"><div class="small muted">${esc(tp.notes)}</div></div>`:""}
      ${tp.resources?`<div class="small row" style="margin-bottom:10px"><i data-lucide="link" style="width:13px;height:13px;color:var(--accent)"></i>${esc(tp.resources)}</div>`:""}
      ${subs.length?`<div style="margin-bottom:10px"><b class="small">Alt konular</b>${subs.map(s=>`<div class="small row" style="padding:4px 0"><i data-lucide="corner-down-right" style="width:12px;height:12px;color:var(--faint)"></i>${esc(s.title)} ${statusBadge(s.status)}</div>`).join("")}</div>`:""}
      ${sess.length?`<b class="small">Son oturumlar</b>${sess.slice(-4).reverse().map(s=>`<div class="small row" style="padding:3px 0;color:var(--muted)">${fmtShort(dayKey(new Date(s.startedAt)))} · ${esc(SESSION_TYPES[s.type])} · ${fmtDur(Math.round(s.elapsedMs/60000))}${s.demo?' <span class="badge b-demo">DEMO</span>':""}</div>`).join("")}`:""}`,
      footer:`<button class="btn" onclick="closeModal();App.rescheduleReview('${id}')"><i data-lucide="calendar-clock"></i>Tekrar planla</button>
        <button class="btn" onclick="closeModal();App.topicModal('${id}')"><i data-lucide="pencil"></i>Düzenle</button>
        <button class="btn btn-primary" onclick="closeModal();App.startSessionModal('${tp.subjectId}','${id}')"><i data-lucide="play"></i>Çalışmaya başla</button>`});
  },

  /* --- Sınavlar --- */
  examModal(id){
    const ex=id?examById(id):null;
    if(ex&&!examTopicIds(ex)){toast("Sınavın konu listesi geçersiz; önce veriyi düzeltmeden düzenleyemezsin.","err");return;}
    const subjs=S.subjects.filter(s=>!s.archived);
    if(!subjs.length){toast("Önce bir ders ekle.","warn");setRoute("subjects");return;}
    const sid=ex?.subjectId||subjs[0].id;
    openModal({title:ex?"Sınavı düzenle":"Yeni sınav",body:
      fld("Ders *",`<select id="ex-subj" onchange="App.renderExamTopics()">${subjs.map(s=>`<option value="${s.id}" ${sid===s.id?"selected":""}>${esc(s.name)}</option>`).join("")}</select>`)+
      fld("Sınav başlığı *",`<input id="ex-title" value="${esc(ex?.title||"")}" maxlength="100" placeholder="örn. 1. Dönem 2. Yazılı">`)+
      `<div class="frow">${fld("Tarih *",`<input type="date" id="ex-date" value="${ex?.date||""}">`)}
      ${fld("Saat (isteğe bağlı)",`<input type="time" id="ex-time" value="${ex?.time||""}">`)}</div>`+
      `<div class="frow">${fld("Önem",`<select id="ex-imp">${[[1,"Yüksek"],[2,"Orta"],[3,"Düşük"]].map(([v,l])=>`<option value="${v}" ${(ex?.importance??2)===v?"selected":""}>${l}</option>`).join("")}</select>`)}
      ${fld("Hedef not",`<input id="ex-grade" value="${esc(ex?.targetGrade||"")}" maxlength="10">`)}</div>`+
      fld("Sınav kapsamı (kendi bilgine göre seç)",`<div class="chk-list" id="ex-topics"></div>`,`Kapsamı sen belirlediğin için eksik konu sayısı yalnızca seçtiklerinden hesaplanır.`)+
      fld("Notlar",`<textarea id="ex-notes" rows="2">${esc(ex?.notes||"")}</textarea>`),
      footer:`${ex?`<button class="btn btn-danger" onclick="closeModal();App.deleteExam('${ex.id}')"><i data-lucide="trash-2"></i>Sil</button>`:""}
        <button class="btn" onclick="closeModal()">Vazgeç</button><button class="btn btn-primary" onclick="App.saveExam('${id||""}')">Kaydet</button>`,
      onMount:()=>App.renderExamTopics(ex?.topicIds||[])});
  },
  renderExamTopics(selected=[]){
    const sid=$("#ex-subj").value;
    const topics=S.topics.filter(t=>t.subjectId===sid);
    $("#ex-topics").innerHTML= topics.length? topics.map(t=>
      `<label class="chk-item"><input type="checkbox" value="${t.id}" ${selected.includes(t.id)?"checked":""}>
       <span style="flex:1">${esc(t.title)}</span>${statusBadge(t.status)}</label>`).join("")
     :`<div class="small muted" style="padding:10px">Bu derse ait konu yok. Önce konu ekleyebilirsin; kapsamı sonra da düzenleyebilirsin.</div>`;
  },
  saveExam(id){
    const title=$("#ex-title").value.trim(), date=$("#ex-date").value, sid=$("#ex-subj").value;
    if(!title){toast("Sınav başlığı boş olamaz.","err");return;}
    if(!date){toast("Sınav tarihi gerekli.","err");return;}
    if(date<addDaysKey(todayKey(),-3650)){toast("Geçersiz tarih.","err");return;}
    const topicIds=[...$$("#ex-topics input:checked")].map(x=>x.value);
    const data={subjectId:sid,title,date,time:$("#ex-time").value,importance:parseInt($("#ex-imp").value),
      targetGrade:$("#ex-grade").value.trim(),topicIds,notes:$("#ex-notes").value.trim()};
    if(id){Object.assign(examById(id),data);}
    else S.exams.push({id:uid(),...data});
    if(!persist())return;closeModal();render();toast(id?"Sınav güncellendi.":"Sınav eklendi.");
  },
  deleteExam(id){ confirmDialog({title:"Sınavı sil",message:"Bu sınav, geri sayımlardan ve takvimden kaldırılacak. Konular silinmez.",onConfirm:()=>{
    S.exams=S.exams.filter(e=>e.id!==id);if(!persist())return;render();toast("Sınav silindi.");}}); },
  openExamDetail(id){
    const ex=examById(id); if(!ex)return;
    const topicIds=examTopicIds(ex),inc=examIncomplete(ex),est=examEst(ex);
    const dl=daysUntilExam(ex),tot=topicIds?topicIds.length:0,incCount=inc?inc.length:0;
    const feas=est!==null&&est>dl*S.settings.dailyTargetMin;
    const ts=topicIds?topicIds.map(topicById).filter(Boolean):[];
    const summary = tot ? `<div class="stat-line"><span class="muted">Kapsam konuları</span><span class="v">${tot-incCount} / ${tot} hazır</span></div>
      <div class="stat-line"><span class="muted">Kalan tahmini çalışma</span><span class="v">${fmtDur(est)}</span></div>` : "";
    const warn = !topicIds?`<div class="help" role="alert">Sınavın konu listesi okunamıyor. Veri düzeltilene kadar kapsam hesaplaması kullanılamaz.</div>`:
      dl>=0 && feas ? `<div class="card" style="padding:10px 12px;margin-top:10px;border-color:var(--warn);background:var(--warn-dim)"><div class="small" style="color:var(--warn)"><b>Süre uyarısı:</b> kalan tahmin, günlük ${fmtDur(S.settings.dailyTargetMin)} hedefiyle ${dl} günde yetmiyor gibi görünüyor. Kritik konulara öncelik vermeyi, diğerlerini sonraki tekrarlara bırakmayı düşünebilirsin.</div></div>` : "";
    const topicList = !topicIds?"" : ts.length ? `<div style="margin-top:12px"><b class="small">Konular</b>${ts.map(t=>{const p=topicPrep(t);return `<div class="row small" style="padding:5px 0;gap:10px">
        <span style="flex:1;cursor:pointer" onclick="closeModal();App.topicDetail('${t.id}')">${esc(t.title)}</span>
        ${p.qa?`<span class="muted">${p.qc}/${p.qa} soru · %${pct(p.qc,p.qa)}</span>`:""}${statusBadge(t.status)}</div>`;}).join("")}</div>` : `<div class="help" style="margin-top:10px">Kapsam konusu seçilmemiş. Düzenle'den sınav konularını işaretleyebilirsin.</div>`;
    const notes = ex.notes ? `<div class="card" style="padding:10px 12px;background:var(--surface2);margin-top:10px"><div class="small muted">${esc(ex.notes)}</div></div>` : "";
    openModal({title:ex.title,wide:true,body:
      `<div class="row" style="margin-bottom:12px">${subjTag(ex.subjectId)}
        <span class="badge ${dl<0?"b-mut":dl<=S.settings.examWarnDays?"b-danger":"b-info"}">${dl<0?"Geçti":dl===0?"Bugün":dl+" gün kaldı"}</span>
        ${ex.importance===1?'<span class="badge b-danger">Yüksek öneme</span>':""}
        ${ex.targetGrade?`<span class="badge b-mut">Hedef ${esc(ex.targetGrade)}</span>`:""}</div>
      <div class="stat-line"><span class="muted">Tarih</span><span class="v">${fmtShort(ex.date)}${ex.time?" · "+esc(ex.time):""}</span></div>
      ${summary}
      ${warn}
      ${topicList}
      ${notes}`,
      footer:`<button class="btn" onclick="closeModal();gotoSubject('${ex.subjectId}')"><i data-lucide="library"></i>Dersin konuları</button>
        <button class="btn" onclick="closeModal();App.examModal('${ex.id}')"><i data-lucide="pencil"></i>Düzenle</button>
        <button class="btn btn-primary" onclick="closeModal();App.planForExam('${ex.id}')"><i data-lucide="calendar-plus"></i>Bugünün planına görev ekle</button>`});
  },
  planForExam(exId){
    const ex=examById(exId); if(!ex)return;
    if(!examTopicIds(ex)){toast("Sınavın konu listesi geçersiz; görev oluşturulamadı.","err");return;}
    const inc=examIncomplete(ex);
    if(!inc.length){toast("Bu sınavın kapsamında eksik konu kalmamış.","ok");return;}
    const t=inc[0];
    S.tasks.push({id:uid(),subjectId:ex.subjectId,topicId:t.id,title:t.title+" çalış ("+ex.title+")",
      date:todayKey(),estMinutes:Math.min(t.estMinutes||60,60),priority:ex.importance,status:"planli",type:"konu",createdAt:todayKey()});
    if(!persist())return;render();toast(`“${t.title}” bugünün planına eklendi. Kalan ${inc.length-1} konuyu Plan bölümünden sıraya diz.`,"ok",4500);
  },

  /* --- Oturumlar --- */
  startSessionModal(subjId,topicId,type){
    if(S.activeSession){toast("Zaten devam eden bir oturum var.","warn");
      App.finishSessionModal();return;}
    const subjs=S.subjects.filter(s=>!s.archived);
    if(!subjs.length){toast("Önce bir ders ekle.","warn");setRoute("subjects");return;}
    openModal({title:"Oturum başlat",body:
      fld("Ders *",`<select id="ss-subj" onchange="App.fillTopicSelect('ss-topic',this.value)">${subjs.map(s=>`<option value="${s.id}" ${subjId===s.id?"selected":""}>${esc(s.name)}</option>`).join("")}</select>`)+
      fld("Konu (isteğe bağlı)",`<select id="ss-topic"><option value="">—</option></select>`)+
      fld("Oturum türü",`<select id="ss-type">${Object.entries(SESSION_TYPES).map(([k,l])=>`<option value="${k}" ${(type||"konu")===k?"selected":""}>${l}</option>`).join("")}</select>`)+
      fld("Hedef süre (dk, isteğe bağlı)",`<input type="number" id="ss-plan" min="0" max="480" value="${S.settings.sessionLen}">`,"Kronometre zaman damgasıyla çalışır; sekme kapansa bile sayfa yenilendiğinde kaldığı yerden devam eder."),
      footer:`<button class="btn" onclick="closeModal()">Vazgeç</button>
        <button class="btn btn-primary" onclick="App.startSession()"><i data-lucide="play"></i>Başlat</button>`,
      onMount:()=>App.fillTopicSelect("ss-topic",subjId||$("#ss-subj").value,topicId)});
  },
  fillTopicSelect(selId,subjId,cur){
    const sel=$("#"+selId); if(!sel)return;
    const topics=subjId?S.topics.filter(t=>t.subjectId===subjId):[];
    sel.innerHTML=`<option value="">—</option>`+topics.map(t=>`<option value="${t.id}">${esc(t.title)}</option>`).join("");
    if(cur)sel.value=cur;
  },
  startSession(){
    const startedAt=Date.now();
    const a={subjectId:$("#ss-subj").value,topicId:$("#ss-topic").value||null,type:$("#ss-type").value,
      plannedMin:clampNum($("#ss-plan").value,0,480,S.settings.sessionLen)||null,
      startedAt,runningSince:startedAt,accumulatedMs:0,pausedAt:null};
    S.activeSession=a; if(!persist())return;
    closeModal();render();
    toast("Oturum başladı. İyi çalışmalar!","ok");
  },
  togglePause(){ const a=S.activeSession; if(!a)return;
    const now=Date.now();
    let message;
    if(a.pausedAt){
      a.runningSince=now;
      a.pausedAt=null;
      message="Devam ediliyor.";
    } else {
      a.accumulatedMs=(a.accumulatedMs||0)+(now-(a.runningSince||a.startedAt||now));
      a.pausedAt=now;
      a.runningSince=null;
      message="Duraklatıldı; süre birikmiyor.";
    }
    if(!persist())return;
    render();toast(message); },
  cancelActive(){
    confirmDialog({title:"Oturumu iptal et",confirmText:"İptal et ve kaydetme",
      message:"Devam eden oturum hiçbir yere kaydedilmeden kapatılacak. Bu işlem geri alınamaz.",
      onConfirm:()=>{S.activeSession=null;if(!persist())return;render();toast("Oturum iptal edildi.");}});
  },
  finishSessionModal(){
    const a=S.activeSession; if(!a)return;
    const t=a.topicId?topicById(a.topicId):null;
    openModal({title:"Oturumu bitir",body:
      `<div class="card" style="padding:12px;background:var(--surface2);margin-bottom:14px">
        <div class="row"><i data-lucide="check-circle-2" style="color:var(--ok)"></i>
        <b>${esc(subjName(a.subjectId)||"—")}</b>${t?`<span class="muted">· ${esc(t.title)}</span>`:""}
        <span class="mono-num" style="margin-left:auto;font-size:18px;font-weight:700">${fmtClock(activeElapsed())}</span></div>
        ${a.pausedAt?'<div class="small" style="color:var(--warn);margin-top:6px">Oturum şu an duraklatılmış durumda; duraklatılan süre sayılmaz.</div>':""}</div>`+
      `<div class="frow">${fld("Çözülen soru sayısı",`<input type="number" id="fs-qa" min="0" max="500" value="0">`)}
      ${fld("Doğru sayısı",`<input type="number" id="fs-qc" min="0" max="500" value="0">`)}</div>`+
      `<div class="err-txt" id="fs-err">Doğru sayısı çözülen soruyu geçemez.</div>`+
      (t?fld("Bu konu için tekrar planla",`<select id="fs-rev"><option value="">Hayır</option>${REVIEW_OPTIONS.map(o=>`<option value="${o.d}" ${o.d===3?"selected":""}>${o.l}</option>`).join("")}<option value="custom">Özel tarih…</option></select><input type="date" id="fs-revd" style="display:none;margin-top:6px" onchange="" placeholder="">`):"")+
      fld("Kısa yansıma (isteğe bağlı)",`<textarea id="fs-notes" rows="2" placeholder="Neyi iyi anladım, nerede takıldım?"></textarea>`),
      footer:`<button class="btn btn-danger" onclick="closeModal();App.cancelActive()">Kaydetmeden at</button>
        <button class="btn btn-primary" id="fs-save" onclick="App.saveFinishedSession()"><i data-lucide="check"></i>Oturumu kaydet</button>`,
      onMount:()=>{ const rv=$("#fs-rev"); if(rv)rv.onchange=()=>{$("#fs-revd").style.display=rv.value==="custom"?"block":"none";}; }});
  },
  saveFinishedSession(){
    if(S.saving)return;
    const qa=clampNum($("#fs-qa").value,0,500,0),qc=clampNum($("#fs-qc").value,0,500,0);
    if(qc>qa){$("#fs-err").style.display="block";return;}
    S.saving=true;
    const a=S.activeSession; const end=Date.now();
    const elapsed=activeElapsed();
    S.sessions.push({id:uid(),subjectId:a.subjectId,topicId:a.topicId,type:a.type,
      startedAt:new Date(a.startedAt).toISOString(),endedAt:new Date(end).toISOString(),
      elapsedMs:Math.max(1000,elapsed),plannedMin:a.plannedMin||null,qAttempted:qa,qCorrect:qc,
      notes:$("#fs-notes").value.trim(),demo:false});
    const t=a.topicId?topicById(a.topicId):null;
    if(t){ t.lastStudiedAt=todayKey();
      if(t.status==="baslanmadi")t.status="calisiliyor";
      if(a.type==="tekrar")t.status=t.status==="ogrenildi"?"tekrar":t.status;
      const rv=$("#fs-rev")?$("#fs-rev").value:"";
      if(rv){ const dk=rv==="custom"?($("#fs-revd").value||addDaysKey(todayKey(),3)):addDaysKey(todayKey(),parseInt(rv));
        t.nextReviewAt=dk; } }
    S.activeSession=null; delete S.saving;
    if(!persist())return;
    closeModal();render();
    toast(`Oturum kaydedildi: ${fmtClock(elapsed)}.`,"ok");
  },
  manualSessionModal(){
    const subjs=S.subjects.filter(s=>!s.archived);
    if(!subjs.length){toast("Önce bir ders ekle.","warn");setRoute("subjects");return;}
    openModal({title:"Elle oturum girişi",body:
      `<p class="small muted" style="margin-bottom:12px">Kronometre kullanmadan çalıştıysan süreyi buradan hızlıca kaydedebilirsin.</p>`+
      fld("Ders *",`<select id="ms-subj" onchange="App.fillTopicSelect('ms-topic',this.value)">${subjs.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>`)+
      fld("Konu",`<select id="ms-topic"><option value="">—</option></select>`)+
      `<div class="frow">${fld("Tür",`<select id="ms-type">${Object.entries(SESSION_TYPES).map(([k,l])=>`<option value="${k}">${l}</option>`).join("")}</select>`)}
      ${fld("Süre (dk) *",`<input type="number" id="ms-min" min="1" max="600" value="30">`)}</div>`+
      `<div class="frow">${fld("Soru sayısı",`<input type="number" id="ms-qa" min="0" max="500" value="0">`)}
      ${fld("Doğru",`<input type="number" id="ms-qc" min="0" max="500" value="0">`)}</div>`+
      `<div class="err-txt" id="ms-err">Doğru sayısı soru sayısını geçemez.</div>`+
      fld("Not",`<input id="ms-notes" maxlength="200">`),
      footer:`<button class="btn" onclick="closeModal()">Vazgeç</button>
        <button class="btn btn-primary" onclick="App.saveManualSession()"><i data-lucide="check"></i>Kaydet</button>`,
      onMount:()=>App.fillTopicSelect("ms-topic",$("#ms-subj").value)});
  },
  saveManualSession(){
    if(S.saving)return;
    const min=clampNum($("#ms-min").value,1,600,0);
    if(!min){toast("Süre en az 1 dakika olmalı.","err");return;}
    const qa=clampNum($("#ms-qa").value,0,500,0),qc=clampNum($("#ms-qc").value,0,500,0);
    if(qc>qa){$("#ms-err").style.display="block";return;}
    S.saving=true;
    const sid=$("#ms-subj").value,tid=$("#ms-topic").value||null;
    const d=parseDay(todayKey()); d.setHours(20,0,0,0);
    S.sessions.push({id:uid(),subjectId:sid,topicId:tid,type:$("#ms-type").value,
      startedAt:new Date(d.getTime()-min*60000).toISOString(),endedAt:d.toISOString(),
      elapsedMs:min*60000,plannedMin:null,qAttempted:qa,qCorrect:qc,notes:$("#ms-notes").value.trim(),demo:false});
    const t=tid?topicById(tid):null;
    if(t){t.lastStudiedAt=todayKey();if(t.status==="baslanmadi")t.status="calisiliyor";
    }
    delete S.saving; if(!persist())return;
    closeModal();render();toast("Oturum kaydedildi.");
  },
  deleteSession(id){ confirmDialog({title:"Oturum kaydını sil",message:"Bu kayıt istatistiklerden de çıkarılır.",onConfirm:()=>{
    S.sessions=S.sessions.filter(s=>s.id!==id);if(!persist())return;render();toast("Kayıt silindi.");}}); },
  logQuestionsModal(){
    const subjs=S.subjects.filter(s=>!s.archived);
    if(!subjs.length){toast("Önce bir ders ekle.","warn");setRoute("subjects");return;}
    openModal({title:"Soru çözümü kaydet",body:
      fld("Ders *",`<select id="lq-subj" onchange="App.fillTopicSelect('lq-topic',this.value)">${subjs.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>`)+
      fld("Konu (önerilir)",`<select id="lq-topic"><option value="">—</option></select>`)+
      `<div class="frow">${fld("Çözülen soru *",`<input type="number" id="lq-qa" min="1" max="500" value="10">`)}
      ${fld("Doğru *",`<input type="number" id="lq-qc" min="0" max="500" value="0">`)}</div>`+
      `<div class="err-txt" id="lq-err">Doğru sayısı çözülen soruyu geçemez.</div>`,
      footer:`<button class="btn" onclick="closeModal()">Vazgeç</button>
        <button class="btn btn-primary" onclick="App.saveQuestions()"><i data-lucide="check"></i>Kaydet</button>`,
      onMount:()=>App.fillTopicSelect("lq-topic",$("#lq-subj").value)});
  },
  saveQuestions(){
    if(S.saving)return;
    const qa=clampNum($("#lq-qa").value,1,500,0),qc=clampNum($("#lq-qc").value,0,500,0);
    if(!qa){toast("Soru sayısı en az 1 olmalı.","err");return;}
    if(qc>qa){$("#lq-err").style.display="block";return;}
    S.saving=true;
    const tid=$("#lq-topic").value||null;
    const t=tid?topicById(tid):null;
    // Çözüm oturumu olarak da kaydolur: süre tahmini değil, "soru" tipi kayıt
    S.sessions.push({id:uid(),subjectId:$("#lq-subj").value,topicId:tid,type:"soru",
      startedAt:new Date().toISOString(),endedAt:new Date().toISOString(),elapsedMs:0,plannedMin:null,
      qAttempted:qa,qCorrect:qc,notes:"",demo:false});
    if(t){t.lastStudiedAt=todayKey();
      if(t.status==="baslanmadi")t.status="calisiliyor";}
    delete S.saving; if(!persist())return;
    closeModal();render();
    toast(`${qa} soru kaydedildi · doğruluk %${pct(qc,qa)}.`,"ok");
  },

  /* --- Tekrar --- */
  reviewModal(topicId){
    const t=topicById(topicId); if(!t)return;
    openModal({title:"Tekrarı tamamla",body:
      `<p class="small muted" style="margin-bottom:12px"><b>${esc(t.title)}</b> tekrarını notları açmadan önce hatırlamayı dene. Sonra kendini değerlendir:</p>
      <div id="fb-row" class="row" style="gap:8px;margin-bottom:14px">
        ${Object.entries(FEEDBACK).map(([k,l])=>`<button class="btn" data-fb="${k}" onclick="document.querySelectorAll('#fb-row button').forEach(b=>b.style.borderColor='');this.style.borderColor='var(--accent)';document.getElementById('fb-val').value='${k}'" style="flex:1;justify-content:center">${l}</button>`).join("")}
      </div><input type="hidden" id="fb-val" value="zor">`+
      fld("Sonraki tekrar tarihi (öneri, düzenlenebilir)",`<input type="date" id="rv-next" value="${addDaysKey(todayKey(),7)}">`,
        "Kolaydı → aralık genişletilir, Zordu → 3 gün, Hatırlayamadım → 1 gün önerilir."),
      footer:`<button class="btn" onclick="closeModal()">Vazgeç</button>
        <button class="btn btn-primary" onclick="App.saveReview('${topicId}')"><i data-lucide="check"></i>Kaydet</button>`});
  },
  saveReview(topicId){
    const t=topicById(topicId); if(!t)return;
    const fb=$("#fb-val").value||"zor";
    const sug=fb==="kolay"?14:fb==="zor"?3:1;
    let next=$("#rv-next").value||addDaysKey(todayKey(),sug);
    t.nextReviewAt=next;
    if(fb==="hatirlayamadim")t.status="tekrar";
    if(fb==="kolay"&&t.confidence<5)t.confidence=Math.min(5,t.confidence+1);
    S.reviewLog.push({id:uid(),topicId,date:todayKey(),feedback:fb});
    if(!persist())return;closeModal();render();
    toast(`Tekrar kaydedildi. Sonraki tekrar: ${fmtShort(next)}.`,"ok");
  },
  rescheduleReview(topicId){
    const t=topicById(topicId); if(!t)return;
    openModal({title:"Tekrar tarihi",body:
      fld("Yeni tekrar tarihi",`<input type="date" id="rs-d" value="${t.nextReviewAt||addDaysKey(todayKey(),3)}">`),
      footer:`<button class="btn" onclick="closeModal()">Vazgeç</button>
        <button class="btn btn-primary" onclick="App.applyReschedule('${topicId}')">Kaydet</button>`});
  },
  applyReschedule(topicId){ const t=topicById(topicId);
    t.nextReviewAt=$("#rs-d").value||null; if(!persist())return;closeModal();render();toast("Tekrar tarihi güncellendi."); },
  schedulePickModal(){
    const topics=S.topics;
    if(!topics.length){toast("Önce konu ekle.","warn");setRoute("subjects");return;}
    openModal({title:"Tekrar planla",body:
      fld("Konu",`<select id="sp-topic">${topics.map(t=>`<option value="${t.id}">${esc(t.title)} — ${esc(subjName(t.subjectId)||"")}</option>`).join("")}</select>`)+
      fld("Ne zaman?",`<select id="sp-when">${REVIEW_OPTIONS.map(o=>`<option value="${o.d}">${o.l}</option>`).join("")}<option value="custom">Özel tarih…</option></select>`)+
      `<input type="date" id="sp-date" style="display:none;margin-top:6px">`,
      footer:`<button class="btn" onclick="closeModal()">Vazgeç</button>
        <button class="btn btn-primary" onclick="App.applySchedulePick()">Kaydet</button>`,
      onMount:()=>{$("#sp-when").onchange=e=>{$("#sp-date").style.display=e.target.value==="custom"?"block":"none";};}});
  },
  applySchedulePick(){
    const t=topicById($("#sp-topic").value); const w=$("#sp-when").value;
    t.nextReviewAt=w==="custom"?($("#sp-date").value||addDaysKey(todayKey(),3)):addDaysKey(todayKey(),parseInt(w));
    if(!persist())return;closeModal();render();toast("Tekrar planlandı: "+fmtShort(t.nextReviewAt)); },

  /* --- Veri --- */
  async exportJSON(){
    try{
      const data=JSON.parse(JSON.stringify(S));
      for(const question of data.questionArchive){
        if(!question.imageId)continue;
        const record=await questionImageRequest("get",question.imageId);
        if(!record||!(record.blob instanceof Blob))
          throw new Error("“"+question.topic+"” sorusunun fotoğrafı bulunamadı; yedek oluşturulmadı.");
        question.imageData=await blobToDataURL(record.blob);
      }
      const payload={app:"StudyOS",version:DATA_VERSION,exportedAt:new Date().toISOString(),data};
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
      const url=URL.createObjectURL(blob),a=document.createElement("a");
      a.href=url;a.download="studyos-yedek-"+todayKey()+".json";a.click();
      setTimeout(()=>URL.revokeObjectURL(url),0);
      toast("Yedek dosyası indirildi.");
    }catch(error){
      toast("JSON yedeği oluşturulamadı; mevcut veriler değiştirilmedi."+
        (error?.message?" "+error.message:""),"err",7000);
    }
  },
  importJSON(input){
    const file=input.files&&input.files[0]; input.value="";
    if(!file)return;
    const reader=new FileReader();
    reader.onload=()=>{
      let parsed,validated;
      try{
        parsed=JSON.parse(reader.result);
        const data=parsed&&typeof parsed==="object"&&!Array.isArray(parsed)&&parsed.data?parsed.data:parsed;
        validated=validateBackupState(data);
      }catch(e){
        toast(e instanceof SyntaxError?"Dosya geçerli bir JSON değil.":e.message||"Yedek doğrulanamadı.","err",6000);
        return;
      }
      const counts={ders:validated.subjects.length,konu:validated.topics.length,sınav:validated.exams.length,
        görev:validated.tasks.length,"oturum":validated.sessions.length,"tekrar kaydı":validated.reviewLog.length,
        "arşiv sorusu":validated.questionArchive.length,
        "soru fotoğrafı":validated.questionArchive.filter(question=>question.imageData).length};
      openModal({title:"Yedeği içe aktar",body:
        `<p class="small muted" style="margin-bottom:12px">Dosyanın yapısı, alanları ve ilişkileri doğrulandı. İçe aktarma <b>mevcut tüm verini değiştirir</b> — üzerine yazma sessizce yapılmaz. Eski yedeklerde arşiv bölümü yoksa boş arşiv kullanılır.</p>
        <div class="card" style="background:var(--surface2);padding:10px 14px">
        ${Object.entries(counts).map(([k,v])=>`<div class="stat-line"><span class="muted">${k}</span><span class="v mono-num">${v}</span></div>`).join("")}</div>
        ${parsed&&parsed.exportedAt?`<div class="help">Yedek tarihi: ${esc(new Date(parsed.exportedAt).toLocaleString("tr-TR"))}</div>`:""}`,
        footer:`<button class="btn" onclick="closeModal()">Vazgeç</button>
          <button class="btn btn-danger" id="imp-go"><i data-lucide="upload"></i>Değiştir ve içe aktar</button>`,
        onMount:()=>{$("#imp-go").onclick=()=>App.applyJSONImport(validated);}});
    };
    reader.onerror=()=>toast("Yedek dosyası okunamadı; mevcut veriler değiştirilmedi.","err",6000);
    reader.readAsText(file);
  },
  async applyJSONImport(validated){
    const button=$("#imp-go");
    if(button)button.disabled=true;
    const importRequest=++UI.backupImportRequest,prepared=[];
    const cleanupPreparedImages=async()=>{
      const failures=[];
      for(const item of prepared){
        if(!item.blob)continue;
        try{await questionImageRequest("delete",item.question.imageId);}
        catch(error){failures.push(error?.message||"fotoğraf temizlenemedi");}
      }
      if(failures.length)toast("İçe aktarılamayan bazı fotoğraflar temizlenemedi."+
        " "+failures[0],"warn",7000);
    };
    try{
      for(const question of validated.questionArchive){
        if(importRequest!==UI.backupImportRequest)return;
        if(!question.imageData){prepared.push({question:{...question,imageId:null}});continue;}
        const {blob,mime}=imageDataToBlob(question.imageData);
        await validateImportedQuestionImage(blob,mime);
        if(importRequest!==UI.backupImportRequest)return;
        prepared.push({question:{...question,imageId:uid()},blob,mime});
      }
      for(const item of prepared){
        if(importRequest!==UI.backupImportRequest){await cleanupPreparedImages();return;}
        if(!item.blob)continue;
        await questionImageRequest("put",item.question.imageId,{key:item.question.imageId,
          blob:item.blob,mime:item.mime,updatedAt:new Date().toISOString()});
        if(importRequest!==UI.backupImportRequest){await cleanupPreparedImages();return;}
      }
      if(importRequest!==UI.backupImportRequest){await cleanupPreparedImages();return;}
      const oldImageIds=S.questionArchive.map(question=>question.imageId).filter(Boolean);
      const questionArchive=prepared.map(({question})=>{
        const {imageData,...record}=question;
        return record;
      });
      S={...validated,questionArchive};
      document.documentElement.dataset.theme=S.settings.theme;
      if(!persist()){await cleanupPreparedImages();return;}
      closeModal();render();toast("Yedek geri yüklendi.");
      const retained=new Set(questionArchive.map(question=>question.imageId).filter(Boolean));
      for(const imageId of oldImageIds){
        if(retained.has(imageId))continue;
        try{await questionImageRequest("delete",imageId);}
        catch(error){toast("Yedek yüklendi ancak eski bir soru fotoğrafı temizlenemedi."+
          (error?.message?" "+error.message:""),"warn",6000);}
      }
    }catch(error){
      const cancelled=importRequest!==UI.backupImportRequest;
      await cleanupPreparedImages();
      if(cancelled)return;
      if(button)button.disabled=false;
      toast("Yedek geri yüklenemedi; mevcut veriler korunuyor."+
        (error?.message?" "+error.message:""),"err",7000);
    }
  },
  exportCSV(){
    if(!S.sessions.length){toast("Dışa aktarılacak oturum yok.","warn");return;}
    const rows=[["Tarih","Ders","Konu","Tür","Süre (dk)","Soru","Doğru","Not","Kaynak"]];
    for(const s of [...S.sessions].sort((a,b)=>a.startedAt<b.startedAt?-1:1)){
      rows.push([dayKey(new Date(s.startedAt)),subjName(s.subjectId)||s.subjectName||"—",
        topicById(s.topicId)?.title||"—",SESSION_TYPES[s.type]||s.type,
        Math.round(s.elapsedMs/60000),s.qAttempted||0,s.qCorrect||0,(s.notes||"").replace(/[\n;]/g," "),
        s.demo?"DEMO":"gerçek"]);}
    const csv="\uFEFF"+rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(";")).join("\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download="studyos-oturumlar-"+todayKey()+".csv"; a.click(); URL.revokeObjectURL(a.href);
    toast("CSV indirildi (Excel uyumlu, ; ayraçlı).");
  },
  removeDemo(){
    const n=S.sessions.filter(s=>s.demo).length;
    confirmDialog({title:"Demo verisini kaldır",confirmText:"Demo kayıtlarını sil",
      message:`Başlangıçta yüklenen <b>${n} demo oturumu</b> silinecek ve demo istatistikleri sıfırlanacak. Eklediğin dersler, konular ve kendi kayıtların korunur.`,
      onConfirm:()=>{S.sessions=S.sessions.filter(s=>!s.demo);S.settings.demoActive=false;
        if(!persist())return;render();toast("Demo verisi kaldırıldı; artık yalnızca kendi kayıtların gösteriliyor.");}});
  },
  wipeAll(){
    confirmDialog({title:"Tüm verileri sıfırla",confirmText:"Her şeyi sil",
      message:`<b>Dersler, konular, sınavlar, görevler, oturumlar, tekrar geçmişi ve soru arşivi dahil her şey silinir</b> ve boş bir çalışma alanıyla başlanır. Bu işlem geri alınamaz — önce JSON yedek alman önerilir.`,
      onConfirm:async()=>{
        const imageIds=S.questionArchive.map(question=>question.imageId).filter(Boolean);
        S=blankState();if(!persist())return;render();toast("Çalışma alanı sıfırlandı.","ok");
        for(const imageId of imageIds){
          try{await questionImageRequest("delete",imageId);}
          catch(error){toast("Arşiv sıfırlandı ancak bir soru fotoğrafı temizlenemedi."+
            (error?.message?" "+error.message:""),"warn",6000);}
        }
      }});
  },
  shiftPlan, calNav, setRange, setAnaSubj,
};
window.App=App;
