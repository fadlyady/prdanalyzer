## Pre-Condition & Authentication Guard

### 1. Verifikasi autentikasi akun & langganan aktif Everpro Chat
1. User login ke dashboard Everpro menggunakan akun terdaftar dengan paket subscription aktif.
2. User membuka halaman `/chat` atau navigasi ke modul Everpro Chat.
3. User melihat dashboard Everpro Chat terbuka normal tanpa banner subscription expired.

### 2. Verifikasi pencegahan akses bagi akun dengan subscription expired / inaktif
1. User login ke dashboard Everpro menggunakan akun dengan status subscription expired/inactive.
2. User mengakses direct URL `/pengaturan-alur-chat`.
3. User melihat modal/banner peringatan bahwa subscription tidak aktif dan tombol CTA perpanjangan paket.

---

## Role-Based Access Control (RBAC)

### 3. Verifikasi full access role Owner pada menu Pengaturan Alur Chat & AI Agent
1. User login sebagai Owner.
2. User membuka halaman `/pengaturan-alur-chat`.
3. User melihat daftar alur chat, tombol `Tambah Alur Chat`, dan toggle status aktif.
4. User membuka halaman `/ai-agent` dan mengklik `Konfigurasi`.
5. User melihat seluruh form konfigurasi AI Agent dapat dimodifikasi dan disimpan.

### 4. Verifikasi full access role Supervisor pada menu Pengaturan Alur Chat & AI Agent
1. User login sebagai Supervisor.
2. User membuka halaman `/pengaturan-alur-chat`.
3. User membuat alur baru atau memodifikasi alur eksisting.
4. User klik `Simpan`.
5. User melihat toast sukses dan data alur terupdate di tabel.

### 5. Verifikasi pembatasan akses role CS Agent terhadap menu Pengaturan Alur Chat (Hidden / 403 Forbidden)
1. User login sebagai CS Agent (Closing / Operational).
2. User memeriksa sidebar navigasi menu.
3. User memastikan menu `Pengaturan Alur Chat` dan `AI Agent` tidak tampil (hidden).
4. User mengakses direct URL `/pengaturan-alur-chat`.
5. User melihat halaman dialihkan atau muncul pesan `403 Forbidden: Anda tidak memiliki akses ke halaman ini`.

### 6. Verifikasi kewenangan CS Agent untuk melakukan aksi Ambil Alih Chat pada Chat Room
1. User login sebagai CS Agent.
2. User membuka halaman `/chatroom`.
3. User memilih percakapan aktif yang sedang ditangani oleh AI Agent.
4. User melihat tombol overlay `Ambil Alih Chat`.
5. User klik tombol `Ambil Alih Chat`.
6. User melihat status alur berhenti dan input box chat terbuka aktif untuk penanganan manual.

---

## Modul 1: Pengaturan Alur Chat List & Column Structure (User Story 1)

### 7. Verifikasi perubahan nama fitur dari "Automasi" menjadi "Pengaturan Alur Chat"
1. User login sebagai Owner/Supervisor.
2. User memeriksa label menu di sidebar navigasi.
3. User memastikan label menu tertulis `Pengaturan Alur Chat`.
4. User klik menu `Pengaturan Alur Chat`.
5. User melihat judul header halaman menampilkan `Pengaturan Alur Chat`.

### 8. Verifikasi struktur dan kelengkapan kolom tabel pada list Pengaturan Alur Chat
1. User login sebagai Owner/Supervisor.
2. User membuka halaman `/pengaturan-alur-chat`.
3. User melihat tabel daftar alur memuat kolom:
   - `Name`
   - `Assigned to phone number`
   - `Lead source` (CTWA, LPWA, Balasan broadcast, Organic)
   - `Keyword source` (Default / Custom)
   - `First responders` (Human Agent, AI Agent, atau Template)
   - `Involve human from the start of conversation` (Checklist Y/N)
   - `Active/inactive` (Toggle Y/N).

---

## Modul 2: Primary Default Flow & Multi-trigger Logic (User Story 2)

### 9. Verifikasi pembentukan otomatis Primary Default Flow saat onboarding nomor WABA baru
1. User menyelesaikan proses onboarding nomor WhatsApp baru `123`.
2. User membuka halaman `/pengaturan-alur-chat`.
3. User melihat alur baru otomatis tercipta dengan nama `Tim CS default flow`.
4. User memastikan parameter alur default:
   - Phone number: `123`
   - Source: `default`
   - Keyword: `default`
   - First response: `Human agent`
   - Involve human from the start: `yes`
   - Active: `yes`
   - Response: `transfer directly to divisi utama`.

### 10. Verifikasi proteksi Primary Default Flow dari tindakan edit, deaktivasi, dan hapus
1. User login sebagai Owner/Supervisor.
2. User membuka halaman `/pengaturan-alur-chat`.
3. User mencari baris alur `Tim CS default flow` (Primary Default).
4. User melihat toggle Active dalam keadaan disabled (terkunci ON).
5. User melihat tombol `Edit` dan `Hapus` pada row tersebut tidak tersedia / disabled dengan tooltip proteksi sistem.

### 11. Verifikasi override Primary Default Flow saat toggle AI Autoreply (agentic) diaktifkan
1. User membuka halaman `/ai-agent`.
2. User memilih `AI Agent A` yang telah di-assign ke nomor `123`.
3. User menggeser toggle `AI Auto-reply (agentic)` menjadi `ON`.
4. User klik `Simpan`.
5. User membuka halaman `/pengaturan-alur-chat`.
6. User melihat `Primary Default Flow` pada nomor `123` ter-override menjadi:
   - Name: `AI Agent A default flow`
   - First response: `AI Agent`
   - Involve human from the start: `no`
   - Active: `yes`
   - Response: `transfer directly to AI Agent A`.

### 12. Verifikasi pengembalian Primary Default Flow ke Tim CS saat toggle AI Autoreply dimatikan
1. User membuka halaman `/ai-agent` untuk `AI Agent A` pada nomor `123`.
2. User menggeser toggle `AI Auto-reply (agentic)` menjadi `OFF`.
3. User konfirmasi peringatan modal dan klik `Simpan`.
4. User membuka halaman `/pengaturan-alur-chat`.
5. User melihat Primary Default Flow otomatis kembali menjadi `Tim CS default flow` dengan First response: `Human agent` dan target `divisi utama`.

### 13. Verifikasi penghapusan otomatis Primary Default Flow saat nomor WABA dihapus dari akun
1. User masuk ke menu pengaturan integrasi WABA.
2. User menghapus nomor WABA `123` dari akun Everpro.
3. User membuka halaman `/pengaturan-alur-chat`.
4. User memastikan alur `Tim CS default flow` dan seluruh alur terkait nomor `123` sudah terhapus dari daftar.

### 14. Verifikasi pencegahan duplikasi kombinasi trigger pertama (Phone + Source + Keyword)
1. User membuka halaman `/pengaturan-alur-chat`.
2. User klik `Tambah Alur Chat`.
3. User memilih nomor telepon `123`, memilih Source `C`, dan mengisi Keyword `PROMO`.
4. (Asumsi: Alur dengan nomor `123`, Source `C`, dan Keyword `PROMO` sudah ada sebelumnya).
5. User klik `Simpan`.
6. User melihat sistem mencegah penyimpanan dan menampilkan pesan error `flow with Phone number 123, source C, and Keyword PROMO is already exist`.

### 15. Verifikasi evaluasi prioritas trigger: Source over Keyword (Lead Source match > Keyword match)
1. User mengonfigurasi alur pada nomor `123`:
   - Alur X: Source `default`, Keyword `A`
   - Alur Y: Source `B`, Keyword `default`.
2. Customer mengirimkan pesan WhatsApp ke nomor `123` dengan Lead Source `B` dan teks pesan `A`.
3. User memeriksa log percakapan di Chat Room.
4. User melihat sistem mengeksekusi `Alur Y` (karena kecocokan Lead Source `B` lebih diprioritaskan dibanding Keyword `A`).

### 16. Verifikasi pencocokan exact match & case-insensitive pada custom keyword alur chat
1. User membuat alur dengan Source `default` dan Keyword `INFO DISKON`.
2. Customer mengirim pesan dengan teks persis `info diskon` (lowercase).
3. User melihat alur berhasil terpicu (case-insensitive exact match).
4. Customer lain mengirim pesan dengan teks `halo saya mau info diskon dong` (partial match).
5. User melihat alur TIDAK terpicu (karena exact match) dan pesan dialihkan ke fallback/default flow.

### 17. Verifikasi pembuatan otomatis default keyword pair saat membuat flow custom keyword
1. User membuka form pembuatan alur pada nomor `123`.
2. User memilih Source `C`, mengaktifkan toggle `Gunakan Keyword`, dan memasukkan Keyword `D`.
3. User klik `Simpan`.
4. User melihat alur `Z` berhasil terbuat.
5. User melihat sistem otomatis membuat alur pendamping `Z - default keyword` dengan:
   - Source: `C`
   - Keyword: `default`
   - First response: `Human agent`
   - Involve human from the start: `yes`
   - Active: `yes`
   - Response: `transfer directly to divisi utama`.
6. User memastikan field Name, Phone, Source, Keyword, dan Status terkunci (read-only) pada alur default pair tersebut.

### 18. Verifikasi eksekusi alur default keyword pair pada pesan dengan keyword tak cocok
1. Alur `Z` (Source `C`, Keyword `D`) dan alur `Z - default keyword` (Source `C`, Keyword `default`) aktif pada nomor `123`.
2. Customer mengirimkan pesan WhatsApp dari Lead Source `C` dengan teks `E` (keyword tidak terdaftar di alur kustom).
3. User memeriksa room percakapan.
4. User melihat percakapan dieksekusi oleh alur `Z - default keyword` dan diteruskan langsung ke Tim CS divisi utama.

### 19. Verifikasi sinkronisasi status aktif/inaktif dan penghapusan otomatis flow default keyword pair
1. User membuka daftar `/pengaturan-alur-chat`.
2. User menonaktifkan toggle Active pada alur induk `Z`.
3. User melihat alur `Z - default keyword` otomatis berubah menjadi Inactive.
4. User mengaktifkan kembali toggle Active pada alur induk `Z`.
5. User melihat alur `Z - default keyword` otomatis kembali Active.
6. User menghapus alur `Z` (atau mematikan toggle custom keyword pada alur `Z`).
7. User melihat alur `Z - default keyword` otomatis terhapus dari daftar alur.

---

## Modul 3: Quick Setup & Activation of AI Agent (User Story 3)

### 20. Verifikasi navigasi form konfigurasi AI Agent (Tab Basic Info, Knowledge, Style)
1. User login sebagai Owner/Supervisor.
2. User membuka halaman `/ai-agent`.
3. User klik tombol `Konfigurasi` pada salah satu AI Agent di daftar.
4. User melihat form konfigurasi memuat 3 tab: `Basic Info`, `Knowledge`, dan `Communication Style`.
5. User mengklik setiap tab dan memastikan form ter-load sempurna tanpa error.

### 21. Verifikasi penugasan nomor WhatsApp tunggal (Single WABA Assignment) pada AI Agent
1. User membuka form konfigurasi `AI Agent A`.
2. User klik dropdown `Pilih nomor Whatsapp`.
3. User memilih nomor `123` dan klik `Simpan`.
4. User membuka kembali dropdown penugasan nomor.
5. User memastikan hanya dapat memilih 1 nomor (single select, tidak bisa multi-select).
6. User memilih nomor `456` dan klik `Simpan`.
7. User melihat nomor `AI Agent A` berhasil diperbarui menjadi `456` dan nomor `123` terlepas.

### 22. Verifikasi pesan peringatan prioritas alur Chat Flow saat mengaktifkan AI Autoreply
1. Alur Chat Flow `X` terdaftar pada nomor `123` dengan trigger Source `A` dan `B`.
2. User membuka konfigurasi `AI Agent A` yang ditugaskan ke nomor `123`.
3. User mengaktifkan toggle `AI Auto-reply (Agentic)`.
4. User melihat modal peringatan: `New chat with matching conditions will follow the first response defined in Chat flow/Automation. AI agent A can still serve the chat if defined as a transfer destination.`.
5. User klik `Lanjutkan`.
6. Pesan masuk dengan Source `A` dieksekusi oleh Chat Flow `X`; pesan masuk dengan Source `C` ditangani oleh AI Agent `A`.

---

## Modul 4: Transfer Conditions & Fallback Settings (User Story 4)

### 23. Verifikasi kewajiban pengisian Transfer Condition saat toggle AI Autoreply aktif
1. User membuka form konfigurasi AI Agent.
2. User mengaktifkan toggle `AI Auto-reply (Agentic)` ke `ON`.
3. User melihat section `Transfer Condition` muncul secara mandatory.
4. User mengosongkan definisi intent dan tujuan transfer, lalu klik `Simpan`.
5. User melihat error validasi wajib isi pada field intent dan tujuan transfer.
6. User mengisi intent `Tanya Stok` dan memilih tujuan `Divisi Sales`, lalu klik `Simpan`.
7. User melihat konfigurasi transfer condition berhasil tersimpan.

### 24. Verifikasi kelengkapan konfigurasi Fallback Condition pada AI Agent
1. User membuka form konfigurasi AI Agent dengan toggle `AI Auto-reply` aktif.
2. User memeriksa section `Fallback Condition`.
3. User melihat 4 kondisi pemicu fallback:
   - Customer chat dengan undefined intent (dibandingkan domain knowledge & transfer condition).
   - AI service is disrupted / timeout (> 2 menit).
   - AI credit exhausted.
   - AI Repetitive Prevention (2x respon serupa/identik berturut-turut).
4. User memilih destinasi handover fallback ke `Divisi Utama`.
5. User klik `Simpan` dan melihat toast sukses konfigurasi tersimpan.

### 25. Verifikasi eksekusi Fallback Handover saat AI Repetitive Prevention terpicu (2x respon serupa)
1. AI Agent aktif menangani percakapan customer dengan fallback ke `Divisi Utama`.
2. Customer mengirimkan pesan yang memicu AI memberikan respon identik sebanyak 2 kali berturut-turut.
3. User memeriksa status penanganan percakapan di Chat Room.
4. User melihat AI Agent berhenti merespon dan percakapan seketika di-handover ke antrean Tim CS Divisi Utama.

### 26. Verifikasi penanganan AI Timeout / Disruption (> 2 menit) pada runtime
1. Customer mengirim pesan masuk ke nomor WABA yang ditangani oleh AI Agent.
2. Simulasi layanan backend AI mengalami response delay melebihi ambang batas 2 menit.
3. User memeriksa penanganan percakapan di Chat Room.
4. User melihat setelah 2 menit tanpa balasan AI, sistem mengeksekusi fallback handover ke CS agar pesan tidak terabaikan.

---

## Modul 5: AI Agent & Chat Flow Cross-alignment & Integrity (User Story 5)

### 27. Verifikasi pesan peringatan saat menonaktifkan AI Agent yang terhubung ke Chat Flow
1. AI Agent `A` terdaftar dan digunakan di dalam alur Chat Flow `X` pada nomor `123`.
2. User membuka konfigurasi `AI Agent A`.
3. User mematikan toggle `AI Auto-reply (Agentic)` (atau mencoba unassign nomor `123`).
4. User melihat dialog konfirmasi peringatan: `this AI Agent A is involved in chat flow/automation X, continue?`.
5. User klik `Yes`.
6. User melihat AI Agent dinonaktifkan, dan alur `Chat Flow X` tetap ada di daftar alur dalam kondisi terhubung dengan AI inaktif.

### 28. Verifikasi pencegahan re-aktivasi broken Chat Flow akibat AI Agent inaktif / unassigned
1. Alur Chat Flow `X` berstatus `Deactive` dan di dalamnya melibatkan AI Agent `A`.
2. AI Agent `A` dalam status inaktif atau penugasan nomor WABA-nya telah dicopot.
3. User membuka `/pengaturan-alur-chat` dan mencoba menggeser toggle Chat Flow `X` menjadi `Active`.
4. User melihat sistem menjalankan pemeriksaan integritas alur (*flow integrity check*).
5. User melihat sistem memblokir aktivasi alur dan menampilkan pesan error bahwa alur tidak dapat diaktifkan karena AI Agent terkait sedang tidak aktif/terputus.

---

## Modul 6: Human Agent Menu Restructuring (User Story 6)

### 29. Verifikasi struktur sub-menu baru di bawah grup menu Human Agent / Tim CS
1. User login sebagai Owner/Supervisor.
2. User mengklik grup menu `Human Agent / Tim CS` di sidebar navigasi.
3. User melihat 4 sub-menu tersusun rapi:
   - `Daftar Tim CS`
   - `Divisi`
   - `Jam kerja`
   - `Pengaturan distribusi pesan`.

### 30. Verifikasi rename menu "Pengaturan Chat Masuk" menjadi "Pengaturan Distribusi Pesan" & persistensi data
1. User membuka menu `Human Agent / Tim CS` -> `Pengaturan Distribusi Pesan`.
2. User memastikan nama menu dan header halaman tertulis `Pengaturan Distribusi Pesan` (menggantikan `Pengaturan Chat Masuk`).
3. User memeriksa konfigurasi sticky agent, durasi idle, dan proporsi distribusi.
4. User memastikan seluruh data konfigurasi distribusi lama tetap tersimpan utuh tanpa ada yang hilang.

---

## Modul 7: Human Agent & Chat Flow Distribution Alignment (User Story 7)

### 31. Verifikasi pengalihan konfigurasi distribusi keyword ke menu Chat Flow
1. User membuka menu `Tim CS` -> `Pengaturan Distribusi Pesan` untuk nomor `123`.
2. User klik opsi konfigurasi distribusi divisi berdasarkan keyword.
3. User dialihkan ke halaman form pembuatan Chat Flow baru.
4. User melihat field nomor telepon ter-prefill otomatis dengan `123` dan terkunci.
5. User mengonfigurasi Source, daftar keyword, dan target response, lalu klik `Simpan`.
6. User melihat alur baru tersimpan di Chat Flow dengan Source: `default` dan Keyword: `custom`.

### 32. Verifikasi migrasi otomatis data distribusi keyword eksisting menjadi entitas Chat Flow
1. Akun memiliki 5 pasangan distribusi kata kunci kustom lama sebelum rilis.
2. User membuka halaman `/pengaturan-alur-chat` setelah deployment rilis.
3. User melihat 5 alur chat baru otomatis terbentuk dengan nama `CS Custom distribution 1` sampai `CS Custom distribution 5`.
4. User memastikan setiap alur memiliki Source: `default`, Keyword: `custom`, dan memetakan keyword group serta divisi target yang sesuai persis dengan data lama.

### 33. Verifikasi indikator status distribusi (Default vs Custom) pada menu Distribusi Pesan
1. User membuka menu `Pengaturan Distribusi Pesan` untuk nomor `123` yang memiliki alur kustom.
2. User melihat sistem menampilkan status `distribution custom` aktif.
3. User membuka menu `Pengaturan Distribusi Pesan` untuk nomor `456` yang hanya memiliki alur primary default.
4. User melihat sistem menampilkan status `distribution default` aktif.

---

## Modul 8: Visual Builder Handover Template to AI Agent (User Story 8)

### 34. Verifikasi opsi handover dari kartu Template ke AI Agent pada Visual Builder
1. User membuka visual builder pada salah satu alur Chat Flow.
2. User memilih sebuah kartu `Template` di canvas visual builder.
3. User klik opsi titik sambung / aksi handover.
4. User melihat pilihan handover ke `AI Agent` dengan 2 sub-opsi:
   - `New AI Agent card`
   - `Existing AI Agent card`.

### 35. Verifikasi pembuatan New AI Agent card secara inline dari dalam Visual Builder
1. User memilih kartu `Template` pada visual builder nomor `123` dan memilih `Handover` -> `New AI Agent card`.
2. User melihat modal form pembuatan AI Agent terbuka langsung di dalam visual builder.
3. User memastikan field Phone Number terkunci pada `123` dan toggle `AI Auto-reply (agentic)` terkunci `ON`.
4. User mengisi Name, Role, Goals, Description, Transfer Condition, dan Fallback.
5. User klik `Simpan`.
6. User melihat kartu AI Agent baru otomatis terhubung setelah kartu Template dan konfigurasi alur berhasil disimpan.

### 36. Verifikasi koneksi handover kartu Template ke Existing AI Agent card tanpa duplikasi
1. Canvas visual builder telah memuat kartu `AI Agent A`.
2. User memilih kartu `Template` dan memilih `Handover` -> `Existing AI Agent card`.
3. User memilih `AI Agent A` dari dropdown list.
4. User klik `Simpan`.
5. User melihat kartu Template terhubung ke kartu `AI Agent A` yang sudah ada tanpa membentuk kartu duplikat di canvas.

### 37. Verifikasi eksekusi runtime handover dari Template ke AI Agent dan transfer konteks chat
1. Alur Chat Flow aktif tersusun atas: Kartu `Template` -> Handover ke `AI Agent A`.
2. Customer mengirim pesan masuk WhatsApp.
3. Customer menerima balasan otomatis dari Template dan merespon hingga mencapai titik handover.
4. User memeriksa room chat di Chat Room.
5. User melihat Template berhenti merespon, AI Agent `A` melanjutkan percakapan dengan membawa konteks percakapan sebelumnya, dan status handler berubah menjadi `AI Agent A`.

### 38. Verifikasi dialog aktivasi paksa saat menghubungkan handover ke Inactive AI Agent
1. User memilih kartu Template pada visual builder dan menghubungkan handover ke `Existing AI Agent B` (yang berstatus Inactive).
2. User melihat modal dialog warning: `this action will activate AI Agent B, continue?`.
3. User klik `Yes`.
4. User melihat status `AI Agent B` otomatis dipaksa menjadi `Active` dan alur Chat Flow berhasil disimpan.

---

## Modul 9: Distinct Chat Room Message Bubbles & Sender Identification (User Story 9)

### 39. Verifikasi gaya visual pembeda bubble chat untuk pesan Template di Chat Room
1. User membuka halaman `/chatroom`.
2. User memilih percakapan yang memuat pesan terkirim dari Template automasi.
3. User melihat bubble chat pesan template menggunakan styling khusus Template.
4. User melihat penanda/label pengirim bertuliskan `Template`.
5. User memastikan tampilan bubble berbeda secara visual dari bubble AI Agent dan Human Agent.

### 40. Verifikasi gaya visual pembeda bubble chat dan nama pengirim untuk pesan AI Agent
1. User membuka `/chatroom` pada percakapan yang berisi pesan balasan dari AI Agent `A`.
2. User melihat bubble pesan menggunakan gaya visual khusus AI Agent.
3. User melihat label tipe pengirim `AI Agent` beserta nama spesifik agen `AI Agent A`.
4. User memastikan gaya visual berbeda jelas dari bubble Template dan CS.

### 41. Verifikasi gaya visual pembeda bubble chat dan nama agen untuk pesan Human Agent (CS)
1. User membuka `/chatroom` pada percakapan yang dibalas manual oleh agen CS `Budi`.
2. User melihat bubble pesan menggunakan gaya visual khusus Human Agent.
3. User melihat label tipe pengirim `Human Agent` beserta nama agen `Budi`.
4. User memastikan gaya visual berbeda jelas dari bubble Template dan AI Agent.

### 42. Verifikasi konsistensi bubble chat Customer dan persistensi riwayat chat (History)
1. User membuka riwayat percakapan yang telah melewati interaksi lengkap: Customer chat -> Template balas -> AI balas -> CS balas manual -> Closed.
2. User melihat bubble pesan customer tetap pada format bubble standar customer.
3. User memastikan seluruh tipe bubble (Template, AI, Human CS) pada histori tetap mempertahankan gaya visual dan identitas pengirim aslinya tanpa tertimpa saat alur berpindah.

---

## Modul 10: Chat Room Takeover & Turn Off Flow (User Story 10)

### 43. Verifikasi tampilan tombol overlay Ambil Alih Chat pada percakapan yang ditangani AI/Flow
1. User login sebagai Owner/Supervisor/CS Agent yang berwenang.
2. User membuka room percakapan aktif yang sedang ditangani oleh AI Agent atau Chat Flow.
3. User melihat tombol aksi overlay `Ambil Alih Chat` tampil jelas di atas area input percakapan.

### 44. Verifikasi eksekusi aksi Ambil Alih Chat (Penghentian respon otomatis & pembukaan input CS)
1. User membuka room chat yang sedang ditangani oleh AI Agent.
2. User mengklik tombol `Ambil Alih Chat`.
3. User melihat alur Chat Flow pada percakapan tersebut seketika berstatus `Turned Off`.
4. User melihat respon otomatis AI / automasi langkah selanjutnya berhenti seketika.
5. User melihat tombol overlay `Ambil Alih Chat` disembunyikan.
6. User melihat input box teks terbuka aktif, CS dapat mengetik dan mengirim pesan balasan manual, serta status active handler berubah menjadi `Human CS`.

### 45. Verifikasi pencegahan trigger automasi ulang pada percakapan yang telah diambil alih (Single Session Guard)
1. Percakapan telah diambil alih oleh CS (flow turned off) dan sesi chat masih berstatus open/aktif.
2. Customer mengirim pesan WhatsApp baru dengan teks atau intent yang normalnya memicu automasi/AI.
3. User memeriksa room chat.
4. User memastikan sistem TIDAK memicu automasi atau AI Agent kembali pada percakapan tersebut dan tetap berada di bawah penanganan manual CS.

### 46. Verifikasi inisiasi ulang Chat Flow pada sesi percakapan baru setelah chatroom closing/resolved
1. Sesi percakapan sebelumnya yang telah di-takeover oleh CS kini telah diubah statusnya menjadi `Closed / Resolved`.
2. Customer yang sama mengirimkan pesan WhatsApp baru di kemudian hari untuk memulai sesi baru.
3. User memeriksa penanganan pesan masuk pertama pada sesi baru tersebut.
4. User melihat sistem mendeteksi pesan sebagai sesi percakapan baru dan memicu Chat Flow / AI Agent dari awal kembali sesuai konfigurasi trigger first responder.
