// ================= VERİ =================
const STORE_KEY = 'ajanda-data';
let data = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
['daily', 'tasks', 'notes', 'edu', 'bills', 'spend'].forEach(k => data[k] = data[k] || []);

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

const ui = { workTab: 'tasks', showDone: false, noteSearch: '', eduFilter: 'all', moneyTab: 'bills', month: null };
let currentTab = localStorage.getItem('ajanda-tab') || 'daily';
let sheet = null;

// ================= YARDIMCILAR =================
function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
function daysFromToday(iso) {
  return Math.round((new Date(iso + 'T00:00') - new Date(todayISO() + 'T00:00')) / 86400000);
}
function shortDate(iso) {
  return new Date(iso + 'T00:00').toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });
}
function esc(text) {
  return String(text ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function greeting() {
  const h = new Date().getHours();
  if (h < 6) return 'İyi geceler';
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi günler';
  return 'İyi akşamlar';
}
function dueBadge(iso) {
  if (!iso) return '';
  const n = daysFromToday(iso);
  if (n < 0) return `<span class="badge late">${-n} gün gecikti</span>`;
  if (n === 0) return `<span class="badge soon">Bugün</span>`;
  if (n === 1) return `<span class="badge soon">Yarın</span>`;
  if (n <= 7) return `<span class="badge soon">${n} gün kaldı</span>`;
  return `<span class="badge">${shortDate(iso)}</span>`;
}

// ================= BÖLÜMLER =================
const SECTIONS = {
  daily: { label: 'Günlük',   title: 'Bugün',       word: 'ne var?' },
  work:  { label: 'İşler',    title: 'İşler',       word: 've notlar' },
  edu:   { label: 'Eğitim',   title: 'Eğitimlerim', word: '' },
  money: { label: 'Ödemeler', title: 'Ödemeler',    word: 've harcamalar' }
};

const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONS = {
  daily: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  work:  svg('<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>'),
  edu:   svg('<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>'),
  money: svg('<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h4"/>')
};

function emptyCard(tab, text) {
  return `<div class="card empty"><div class="icon">${ICONS[tab]}</div><p>${text}</p></div>`;
}

// ================= FORM TANIMLARI =================
const FORMS = {
  tasks: { name: 'görev', fields: [
    { key: 'title',    label: 'Görev',     type: 'text', required: true, placeholder: 'Örn. Fon kodu raporunu bitir' },
    { key: 'project',  label: 'Proje',     type: 'text', placeholder: 'MSTR, PBIRS, AI Hub…' },
    { key: 'priority', label: 'Öncelik',   type: 'choice', options: [['high', 'Yüksek'], ['mid', 'Orta'], ['low', 'Düşük']], default: 'mid' },
    { key: 'status',   label: 'Durum',     type: 'choice', options: [['todo', 'Yapılacak'], ['doing', 'Devam'], ['done', 'Bitti']], default: 'todo' },
    { key: 'due',      label: 'Son tarih', type: 'date' },
    { key: 'notes',    label: 'Notlar',    type: 'textarea', placeholder: 'Detaylar, kimle konuşulacak…' }
  ]},
  notes: { name: 'not', fields: [
    { key: 'title', label: 'Başlık', type: 'text', required: true },
    { key: 'tag',   label: 'Etiket', type: 'text', placeholder: 'toplantı, fikir, SQL…' },
    { key: 'body',  label: 'Not',    type: 'textarea', rows: 10 }
  ]}
};

// ================= GÜNLÜK =================
function dailyView() {
  const t = todayISO();
  const open = data.daily.filter(x => !x.done);
  const late = open.filter(x => x.date < t);
  const today = open.filter(x => x.date === t);
  const upcoming = open.filter(x => x.date > t).sort((a, b) => a.date.localeCompare(b.date));
  const doneToday = data.daily.filter(x => x.done && x.doneDate === t);
  const remaining = late.length + today.length;

  let html = `
    <div class="stats">
      <div class="stat"><b>${remaining}</b><span>kalan iş</span></div>
      <div class="stat"><b>${doneToday.length}</b><span>bugün biten</span></div>
      <div class="stat ${late.length ? 'alert' : ''}"><b>${late.length}</b><span>geciken</span></div>
    </div>
    <form class="quick-add" id="dailyForm">
      <input id="dailyText" placeholder="Yeni iş ekle…" autocomplete="off">
      <input id="dailyDate" type="date" value="${t}">
      <button type="submit" aria-label="Ekle">+</button>
    </form>`;

  if (!data.daily.length) return html + emptyCard('daily', 'Henüz iş yok. Yukarıdaki kutuya yazıp + butonuna bas.');

  html += dailyGroup('Geciken', late, 'late') + dailyGroup('Bugün', today)
        + dailyGroup('Yaklaşan', upcoming) + dailyGroup('Bugün tamamlananlar', doneToday);
  if (!remaining && doneToday.length) html += `<div class="card done-msg">Bugünlük her şey tamam, tebrikler!</div>`;
  return html;
}

function dailyGroup(title, items, kind = '') {
  if (!items.length) return '';
  return `<h2 class="group-title ${kind}">${title}<span>${items.length}</span></h2>
    <div class="card list">${items.map(dailyRow).join('')}</div>`;
}

function dailyRow(x) {
  const badge = !x.done && x.date !== todayISO() ? dueBadge(x.date) : '';
  return `
    <div class="row ${x.done ? 'done' : ''}" data-id="${x.id}">
      <button class="check" data-action="toggleDaily" aria-label="Tamamlandı"></button>
      <div class="row-text"><span class="title">${esc(x.title)}</span>${badge}</div>
      <button class="del" data-action="deleteDaily" aria-label="Sil">×</button>
    </div>`;
}

// ================= İŞLER =================
function workView() {
  return `
    <div class="segment">
      <button data-seg="tasks" class="${ui.workTab === 'tasks' ? 'on' : ''}">Görevler</button>
      <button data-seg="notes" class="${ui.workTab === 'notes' ? 'on' : ''}">Notlar</button>
    </div>` + (ui.workTab === 'tasks' ? tasksView() : notesView());
}

function tasksView() {
  const order = { high: 0, mid: 1, low: 2 };
  const sort = (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || order[a.priority] - order[b.priority];
  const doing = data.tasks.filter(t => t.status === 'doing').sort(sort);
  const todo = data.tasks.filter(t => t.status === 'todo').sort(sort);
  const done = data.tasks.filter(t => t.status === 'done').sort((a, b) => (b.doneDate || '').localeCompare(a.doneDate || ''));
  const late = [...doing, ...todo].filter(t => t.due && daysFromToday(t.due) < 0);

  let html = `
    <div class="stats">
      <div class="stat"><b>${doing.length}</b><span>devam eden</span></div>
      <div class="stat"><b>${todo.length}</b><span>yapılacak</span></div>
      <div class="stat ${late.length ? 'alert' : ''}"><b>${late.length}</b><span>geciken</span></div>
    </div>
    <button class="add-btn" data-new="tasks">+ Yeni görev</button>`;

  if (!data.tasks.length) return html + emptyCard('work', 'Henüz görev yok. "Yeni görev" ile ilkini ekle.');

  html += taskGroup('Devam eden', doing) + taskGroup('Yapılacak', todo);
  if (done.length) {
    html += `<h2 class="group-title">Biten<span>${done.length}</span>
      <button class="link" data-action="toggleShowDone">${ui.showDone ? 'Gizle' : 'Göster'}</button></h2>`;
    if (ui.showDone) html += `<div class="card list">${done.map(taskRow).join('')}</div>`;
  }
  return html;
}

function taskGroup(title, items) {
  if (!items.length) return '';
  return `<h2 class="group-title">${title}<span>${items.length}</span></h2>
    <div class="card list">${items.map(taskRow).join('')}</div>`;
}

function taskRow(t) {
  const done = t.status === 'done';
  return `
    <div class="row ${done ? 'done' : ''}" data-id="${t.id}">
      <span class="prio ${t.priority}"></span>
      <button class="check" data-action="toggleTask" aria-label="Bitti"></button>
      <button class="row-text row-open" data-open="tasks" data-id="${t.id}">
        <span class="title">${esc(t.title)}</span>
        <span class="meta">
          ${t.project ? `<span class="chip">${esc(t.project)}</span>` : ''}
          ${done ? '' : dueBadge(t.due)}
          ${t.notes ? '<span class="hint">· not var</span>' : ''}
        </span>
      </button>
    </div>`;
}

function notesView() {
  let html = `
    <div class="toolbar">
      <input class="search" id="noteSearch" type="search" placeholder="Notlarda ara…" value="${esc(ui.noteSearch)}">
      <button class="add-btn small" data-new="notes">+ Yeni not</button>
    </div>`;

  if (!data.notes.length) return html + emptyCard('work', 'Henüz not yok. Toplantı notları, SQL parçaları, fikirler… hepsi burada.');

  const q = ui.noteSearch.toLocaleLowerCase('tr');
  const list = data.notes
    .filter(n => !q || [n.title, n.body, n.tag].join(' ').toLocaleLowerCase('tr').includes(q))
    .sort((a, b) => b.updated - a.updated);

  if (!list.length) return html + `<p class="muted-text">Aramana uyan not yok.</p>`;

  return html + `<div class="note-grid">${list.map(n => `
    <button class="card note" data-open="notes" data-id="${n.id}">
      <h4>${esc(n.title)}</h4>
      ${n.body ? `<p>${esc(n.body)}</p>` : ''}
      <span class="meta">
        ${n.tag ? `<span class="chip">${esc(n.tag)}</span>` : ''}
        <span class="date-small">${new Date(n.updated).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>
      </span>
    </button>`).join('')}</div>`;
}
// ================= EĞİTİM =================
FORMS.edu = { name: 'eğitim', fields: [
  { key: 'title',    label: 'Eğitim adı',         type: 'text', required: true, placeholder: 'Örn. DP-600 sınav hazırlığı' },
  { key: 'source',   label: 'Platform veya link', type: 'text', placeholder: 'Microsoft Learn, Udemy, kitap…' },
  { key: 'status',   label: 'Durum',              type: 'choice', options: [['plan', 'Planlandı'], ['active', 'Devam'], ['done', 'Bitti']], default: 'plan' },
  { key: 'progress', label: 'İlerleme',           type: 'range', default: 0 },
  { key: 'due',      label: 'Hedef tarih',        type: 'date' },
  { key: 'notes',    label: 'Notlarım',           type: 'textarea', rows: 7, placeholder: 'Ders notları, eksik konular, linkler…' }
]};

const EDU_STATUS = { plan: 'Planlandı', active: 'Devam ediyor', done: 'Tamamlandı' };

function eduView() {
  const count = s => data.edu.filter(x => x.status === s).length;
  let html = `
    <div class="stats">
      <div class="stat"><b>${count('active')}</b><span>devam eden</span></div>
      <div class="stat"><b>${count('plan')}</b><span>planlanan</span></div>
      <div class="stat"><b>${count('done')}</b><span>tamamlanan</span></div>
    </div>
    <button class="add-btn" data-new="edu">+ Yeni eğitim</button>`;

  if (!data.edu.length) return html + emptyCard('edu', 'Takip ettiğin kursları, sertifikaları ve kitapları ekle. Her birine ilerleme ve kendi notlarını yazabilirsin.');

  const filters = [['all', 'Tümü'], ['active', 'Devam eden'], ['plan', 'Planlanan'], ['done', 'Tamamlanan']];
  html += `<div class="filters">${filters.map(([k, l]) =>
    `<button data-filter="${k}" class="${ui.eduFilter === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;

  const order = { active: 0, plan: 1, done: 2 };
  const list = data.edu
    .filter(x => ui.eduFilter === 'all' || x.status === ui.eduFilter)
    .sort((a, b) => order[a.status] - order[b.status] || (a.due || '9999').localeCompare(b.due || '9999'));

  if (!list.length) return html + `<p class="muted-text">Bu filtrede eğitim yok.</p>`;
  return html + `<div class="edu-list">${list.map(eduCard).join('')}</div>`;
}

function eduCard(x) {
  const p = Math.min(100, Math.max(0, Number(x.progress) || 0));
  return `
    <button class="card edu-card" data-open="edu" data-id="${x.id}">
      <div class="edu-top">
        <div class="ring" style="--p:${p}"><span>%${p}</span></div>
        <div class="edu-info">
          <span class="meta"><span class="status-pill ${x.status}">${EDU_STATUS[x.status]}</span>${x.status !== 'done' ? dueBadge(x.due) : ''}</span>
          <h4>${esc(x.title)}</h4>
          ${x.source ? `<span class="hint">${esc(x.source)}</span>` : ''}
        </div>
      </div>
      ${x.notes ? `<p class="edu-notes">${esc(x.notes)}</p>` : ''}
    </button>`;
}

// İlerleme kaydırıcısı hareket edince yüzdeyi ve durumu güncelle
document.addEventListener('input', e => {
  if (e.target.id !== 'f_progress') return;
  const val = Number(e.target.value);
  document.getElementById('f_progress_out').textContent = '%' + val;
  const status = val === 100 ? 'done' : val > 0 ? 'active' : 'plan';
  const radio = document.querySelector(`input[name="f_status"][value="${status}"]`);
  if (radio) radio.checked = true;
});
// ================= ÖDEMELER =================
const CATS = ['Market', 'Yemek', 'Ulaşım', 'Fatura', 'Kira', 'Kredi/Kart', 'Eğlence', 'Sağlık', 'Diğer'];
const catOptions = CATS.map(c => [c, c]);
const REPEAT = { monthly: 'Her ay', yearly: 'Her yıl', once: 'Tek sefer' };

FORMS.bills = { name: 'ödeme', fields: [
  { key: 'title',    label: 'Ödeme adı',        type: 'text', required: true, placeholder: 'Kira, kredi kartı, internet…' },
  { key: 'amount',   label: 'Tutar (₺)',        type: 'text', placeholder: 'Örn. 1250 veya 1.250,50' },
  { key: 'due',      label: 'Son ödeme tarihi', type: 'date', required: true },
  { key: 'repeat',   label: 'Tekrar',           type: 'choice', options: [['monthly', 'Her ay'], ['yearly', 'Her yıl'], ['once', 'Tek sefer']], default: 'monthly' },
  { key: 'category', label: 'Kategori',         type: 'choice', options: catOptions, default: 'Fatura' },
  { key: 'notes',    label: 'Not',              type: 'textarea', rows: 3, placeholder: 'Hesap bilgisi, otomatik ödeme…' }
]};

FORMS.spend = { name: 'harcama', fields: [
  { key: 'title',    label: 'Açıklama',  type: 'text', required: true, placeholder: 'Örn. Haftalık market' },
  { key: 'amount',   label: 'Tutar (₺)', type: 'text', required: true, placeholder: 'Örn. 1250 veya 1.250,50' },
  { key: 'date',     label: 'Tarih',     type: 'date', required: true, default: todayISO() },
  { key: 'category', label: 'Kategori',  type: 'choice', options: catOptions, default: 'Market' }
]};

// "1.250,50" gibi Türkçe yazımları sayıya çevirir
function parseAmount(text) {
  let s = String(text ?? '').trim().replace(/\s|₺/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  return Number(s) || 0;
}
function money(n) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }).format(n);
}
function addMonths(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const lastDay = new Date(y, m - 1 + n + 1, 0).getDate();
  const date = new Date(y, m - 1 + n, Math.min(d, lastDay));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function moneyView() {
  return `
    <div class="segment">
      <button data-mseg="bills" class="${ui.moneyTab === 'bills' ? 'on' : ''}">Ödemeler</button>
      <button data-mseg="spend" class="${ui.moneyTab === 'spend' ? 'on' : ''}">Harcamalar</button>
    </div>` + (ui.moneyTab === 'bills' ? billsView() : spendView());
}

function billsView() {
  const unpaid = data.bills.filter(b => !b.paid).sort((a, b) => a.due.localeCompare(b.due));
  const late = unpaid.filter(b => daysFromToday(b.due) < 0);
  const week = unpaid.filter(b => { const n = daysFromToday(b.due); return n >= 0 && n <= 7; });
  const later = unpaid.filter(b => daysFromToday(b.due) > 7);
  const thisMonth = unpaid.filter(b => b.due.slice(0, 7) === todayISO().slice(0, 7));
  const sum = list => list.reduce((s, b) => s + parseAmount(b.amount), 0);

  let html = `
    <div class="stats">
      <div class="stat ${late.length ? 'alert' : ''}"><b>${late.length}</b><span>geciken</span></div>
      <div class="stat"><b class="amount">${money(sum(week))}</b><span>7 gün içinde</span></div>
      <div class="stat"><b class="amount">${money(sum(thisMonth))}</b><span>bu ay kalan</span></div>
    </div>
    <button class="add-btn" data-new="bills">+ Yeni ödeme</button>`;

  if (!data.bills.length) return html + emptyCard('money', 'Kira, kredi kartı, fatura gibi düzenli ödemelerini ekle. Yaklaşanlar ve gecikenler en üstte görünür.');

  html += billGroup('Gecikti', late, 'late') + billGroup('Bu hafta', week) + billGroup('Sonra', later)
        + billGroup('Ödenmiş', data.bills.filter(b => b.paid));
     html += `<p class="hint center">Ödemeyi yapınca soldaki daireye dokun. Tekrarlayan ödeme bir sonraki döneme geçer, tutarı harcamalara eklenir.</p>`;
  return html;
}

function billGroup(title, items, kind = '') {
  if (!items.length) return '';
  return `<h2 class="group-title ${kind}">${title}<span>${items.length}</span></h2>
    <div class="card list">${items.map(billRow).join('')}</div>`;
}

function billRow(b) {
  const status = b.paid
    ? '<span class="status-pill done">Ödendi</span>'
    : `<span class="status-pill">Ödenecek</span>${dueBadge(b.due)}`;
  return `
    <div class="row ${b.paid ? 'done' : ''}" data-id="${b.id}">
      ${b.paid
        ? '<span class="check"></span>'
        : `<button class="check" data-pay="${b.id}" aria-label="Ödendi olarak işaretle"></button>`}
      <button class="row-text row-open" data-open="bills" data-id="${b.id}">
        <span class="title">${esc(b.title)}</span>
        <span class="meta">${status}<span class="hint">${REPEAT[b.repeat] || ''}</span></span>
      </button>
      ${b.amount ? `<span class="amount">${money(parseAmount(b.amount))}</span>` : ''}
    </div>`;
}

function payBill(id) {
  const b = data.bills.find(x => x.id === id);
  const amount = parseAmount(b.amount);
  if (amount > 0) {
    data.spend.push({ id: newId(), created: Date.now(), updated: Date.now(),
      title: b.title, amount: String(amount), date: todayISO(), category: b.category || 'Fatura' });
  }
  let msg = 'Ödendi';
  if (b.repeat === 'monthly' || b.repeat === 'yearly') {
    b.due = addMonths(b.due, b.repeat === 'monthly' ? 1 : 12);
    msg += ' · sonraki: ' + shortDate(b.due);
  } else {
    b.paid = true;
  }
  b.lastPaid = todayISO();
  save();
  render();
  showToast(amount > 0 ? msg + ' · harcamalara eklendi' : msg);
}

function spendView() {
  const m = ui.month || todayISO().slice(0, 7);
  const monthName = new Date(m + '-01T00:00').toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  const list = data.spend
    .filter(s => (s.date || '').slice(0, 7) === m)
    .sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created);
  const total = list.reduce((s, x) => s + parseAmount(x.amount), 0);
  const byCat = {};
  list.forEach(x => byCat[x.category] = (byCat[x.category] || 0) + parseAmount(x.amount));
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const max = cats.length ? cats[0][1] : 1;

  let html = `
    <div class="month-nav">
      <button data-month="-1" aria-label="Önceki ay">‹</button>
      <b>${monthName}</b>
      <button data-month="1" aria-label="Sonraki ay">›</button>
    </div>
    <div class="card total-card"><span>Toplam harcama</span><b>${money(total)}</b><span>${list.length} harcama</span></div>
    <button class="add-btn" data-new="spend">+ Yeni harcama</button>`;

  if (!data.spend.length) return html + emptyCard('money', 'Harcamalarını ekle, ay ay ve kategori bazında toplamını gör.');
  if (!list.length) return html + `<p class="muted-text">Bu ay için harcama yok.</p>`;

  html += `<div class="card cat-card">${cats.map(([c, v]) => `
    <div class="cat-row">
      <span>${esc(c)}</span>
      <div class="bar"><i style="width:${Math.max(4, v / max * 100)}%"></i></div>
      <span class="amount">${money(v)}</span>
    </div>`).join('')}</div>`;

  html += `<h2 class="group-title">Hareketler<span>${list.length}</span></h2>
    <div class="card list">${list.map(x => `
      <div class="row">
        <button class="row-text row-open" data-open="spend" data-id="${x.id}">
          <span class="title">${esc(x.title)}</span>
          <span class="meta"><span class="hint">${shortDate(x.date)}</span><span class="chip">${esc(x.category)}</span></span>
        </button>
        <span class="amount">${money(parseAmount(x.amount))}</span>
      </div>`).join('')}</div>`;
  return html;
}

// Ödemeler sekmesindeki tıklamalar
document.addEventListener('click', e => {
  const seg = e.target.closest('[data-mseg]');
  if (seg) { ui.moneyTab = seg.dataset.mseg; return render(); }

  const monthBtn = e.target.closest('[data-month]');
  if (monthBtn) {
    const current = ui.month || todayISO().slice(0, 7);
    ui.month = addMonths(current + '-01', Number(monthBtn.dataset.month)).slice(0, 7);
    return render();
  }

  const pay = e.target.closest('[data-pay]');
    if (pay) {
    pay.closest('.row').classList.add('done');
    setTimeout(() => payBill(pay.dataset.pay), 400);
  }
});
// ================= FORM PANELİ =================
function fieldHTML(f, value) {
  const v = value ?? f.default ?? '';
  const name = 'f_' + f.key;
    if (f.type === 'range') {
    return `<div class="field"><label class="field-label" for="${name}">${f.label}</label>
      <div class="range"><input id="${name}" name="${name}" type="range" min="0" max="100" step="5" value="${v || 0}">
      <output id="${name}_out">%${v || 0}</output></div></div>`;
  }
  if (f.type === 'choice') {
    const options = f.options.map(([val, lab]) =>
      `<label><input type="radio" name="${name}" value="${val}" ${v === val ? 'checked' : ''}><span>${lab}</span></label>`).join('');
    return `<div class="field"><span class="field-label">${f.label}</span><div class="choice">${options}</div></div>`;
  }
  const input = f.type === 'textarea'
    ? `<textarea id="${name}" name="${name}" rows="${f.rows || 4}" placeholder="${f.placeholder || ''}">${esc(v)}</textarea>`
    : `<input id="${name}" name="${name}" type="${f.type}" value="${esc(v)}" placeholder="${f.placeholder || ''}" autocomplete="off">`;
  return `<div class="field"><label class="field-label" for="${name}">${f.label}${f.required ? ' *' : ''}</label>${input}</div>`;
}

function openSheet(type, id) {
  const form = FORMS[type];
  const item = id ? data[type].find(x => x.id === id) : null;
  sheet = { type, id, confirmDelete: false };

  let holder = document.getElementById('sheetHolder');
  if (!holder) {
    holder = document.createElement('div');
    holder.id = 'sheetHolder';
    document.body.appendChild(holder);
  }
  holder.innerHTML = `
    <div class="overlay" data-sheet="cancel"></div>
    <form class="sheet" id="sheetForm">
      <div class="grabber"></div>
      <h3>${item ? 'Düzenle' : 'Yeni ' + form.name}</h3>
      ${form.fields.map(f => fieldHTML(f, item ? item[f.key] : undefined)).join('')}
      <p class="form-error" id="formError" hidden></p>
      <div class="sheet-actions">
        ${item ? '<button type="button" class="btn danger" data-sheet="delete">Sil</button>' : ''}
        <span class="spacer"></span>
        <button type="button" class="btn ghost" data-sheet="cancel">Vazgeç</button>
        <button type="submit" class="btn primary">Kaydet</button>
      </div>
    </form>`;
  if (!item) holder.querySelector('.sheet input').focus();
}

function closeSheet() {
  sheet = null;
  const holder = document.getElementById('sheetHolder');
  if (holder) holder.innerHTML = '';
}

function saveSheet(formEl) {
  const { type, id } = sheet;
  const values = {};
  for (const f of FORMS[type].fields) {
    const v = (formEl.elements['f_' + f.key].value || '').trim();
    if (f.required && !v) {
      const err = document.getElementById('formError');
      err.textContent = `"${f.label}" alanını doldurman gerekiyor.`;
      err.hidden = false;
      return;
    }
    values[f.key] = v;
  }

  const existing = id ? data[type].find(x => x.id === id) : null;
  if (type === 'tasks') {
    values.doneDate = values.status === 'done' ? (existing?.doneDate || todayISO()) : null;
  }
  if (type === 'edu' && values.status === 'done') values.progress = '100';
  if (existing) Object.assign(existing, values, { updated: Date.now() });
  else data[type].push({ id: newId(), created: Date.now(), updated: Date.now(), ...values });

  save();
  closeSheet();
  render();
  showToast(existing ? 'Kaydedildi' : 'Eklendi');
}

function deleteFromSheet(button) {
  if (!sheet.confirmDelete) {
    sheet.confirmDelete = true;
    button.textContent = 'Emin misin? Tekrar dokun';
    return;
  }
  const { type, id } = sheet;
  const index = data[type].findIndex(x => x.id === id);
  const [removed] = data[type].splice(index, 1);
  save();
  closeSheet();
  render();
  showToast('Silindi', () => { data[type].splice(index, 0, removed); save(); render(); });
}

// ================= EKRAN =================
function renderTabs() {
  document.getElementById('tabbar').innerHTML = Object.entries(SECTIONS)
    .map(([key, s]) => `<button data-tab="${key}" class="${key === currentTab ? 'active' : ''}">${ICONS[key]}${s.label}</button>`)
    .join('');
}

function render() {
  const s = SECTIONS[currentTab];
  const date = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
  let body;
  if (currentTab === 'daily') body = dailyView();
  else if (currentTab === 'work') body = workView();
    else if (currentTab === 'edu') body = eduView();
      else if (currentTab === 'money') body = moneyView();
  else body = emptyCard(currentTab, 'Bu bölüm sıradaki adımlarda gelecek.');

  document.body.dataset.tab = currentTab;
  renderTabs();
  document.getElementById('app').innerHTML = `
    <header class="hero">
      <p class="date">${date} · ${greeting()}, Berker</p>
      <h1>${s.title} <span>${s.word}</span></h1>
    </header>
    <section class="content">${body}</section>`;
  localStorage.setItem('ajanda-tab', currentTab);
}

function showToast(message, onUndo) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${message}</span>${onUndo ? '<button>Geri al</button>' : ''}`;
  document.body.appendChild(el);
  el.querySelector('button')?.addEventListener('click', () => { onUndo(); el.remove(); });
  setTimeout(() => el.remove(), 4000);
}

// ================= OLAYLAR =================
document.getElementById('tabbar').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  currentTab = btn.dataset.tab;
  render();
  window.scrollTo(0, 0);
});

document.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'sheetForm') return saveSheet(e.target);
  if (e.target.id === 'dailyForm') {
    const title = document.getElementById('dailyText').value.trim();
    const date = document.getElementById('dailyDate').value || todayISO();
    if (!title) return;
    data.daily.push({ id: newId(), title, date, done: false });
    save();
    render();
    document.getElementById('dailyText').focus();
  }
});

document.addEventListener('click', e => {
  // Form paneli butonları
  const sheetBtn = e.target.closest('[data-sheet]');
  if (sheetBtn) {
    if (sheetBtn.dataset.sheet === 'cancel') closeSheet();
    if (sheetBtn.dataset.sheet === 'delete') deleteFromSheet(sheetBtn);
    return;
  }
  // Yeni kayıt
  const newBtn = e.target.closest('[data-new]');
  if (newBtn) return openSheet(newBtn.dataset.new);
    // Eğitim filtreleri
  const filterBtn = e.target.closest('[data-filter]');
  if (filterBtn) { ui.eduFilter = filterBtn.dataset.filter; return render(); }
  // Görevler / Notlar seçimi
  const segBtn = e.target.closest('[data-seg]');
  if (segBtn) { ui.workTab = segBtn.dataset.seg; return render(); }
  // Kaydı aç ve düzenle
  const openBtn = e.target.closest('[data-open]');
  if (openBtn) return openSheet(openBtn.dataset.open, openBtn.dataset.id);

  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const row = btn.closest('.row');

  if (action === 'toggleShowDone') { ui.showDone = !ui.showDone; return render(); }

  if (action === 'toggleDaily') {
    const item = data.daily.find(x => x.id === row.dataset.id);
    item.done = !item.done;
    item.doneDate = item.done ? todayISO() : null;
    save();
    row.classList.toggle('done', item.done);
    setTimeout(render, 350);
  }

  if (action === 'deleteDaily') {
    const index = data.daily.findIndex(x => x.id === row.dataset.id);
    const [removed] = data.daily.splice(index, 1);
    save();
    render();
    showToast('İş silindi', () => { data.daily.splice(index, 0, removed); save(); render(); });
  }

  if (action === 'toggleTask') {
    const task = data.tasks.find(x => x.id === row.dataset.id);
    const nowDone = task.status !== 'done';
    task.status = nowDone ? 'done' : 'todo';
    task.doneDate = nowDone ? todayISO() : null;
    save();
    row.classList.toggle('done', nowDone);
    setTimeout(render, 350);
  }
});

// Notlarda arama
document.addEventListener('input', e => {
  if (e.target.id !== 'noteSearch') return;
  ui.noteSearch = e.target.value;
  render();
  const s = document.getElementById('noteSearch');
  s.focus();
  s.setSelectionRange(s.value.length, s.value.length);
});

// Esc ile paneli kapat
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && sheet) closeSheet();
});

render();