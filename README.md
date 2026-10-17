# StudyOS

StudyOS, öğrencilerin sınavlarını, ders konularını ve çalışma sürelerini tek yerde takip etmesine yardımcı olan Türkçe bir web uygulamasıdır. Arayüz ve uygulama mantığı HTML, CSS ve vanilla JavaScript ile hazırlanmıştır; bir derleme adımı yoktur.

## Özellikler

1. **Genel Bakış:** Günlük çalışma özeti, yaklaşan sınavlar ve kişiselleştirilmiş öneriler.
2. **Okul Programı:** Haftalık okul programını görüntüleme ve program görseli saklama.
3. **Dersler ve Konular:** Dersleri, konu durumlarını ve konu bazlı ilerlemeyi yönetme.
4. **Çalışma Planı:** Günlük veya haftalık görevleri planlama ve takip etme.
5. **Sınav Takvimi:** Sınav tarihlerini, kapsam konularını ve geri sayımları yönetme.
6. **Çalışma Oturumları:** Kronometreyle veya elle çalışma oturumu kaydetme.
7. **Soru Arşivi:** Çözülemeyen soruları not ve isteğe bağlı fotoğrafla saklama.
8. **İlerleme Analizi:** Oturum sürelerini ve çalışma eğilimlerini inceleme.
9. **Tekrar Merkezi:** Tekrarları planlama ve hatırlama geri bildirimlerini kaydetme.
10. **Ayarlar ve Veri:** Tercihleri düzenleme, yedek alma ve verileri yönetme.

## Nasıl çalıştırılır?

Proje klasöründe yerel HTTP sunucusu başlatın:

```sh
python3 -m http.server 8765
```

Ardından [http://localhost:8765/index.html](http://localhost:8765/index.html) adresini açın. Alternatif olarak VS Code Live Server eklentisini kullanabilirsiniz. HTML dosyasını çift tıklayıp `file://` üzerinden açmak yerine yerel sunucudan çalıştırmanız önerilir.

## Dosya yapısı

- `index.html` — Uygulama köklerini ve bağımlılık sırasına göre yüklenen klasik script'leri tanımlar.
- `css/style.css` — Tasarım sistemini, bileşen stillerini ve koyu/açık temaları içerir.
- `js/helpers.js` — DOM, metin, kimlik ve tarih/süre biçimlendirme yardımcılarını tanımlar.
- `js/constants.js` — Uygulama sabitlerini ve varsayılan/boş veri modeli yardımcılarını tanımlar.
- `js/storage.js` — localStorage ve IndexedDB okuma, yazma ve görsel yardımcılarını içerir.
- `js/demo.js` — Başlangıç örnek verisini, veri geçişlerini ve yedek doğrulamasını içerir.
- `js/state.js` — Kalıcı uygulama verisi `S` ile arayüz durumu `UI` değerlerini başlatır.
- `js/derived.js` — Ders, konu, sınav, tekrar ve oturum verilerinden türetilen hesaplamaları yapar.
- `js/suggest.js` — Veriye dayalı, kural tabanlı çalışma önerileri üretir.
- `js/ui-core.js` — Ortak modal/bildirim altyapısını, gezinmeyi ve uygulama kabuğunu yönetir.
- `js/views/overview.js` — Genel Bakış ekranını oluşturur.
- `js/views/subjects.js` — Dersler ve Konular ekranını oluşturur.
- `js/views/planner.js` — Çalışma Planı ekranını oluşturur.
- `js/views/exams.js` — Sınav Takvimi ekranını oluşturur.
- `js/views/sessions.js` — Çalışma Oturumları ekranını ve canlı kronometreyi oluşturur.
- `js/views/analytics.js` — İlerleme Analizi ekranını oluşturur.
- `js/views/reviews.js` — Tekrar Merkezi ekranını oluşturur.
- `js/views/questions.js` — Soru Arşivi ekranını oluşturur.
- `js/views/settings.js` — Ayarlar, okul programı ve veri yönetimi ekranlarını oluşturur.
- `js/actions.js` — Arayüzdeki eylemleri ve `App` nesnesini tanımlar.
- `js/main.js` — Olayları bağlar ve uygulamanın ilk görünümünü başlatır.

JavaScript dosyaları `index.html` içinde bağımlılık sırasıyla, `defer` kullanılmadan yüklenir. Böylece inline olay işleyicilerinin eriştiği global isimler klasik script ortamında kullanılabilir.

## Veri nerede saklanır?

Uygulama verileri tarayıcının `localStorage` alanında `studyos-data` anahtarıyla, okul programı ve soru fotoğrafları ise `studyos-media` adlı IndexedDB veritabanında saklanır. Tarayıcı verileri temizlenirse bu cihazdaki uygulama kayıtları ve görseller silinebilir. Önemli verileri korumak veya başka bir kurulumda geri yüklemek için **Ayarlar → Yedekleme ve geri yükleme** bölümünden JSON yedeği alın ve gerektiğinde geri yükleyin.

## Yol haritası

Sezon 2'de StudyOS'un mobil sürümünün React Native ile geliştirilmesi planlanmaktadır.

## Geliştirici notları

- Uygulama modüllerinde mevcut numaralı bölüm yorumları geleneğini koruyun.
- Commit mesajları değişikliği kısa ve açık biçimde tarif etmelidir.
- Refactor ve bakım değişikliklerinde temel ilke, davranışı değiştirmeden kodu düzenlemek ve anlaşılır kılmaktır.
