/** Definisi tool MCP (schema) — Mobile QA Guard. */
const T = (name, description, properties = {}, required = []) => ({ name, description, inputSchema: { type: 'object', properties, required } });
const target = {
  type: 'object',
  description: 'Target elemen. Prioritas: ref (dari qa_inspect_screen) > id (resource-id, boleh akhiran * untuk prefix) > label (label efektif exact) > contains (fuzzy, LOW CONFIDENCE) > type ("input"|"password") > relativeTo+side (koordinat ber-anchor: elemen/titik di sisi anchor ber-ID/label exact, LOW CONFIDENCE, boleh untuk mutasi di mode full dengan evidence sebelum/sesudah) > xy [x,y] (koordinat mentah, LOW CONFIDENCE, SELALU diblokir untuk mutasi). Tambahkan index jika kandidat >1; scroll:false untuk mematikan scroll-until-visible.',
  properties: {
    ref: { type: 'string' }, id: { type: 'string' }, idContains: { type: 'string' }, label: { type: 'string' }, contains: { type: 'string' }, hint: { type: 'string' }, type: { type: 'string', enum: ['input', 'password'] }, xy: { type: 'array', items: { type: 'number' } }, index: { type: 'number' }, scroll: { type: 'boolean' },
    relativeTo: { type: 'object', description: 'Anchor HIGH: {id} atau {label} exact. Contoh tombol kirim tanpa ID: relativeTo {id:"app_room_message_input_field"}, side "right"' },
    side: { type: 'string', enum: ['right', 'left', 'above', 'below'] }, offset: { type: 'number', description: 'px dari tepi anchor bila tombol tidak terbaca di UI tree' }, tolerance: { type: 'number' }, nth: { type: 'number', description: 'kandidat ke-n terdekat (default 0)' },
  },
};
export const TOOLS = [
  T('qa_check_device_state', 'Gate 2: Daftar device adb (state, model, Android), status Appium, APK di mobile-execution/build-apk, versi app staging terpasang vs APK, dan deteksi app production di device. Read-only.'),
  T('qa_init_app', 'Gate 2: Device & Build Gate + mulai sesi. Memilih device, menegakkan Build Guard (hanya package staging allowlist), memutuskan install/upgrade (tidak pernah downgrade), grant izin runtime, start Appium, launch app, membuat folder run evidence. Mengembalikan status NEEDS_DECISION bila perlu keputusan user.', {
    featureName: { type: 'string', description: 'Nama fitur untuk folder evidence & laporan' },
    udid: { type: 'string' }, package: { type: 'string' }, activity: { type: 'string' }, apkFile: { type: 'string', description: 'Nama file APK di build-apk/ (jika >1)' },
    installPolicy: { type: 'string', enum: ['ask', 'install', 'use_installed'], default: 'ask' },
  }, ['featureName']),
  T('qa_list_available_roles', 'Gate 3: Daftar role kredensial di .env (username ter-masking, password tidak pernah ditampilkan) + flag ambiguitas per role.'),
  T('qa_set_mutation_permission', 'Gate 4: Mode mutasi. safe = read-only (mutasi -> PARTIAL TEST WITH REASON); full = CREATE/UPDATE/DELETE/perubahan status nyata di staging (update/delete hanya pada data ber-TAG); full_external = full + kirim/balas/broadcast hanya bila penerima di layar ada di QA_TEST_RECIPIENT_ALLOWLIST. Finansial & logout tanpa penanda selalu diblokir. Tanpa argumen = baca policy aktif. Default dari .env QA_MUTATION_MODE (atau safe). Mengembalikan dataTag yang WAJIB dipakai pada data yang dibuat ({{TAG}} pada value type).', {
    mode: { type: 'string', enum: ['safe', 'full', 'full_external'] }, allow: { type: 'boolean', description: 'Legacy: true = full (atau QA_MUTATION_MODE), false = safe' }, dataTag: { type: 'string', description: 'Pakai TAG lama (rerun)' },
  }),
  T('qa_get_mutation_ledger', 'Gate 5: Ringkasan mutasi yang dijalankan/diblokir pada run ini (per kategori, data yang dibuat, mutation_ledger.jsonl) + petunjuk teardown data ber-TAG.'),
  T('qa_login_role', 'Gate 3: Melewati layar pre-login (izin pelacakan/onboarding) lalu login dengan kredensial .env. Password diketik langsung oleh server, tidak pernah dikirim ke AI. Status ALREADY_LOGGED_IN_OR_UNKNOWN = sesi aktif (picu Active Session Mismatch Gate).', {
    role: { type: 'string' }, suffix: { type: 'string', description: 'Suffix akun di .secrets, mis. 1 (USER_OWNER_1)' }, att: { type: 'string', enum: ['decline', 'grant'], default: 'decline' },
  }, ['role']),
  T('qa_inspect_screen', 'Membaca layar saat ini: tipe layar, judul, elemen interaktif (ref, resource-id, label efektif, tipe, bounds), teks non-interaktif, toast, dan Testability Score. Gunakan ref/id hasil tool ini untuk qa_execute_action.', { maxElements: { type: 'number', default: 60 } }),
  T('qa_execute_action', 'Eksekusi 1 langkah UI dengan resolusi target berlapis + mutation guard + build guard foreground. Aksi: tap, long_press, double_tap, type, clear, scroll, swipe, back, hide_keyboard, press_key (value: ENTER|SEARCH|BACK|TAB), wait. Mengembalikan tier locator & confidence (LOW => PASSED (LOW CONFIDENCE)). Aksi yang melanggar Mutation Policy -> PARTIAL TEST WITH REASON. {{TAG}} pada value diganti TAG data uji run.', {
    action: { type: 'string', enum: ['tap', 'long_press', 'double_tap', 'type', 'clear', 'scroll', 'swipe', 'back', 'hide_keyboard', 'press_key', 'wait'] },
    target, value: { type: 'string', description: 'Teks untuk type; ms untuk wait' }, settleMs: { type: 'number', description: 'Batas tunggu UI stabil setelah aksi (default 8000). Kecilkan untuk layar yang terus berubah (mis. video diputar).' },
    direction: { type: 'string', enum: ['up', 'down', 'left', 'right'] }, percent: { type: 'number' },
    isMutation: { type: 'boolean', description: 'Tandai eksplisit bila langkah adalah CREATE/EDIT/DELETE/kirim' },
    mutationType: { type: 'string', enum: ['create', 'update', 'delete', 'state_change', 'external', 'financial', 'session_end', 'navigation'], description: 'Kategori eksplisit. "navigation" hanya menurunkan kategori create (mis. tombol Tambah yang membuka form).' },
    tcId: { type: 'string' }, step: { type: 'string' },
  }, ['action']),
  T('qa_assert_element', 'Gate 5: Assertion UI dengan polling. assertion: visible | not_visible | contains_text | screen_title | enabled | disabled | count_at_least | toast_contains (termasuk toast singkat yang sempat muncul sejak aksi terakhir) | seen_text | not_seen_text (teks tidak pernah muncul sejak aksi terakhir, dipantau selama timeout). Mengembalikan PASS/FAIL + confidence.', {
    assertion: { type: 'string', enum: ['visible', 'not_visible', 'contains_text', 'screen_title', 'enabled', 'disabled', 'count_at_least', 'toast_contains', 'seen_text', 'not_seen_text'] },
    target, expected: { type: 'string' }, timeoutMs: { type: 'number', default: 6000 },
  }, ['assertion']),
  T('qa_capture_evidence', 'Gate 5: Screenshot terstandar <TC>_<step>_<status>.png ke folder run; logcat app + crash buffer otomatis untuk FAILED.', {
    tcId: { type: 'string' }, step: { type: 'string' }, status: { type: 'string' }, logcat: { type: 'boolean' },
  }, ['tcId', 'step', 'status']),
  T('qa_screen_recording', 'Mulai/stop rekaman layar per TC (mp4 di folder run).', { action: { type: 'string', enum: ['start', 'stop'] }, tcId: { type: 'string' } }, ['action']),
  T('qa_device_control', 'Kontrol device untuk charter exploratory mobile: rotate_landscape, rotate_portrait, background (value=detik), kill_relaunch, network_off, network_on, font_scale (value mis. 1.3), dark_mode_on, dark_mode_off, revoke_permission / grant_permission (value mis. CAMERA), permission_dialog (value allow|deny|leave), camera_video (buka kamera sistem mode video untuk merekam data uji), save_latest_video (value=nama atau nama@rotasi, mis. VID-LAND180@180 — gagal bila rotasi file tidak sesuai; salin video terbaru DCIM/Camera ke /sdcard/Download/qa_<nama>.mp4 + tarik salinan ke folder run), activate_app (kembali ke app staging), idle_wait (value ms; 0 = jangan tunggu UI idle saat video diputar, 10000 = default), restore. Semua perubahan setting otomatis di-restore saat qa_close_app.', {
    action: { type: 'string', enum: ['rotate_landscape', 'rotate_portrait', 'background', 'kill_relaunch', 'network_off', 'network_on', 'font_scale', 'dark_mode_on', 'dark_mode_off', 'revoke_permission', 'grant_permission', 'permission_dialog', 'camera_video', 'save_latest_video', 'activate_app', 'idle_wait', 'restore'] }, value: { type: 'string' },
  }, ['action']),
  T('qa_navigate_home', 'Kembali ke home anchor (layar setelah login) via back; fallback relaunch app (sesi login tetap).'),
  T('qa_reset_session', 'Gate 6: Reset sesi bersih antar role batch: pm clear app staging + grant ulang izin + relaunch. Setelah ini panggil qa_login_role.'),
  T('qa_push_support_file', 'Kirim file data uji dari mobile-execution/automate-support/ ke /sdcard/Download/ di device (untuk skenario upload).', { fileName: { type: 'string' } }, ['fileName']),
  T('qa_close_app', 'Post-flight: stop rekaman, restore setting device, terminate app, tutup sesi Appium (dan server bila di-start oleh MCP), tulis guard_events.json.', { keepAppRunning: { type: 'boolean', default: false } }),
];
