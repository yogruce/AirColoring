# Antigravity Air Coloring Pro — Türkçe Kullanım Kılavuzu

**Antigravity Air Coloring Pro**, web kamerası üzerinden gerçek zamanlı el ve parmak takibi (`MediaPipe HandLandmarker`) ile havada çizim yapmanızı sağlayan ve çizimlerinizi yapay zeka (`Google Gemini API`, `Fal.ai`, `Replicate`, `ComfyUI` veya çevrimdışı `Demo Simulation`) ile yüksek kaliteli görsellere dönüştüren etkileşimli bir kiosk ve stüdyo uygulamasıdır.

---

## 1. Sistem Gereksinimleri

- **Node.js** 18+ (önerilen 20+) ve **npm**
- **Web Kamerası** (Windows / macOS / Linux UVC uyumlu fiziksel kamera)
- **Güncel Tarayıcı:** Google Chrome, Microsoft Edge veya Mozilla Firefox (`http://localhost:5173` üzerinde kamera erişimi desteklenir)
- *(İsteğe bağlı)* AI render için **Google Gemini API Key** (`GEMINI_API_KEY`) — [Google AI Studio](https://aistudio.google.com/apikey) üzerinden alınabilir.

---

## 2. Kurulum ve Çalıştırma

### Tek Tıkla Kurulum ve Başlatma (Önerilen — Windows)

Projeyi indirdikten sonra klasörün içindeki şu dosyalardan birine **çift tıklamanız** yeterlidir:

- **`Kur_ve_Baslat.bat`**: Node.js yoksa `winget` üzerinden otomatik kurar, `.env` dosyasını oluşturur (isterseniz `GEMINI_API_KEY` girmenizi ister, boş bırakırsanız Demo moduyla açar), `npm install` + `npm run build` adımlarını tamamlar ve uygulamayı `http://localhost:3001` adresinde tarayıcıda açar.
- **`Kiosk_Baslat.bat`**: Aynı tek tık kurulumu tamamlayıp tarayıcıyı doğrudan **tam ekran Kiosk modunda (`--kiosk`)** başlatır.
- **macOS / Linux için:** Terminalde `./kurulum.sh` çalıştırabilirsiniz.

### Manuel Kurulum (Geliştirici Modu)

### Adım 1: Bağımlılıkları Yükleyin

```bash
npm install
```

### Adım 2: Ortam Değişkenlerini Ayarlayın (`.env`)

`.env.example` dosyasını `.env` olarak kopyalayın ve kullanmak istediğiniz sağlayıcının anahtarını ekleyin:

```env
PORT=3001
GEMINI_API_KEY=AIza...
# İsteğe bağlı alternatif sağlayıcılar:
FAL_KEY=
REPLICATE_API_TOKEN=
COMFYUI_URL=http://127.0.0.1:8188
```

> **Not:** API anahtarı girmezseniz bile uygulama **`Demo Simulation`** modu ile çevrimdışı örnek görsel önizlemesi üretebilir. Ayrıca arayüzdeki **AI Config** penceresinden oturum bazlı API anahtarı da girilebilir.

### Adım 3: Geliştirme Sunucusunu Başlatın

```bash
npm run dev
```

Bu komut iki servisi birlikte başlatır:
- **Ön Yüz (Vite):** `http://localhost:5173/`
- **Arka Uç API (Express):** `http://localhost:3001` (`/api/health` ve `/api/render`)

### Üretim (Kiosk / Production) Modu

```bash
npm run build
```

Ardından Windows PowerShell veya Linux/macOS kabuğunda `NODE_ENV=production` ile başlatın:

```powershell
$env:NODE_ENV="production"; npm start
```

Uygulama tek port üzerinden (`http://localhost:3001`) servis edilir.

---

## 3. Arayüz ve Çizim Modları

### Üst Başlık Çubuğu (Top Header)
- **Durum Göstergesi:**
  - `CAMERA ACTIVE / GESTURE TRACKING ON`: Kamera ve yapay zeka el takibi aktif. Algılanan el sayısı (`HANDS`) ve aktif jest (`IDLE`, `HOVER`, `DRAW`, `PINCH`, `ERASE`, `FRAME_RENDER`) canlı gösterilir.
  - `MOUSE / TOUCH STUDIO MODE (NO CAMERA)`: Kamera kapalıyken veya erişilemediğinde fare/dokunmatik ekran ile tuvalde doğrudan çizim yapılabilir.
- **Kamera Seçici & Kontroller:** Birden fazla kamera varsa açılır listeden fiziksel kamerayı seçebilirsiniz. **`Retry Cam`** kamerayı yeniden başlatır, **`Cam Off` / `Cam On`** kamerayı başka bir uygulamaya bırakmak için kapatıp açar.
- **`Layer 2`:** Çizimin yalnızca arka plan temizlenmiş saf eskiz katmanını veya `Kişi + Çizim` birleşik karesini önizlemenizi sağlar.
- **`AI Config`:** Yapay zeka sağlayıcısı, API anahtarı, tema ve hassasiyet ayarlarını açar.
- **Tam Ekran (`Maximize`):** Kiosk kullanımında tarayıcıyı tam ekrana alır.

### 3 Farklı Havada Çizim Tetikleme Modu (`DRAW TRIGGER`)

1. **`Bas-Çiz` (Varsayılan — Dokunmatik Kiosk Modu):**
   - Klavyesi olmayan dokunmatik kiosk ekranları için tasarlanmıştır.
   - Sol alt köşedeki **`BASILI TUT — HAVADA ÇİZ`** butonuna bir elinizle basılı tutarken (veya bilgisayarda `Space` tuşuna basılı tutarken) diğer elinizin işaret parmağıyla havada çizim yapın.
   - Parmağınızı/tuşu bıraktığınız anda çizim durur ve güvenli **Hover** moduna dönersiniz.
2. **`Pinch Pen`:**
   - Başparmak ile işaret parmağınızı birbirine yaklaştırıp birleştirdiğinizde çizim başlar; açtığınızda çizim durur.
3. **`1 Finger` (`Strict 1-Finger`):**
   - Yalnızca işaret parmağınız dik, diğer parmaklarınız kapalıyken (3 kare kararlılık doğrulamasıyla) çizim yapar.

### Ortak El Hareketleri (Tüm Modlarda)
- **5 Parmak Açık (Açık Avuç):** Bölgesel silgi olarak çalışır ve çizgileri temizler.
- **UI Üzerinde Bekleme / Pinch Tıklama:** Sağ panel veya butonların üzerine hava imleciyle gelip başparmak+işaret parmağını kıstırarak (pinch) butonlara dokunmadan tıklayabilirsiniz.
- **`AI RENDER / TRANSFORM` Üzerinde 2 Saniye Bekleme:** İmleci butonun üzerinde 2 saniye tutmak AI render işlemini başlatır.
- **Çift El Çerçeve (`2-Hand Frame`):** İki elinizi L-çerçeve şeklinde kadraja tutup ~1.4 saniye bekletirseniz otomatik AI render tetiklenir.

---

## 4. Sağ Kontrol Paneli ve Yapay Zeka Render Ayarları

- **Araçlar:** Kalem (`Draw`), Kova Doldurma (`Bucket`), Silgi (`Eraser`), Geri Al (`Undo`, 25 adım), Temizle (`Clear`)
- **Renk & Fırça Boyutu:** Gradyan renk seçici, hızlı neon renk paleti ve piksel boyut kaydırıcısı
- **Render Temaları (`RENDER THEME`):**
  - **Fotorealistik Gelecek:** Organik beyaz mimari, güneş panelleri, yeşil çatılar ve altın saat ışığı
  - **Cyberpunk Neon Sci-Fi:** Yağmurlu gece metropolü, elektrik mavisi ve magenta neon yansımalar
  - **Solarpunk Anime (Ghibli):** Suluboya/guaj el boyaması anime doğa ve eko-yapılar
  - **3D Konsept Maket (Octane):** Stüdyo ışıklı pürüzsüz seramik/akrilik 3D maket estetiği
- **Sahne Modu (`Sahne: Kişi + Çizim` / `Sadece Çizim`):**
  - **`Kişi + Çizim` (Açık):** Kameradaki kişi, kıyafet ve ortam korunarak havadaki çizim gerçekçi 3D nesneye/mimariye dönüştürülür.
  - **`Sadece Çizim` (Kapalı):** Yalnızca izole çizim katmanı (`Layer 2`) üzerinden sıfırdan sahne üretilir.

### Sonuç Ekranı (Render Modal)
- **Split Karşılaştırma Kaydırıcısı:** Orijinal eskiz/sahne ile AI render çıktısını yan yana sürükleyerek karşılaştırın.
- **`Project as AR Overlay on Camera`:** Üretilen AI görselini canlı kamera görüntüsünün üzerine AR projeksiyonu olarak bindirir.
- **`Download Sketch` / `Download AI Render`:** Hem çizimi hem de AI çıktısını PNG/JPEG olarak indirir.

---

## 5. Kiosk ve Hassasiyet İpuçları (`AI Config`)

- **Jitter Deadzone (`minMoveThreshold`):** Küçük el titremelerini yok sayar (varsayılan `1.5px`). Çok titrek ortamlarda `2.5px – 3.5px` aralığına çıkarın.
- **EMA Smoothing (`smoothingAlpha`):** Çizgi yumuşatma katsayısı (varsayılan `0.55`). Düşük değerler daha pürüzsüz ancak hafif gecikmeli çizgi üretir.
- **Yüz / Sakal Koruması:** Uygulama `FaceDetector` + anatomik avuç oranı kontrolü kullanarak yüz veya sakal bölgesindeki yanlış el algılamalarını otomatik bastırır.

---

## 6. Sık Karşılaşılan Sorunlar ve Çözümleri

| Sorun | Olası Neden | Çözüm |
| :--- | :--- | :--- |
| **Kamera görüntüsü donuyor veya siyah ekrana düşüyor** | Windows USB 2.0 kamera sürücüsü veya tarayıcı `VideoCaptureService` kare akışını durdurmuş olabilir | Uygulama 4.5 sn kare ilerlemezse otomatik yeniden bağlanmayı dener. Düzelmezse **`Kamerayı Yeniden Dene`** butonuna basın veya **`Cam Off` -> `Cam On`** yapın. |
| **Tarayıcıda yalnızca `OBS Virtual Camera` görünüyor** | Gömülü tarayıcı (ör. IDE webview) fiziksel USB kamerayı önbellekten düşürmüş olabilir | Uygulamayı **Chrome / Edge / Firefox** ile `http://localhost:5173` adresinden açın veya gömülü pencereyi tamamen kapatıp yeniden başlatın. |
| **Kamera başka uygulama tarafından kullanılıyor (`NotReadableError`)** | Zoom, Teams, OBS veya başka bir tarayıcı sekmesi kamerayı tutuyor | Diğer tarayıcı sekmelerinde **`Cam Off`** yapın veya kamera kullanan uygulamaları kapatıp **`Kamerayı Yeniden Dene`** butonuna tıklayın. |
| **`GEMINI_API_KEY` eksik hatası** | `.env` dosyasında veya `AI Config` içinde anahtar tanımlı değil | `.env` dosyasına `GEMINI_API_KEY=...` ekleyip sunucuyu yeniden başlatın, `AI Config` alanına yapıştırın veya **`Run Demo Preview`** ile anahtarsız test edin. |
| **Sakal / yüz yakınında istemsiz nokta oluşuyor** | Düşük ışıkta el modeli yüz konturunu el sanabiliyor | Ortam ışığını artırın, kameraya bir adım uzak durun ve kiosk kullanımı için **`Bas-Çiz`** modunu seçin. |
