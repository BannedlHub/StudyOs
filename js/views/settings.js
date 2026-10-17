/*
 * Ayarlar ekranını ve yedekleme/veri yönetimi arayüzünü içerir.
 * UI çekirdeği ve depolamaya dayanır.
 * ROUTES üzerinden çağrılır.
 */
"use strict";

/* ---------- 18) Bölüm: Ayarlar ---------- */
function renderSchoolSchedule(v){
  if(UI.schoolScheduleUrl){URL.revokeObjectURL(UI.schoolScheduleUrl);UI.schoolScheduleUrl=null;}
  const request=++UI.schoolScheduleRequest;
  v.innerHTML=pageHead("Okul Programı","Haftalık ders programı görselini bu tarayıcıda sakla")+
    `<input type="file" id="school-schedule-file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" hidden onchange="App.uploadSchoolSchedule(this)">
    <div class="card" id="school-schedule-content" aria-live="polite">
      <div class="empty"><i data-lucide="loader-circle"></i><b>Program yükleniyor</b><p>Kaydedilmiş görsel kontrol ediliyor…</p></div>
    </div>`;
  loadSchoolSchedule(request);
}
async function loadSchoolSchedule(request){
  const target=()=>UI.route==="school-schedule"&&request===UI.schoolScheduleRequest?
    $("#school-schedule-content"):null;
  try{
    const record=await schoolScheduleRequest("get");
    const content=target(); if(!content)return;
    if(!record){
      content.innerHTML=`<div class="empty"><i data-lucide="calendar-days"></i><b>Henüz okul programı eklenmedi</b>
        <p>Haftalık programının JPG, PNG veya WebP fotoğrafını ya da ekran görüntüsünü yükleyebilirsin. Görsel yalnızca bu tarayıcıda saklanır; JSON yedeğine eklenmez.</p>
        <button class="btn btn-primary" style="margin-top:14px" onclick="App.chooseSchoolScheduleImage()"><i data-lucide="image-plus"></i>Program görseli yükle</button></div>`;
    }else if(!(record.blob instanceof Blob)){
      throw new Error("Kaydedilmiş okul programı görsel verisi okunamadı.");
    }else{
      const url=URL.createObjectURL(record.blob);
      if(!target()){URL.revokeObjectURL(url);return;}
      UI.schoolScheduleUrl=url;
      const updated=Number.isFinite(Date.parse(record.updatedAt||""))?
        new Date(record.updatedAt).toLocaleString("tr-TR"):"";
      content.innerHTML=`<div class="spread" style="margin-bottom:12px">
          <div><h3 style="font-size:14.5px">${esc(record.name||"Haftalık okul programı")}</h3>
          <div class="small muted">${updated?"Son güncelleme: "+esc(updated):"Kaydedilmiş program görseli"}</div></div>
          <div class="school-upload-actions">
            <button class="btn btn-sm" ${UI.schoolScheduleSaving?"disabled":""} onclick="App.chooseSchoolScheduleImage()"><i data-lucide="refresh-cw"></i>Görseli değiştir</button>
            <button class="btn btn-sm btn-danger" ${UI.schoolScheduleSaving?"disabled":""} onclick="App.deleteSchoolSchedule()"><i data-lucide="trash-2"></i>Görseli kaldır</button>
          </div>
        </div>
        <div class="school-image-frame"><img src="${url}" alt="Haftalık okul ders programı"></div>
        <div class="help" style="margin-top:10px">Görselin özgün en-boy oranı korunur. En fazla 15 MB; JPG, JPEG, PNG ve WebP desteklenir.</div>`;
    }
    lucide.createIcons();
  }catch(error){
    const content=target(); if(!content)return;
    content.innerHTML=`<div class="empty"><i data-lucide="circle-alert"></i><b>Okul programı yüklenemedi</b>
      <p>${esc(error?.message||"Tarayıcı görsel deposuna erişemedi.")}</p>
      <button class="btn" style="margin-top:12px" onclick="renderSchoolSchedule($('#view'))"><i data-lucide="refresh-cw"></i>Yeniden dene</button></div>`;
    lucide.createIcons();
  }
}

function renderSettings(v){
  const st=S.settings;
  const days=[...Array(7)].map((_,i)=>({i,n:DAY_SHORT[(i+st.weekStart)%7]}));
  v.innerHTML=pageHead("Ayarlar ve Veri Yönetimi",`Veriler yalnızca bu tarayıcıda saklanır; cihazlar arasında otomatik eşitlenmez${storageOK?"":" — şu an depolama kullanılamıyor"}`)+
  `<div class="set-grid">
    <div class="card"><h3><i data-lucide="user"></i>Profil</h3>
      ${fld("Görünmek istediğin ad (isteğe bağlı)",`<input id="s-name" value="${esc(st.name)}" placeholder="örn. Deniz" maxlength="30">`,"Boş bırakırsan selamlama saat bazlı olur.")}
      ${fld("Tema",`<select id="s-theme"><option value="dark" ${st.theme==="dark"?"selected":""}>Karanlık</option><option value="light" ${st.theme==="light"?"selected":""}>Aydınlık</option></select>`)}
      ${fld("Hafta başlangıcı",`<select id="s-week"><option value="1" ${st.weekStart===1?"selected":""}>Pazartesi</option><option value="0" ${st.weekStart===0?"selected":""}>Pazar</option></select>`)}
      ${fld("Tarih gösterimi",`<select id="s-datestyle"><option value="uzun" ${st.dateStyle==="uzun"?"selected":""}>Uzun (9 Kasım 2026 Pazartesi)</option><option value="kısa" ${st.dateStyle==="kısa"?"selected":""}>Kısa (9 Kas)</option></select>`)}
    </div>
    <div class="card"><h3><i data-lucide="clock"></i>Çalışma alışkanlıkları</h3>
      ${fld("Günlük süre hedefi (dakika)",`<input type="number" id="s-target" min="15" max="720" value="${st.dailyTargetMin}">`)}
      ${fld("Günlük plan üst sınırı (dakika)",`<input type="number" id="s-max" min="30" max="900" value="${st.dailyMaxMin}">`,"Planner bu sınırı aştığında uyarır; engellemez.")}
      ${fld("Varsayılan oturum uzunluğu (dk)",`<input type="number" id="s-sess" min="10" max="180" value="${st.sessionLen}">`)}
      ${fld("Varsayılan mola (dk)",`<input type="number" id="s-break" min="0" max="60" value="${st.breakLen}">`)}
      ${fld("Sınav uyarı eşiği (gün)",`<input type="number" id="s-warn" min="1" max="30" value="${st.examWarnDays}">`,'Kalan gün bu değerin altına inince sınav "yakın" olarak vurgulanır.')}
    </div>
    <div class="card"><h3><i data-lucide="calendar-check"></i>Çalışma günlerin</h3>
      ${fld("Çalıştığın günler",`<div class="day-toggles">${days.map(d=>`<button class="day-tg ${st.studyDays.includes(d.i)?"on":""}" onclick="App.togDay('studyDays',${d.i})">${d.n}</button>`).join("")}</div>`)}
      ${fld("Dinlenme günleri",`<div class="day-toggles">${days.map(d=>`<button class="day-tg ${st.restDays.includes(d.i)?"on":""}" onclick="App.togDay('restDays',${d.i})">${d.n}</button>`).join("")}</div>`,"Dinlenme günleri planda etiket olarak görünür; görev eklemeni engellemez.")}
      <button class="btn btn-primary" onclick="App.saveSettings()"><i data-lucide="check"></i>Ayarları kaydet</button>
    </div>
    <div class="card"><h3><i data-lucide="database"></i>Yedekleme ve geri yükleme</h3>
      <p class="small muted" style="margin-bottom:12px">Tüm verilerin tek bir JSON dosyasında dışa aktarılabilir. İçe aktarmadan önce içerik doğrulanır ve önizleme gösterilir; mevcut verin onayın olmadan asla değişmez.</p>
      <div class="row">
        <button class="btn" onclick="App.exportJSON()"><i data-lucide="download"></i>JSON yedek al</button>
        <button class="btn" onclick="$('#imp-file').click()"><i data-lucide="upload"></i>Yedeği geri yükle</button>
        <input type="file" id="imp-file" accept=".json,application/json" style="display:none" onchange="App.importJSON(this)">
        <button class="btn" onclick="App.exportCSV()"><i data-lucide="file-text"></i>Oturumları CSV aktar</button>
      </div>
    </div>
    <div class="card"><h3><i data-lucide="trash-2"></i>Veri yönetimi</h3>
      ${st.demoActive?`<div class="row small" style="margin-bottom:10px"><span class="badge b-demo">DEMO</span><span class="muted">Başlangıçta yüklenen örnek oturumlar hâlâ kayıtlarda.</span></div>
      <button class="btn" style="margin-bottom:8px" onclick="App.removeDemo()"><i data-lucide="eraser"></i>Demo verisini kaldır</button>`:""}
      <button class="btn btn-danger" onclick="App.wipeAll()"><i data-lucide="alert-triangle"></i>Tüm verileri sıfırla</button>
      <div class="help">Sıfırlama, dersler ve konular dahil tüm kayıtları ve soru arşivini siler. Silinen veri geri alınamaz.</div>
    </div>
  </div>`;
}
