// ========================================================
// TEKINMAIL // BLUEPRINT APP ENGINE
// ========================================================

const STORAGE_KEY_AUTH = 'tekinmail_user_session';
const STORAGE_KEY_HIDDEN = 'tekinmail_hidden_emails_';

// DOM AUTH
const authScreen = document.getElementById('authScreen');
const mainWorkspace = document.getElementById('mainWorkspace');
const userProfileBadge = document.getElementById('userProfileBadge');
const badgeFullName = document.getElementById('badgeFullName');
const badgeUsername = document.getElementById('badgeUsername');
const btnLogout = document.getElementById('btnLogout');

const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const formLogin = document.getElementById('formLogin');
const formRegister = document.getElementById('formRegister');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const regFullName = document.getElementById('regFullName');
const regUsername = document.getElementById('regUsername');
const regPassword = document.getElementById('regPassword');

// DOM WORKSPACE - EMAILS
const btnAddOne = document.getElementById('btnAddOne');
const emailSearchInput = document.getElementById('emailSearchInput');
const emailsListContainer = document.getElementById('emailsListContainer');

// DOM WORKSPACE - INBOX
const btnRefreshInbox = document.getElementById('btnRefreshInbox');
const inboxFilterTabs = document.getElementById('inboxFilterTabs');
const messagesListContainer = document.getElementById('messagesListContainer');

// DOM WORKSPACE - MOBILE VIEW
const btnMobileShowEmails = document.getElementById('btnMobileShowEmails');
const btnMobileShowInbox = document.getElementById('btnMobileShowInbox');
const mobileEmailsCount = document.getElementById('mobileEmailsCount');
const mobileInboxCount = document.getElementById('mobileInboxCount');
const colEmails = document.getElementById('colEmails');
const colInbox = document.getElementById('colInbox');

function switchMobileView(view) {
  if (view === 'inbox') {
    if (btnMobileShowInbox) btnMobileShowInbox.classList.add('active');
    if (btnMobileShowEmails) btnMobileShowEmails.classList.remove('active');
    if (colEmails) colEmails.classList.add('mobile-hidden');
    if (colInbox) colInbox.classList.remove('mobile-hidden');
  } else {
    if (btnMobileShowEmails) btnMobileShowEmails.classList.add('active');
    if (btnMobileShowInbox) btnMobileShowInbox.classList.remove('active');
    if (colEmails) colEmails.classList.remove('mobile-hidden');
    if (colInbox) colInbox.classList.add('mobile-hidden');
  }
}

if (btnMobileShowEmails) btnMobileShowEmails.addEventListener('click', () => switchMobileView('emails'));
if (btnMobileShowInbox) btnMobileShowInbox.addEventListener('click', () => switchMobileView('inbox'));

// DOM MODALS
const addEmailModal = document.getElementById('addEmailModal');
const addEmailBackdrop = document.getElementById('addEmailBackdrop');
const formAddCustomEmail = document.getElementById('formAddCustomEmail');
const customEmailPrefix = document.getElementById('customEmailPrefix');
const domainSuffixLabel = document.getElementById('domainSuffixLabel');
const btnAddEmailCancel = document.getElementById('btnAddEmailCancel');

const msgDetailModal = document.getElementById('msgDetailModal');
const msgDetailBackdrop = document.getElementById('msgDetailBackdrop');
const btnCloseMsgDetail = document.getElementById('btnCloseMsgDetail');
const msgDetailSubject = document.getElementById('msgDetailSubject');
const msgDetailFrom = document.getElementById('msgDetailFrom');
const msgDetailTo = document.getElementById('msgDetailTo');
const msgDetailDate = document.getElementById('msgDetailDate');
const msgDetailBody = document.getElementById('msgDetailBody');

// TOAST
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toastMsg');

// STATE
let currentUser = null; // { id, full_name, username, token }
let currentEmails = [];
let currentMessages = [];
let activeFilter = 'all'; // 'all' yoki email address
let activeDomain = 'bombaclat.uz';
let syncInterval = null;

// ==========================================
// 1. AUTH TABS
// ==========================================

tabLogin.addEventListener('click', () => {
  tabLogin.classList.add('active');
  tabRegister.classList.remove('active');
  formLogin.classList.remove('hidden');
  formRegister.classList.add('hidden');
  loginUsername.focus();
});

tabRegister.addEventListener('click', () => {
  tabRegister.classList.add('active');
  tabLogin.classList.remove('active');
  formRegister.classList.remove('hidden');
  formLogin.classList.add('hidden');
  regFullName.focus();
});

// ==========================================
// 2. SESSION & AUTH
// ==========================================

function checkSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUTH);
    if (raw) {
      currentUser = JSON.parse(raw);
      if (currentUser && currentUser.token && currentUser.id) {
        showWorkspace();
        return;
      }
    }
  } catch (e) {
    localStorage.removeItem(STORAGE_KEY_AUTH);
  }
  showAuth();
}

function saveSession(user, token) {
  currentUser = { ...user, token };
  localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(currentUser));
}

function logout() {
  localStorage.removeItem(STORAGE_KEY_AUTH);
  currentUser = null;
  currentEmails = [];
  currentMessages = [];
  if (syncInterval) clearInterval(syncInterval);
  showToast('Tizimdan chiqildi');
  showAuth();
}

btnLogout.addEventListener('click', logout);

const topNav = document.getElementById('topNav');

function showAuth() {
  authScreen.classList.remove('hidden');
  mainWorkspace.classList.add('hidden');
  userProfileBadge.classList.add('hidden');
  if (topNav) topNav.classList.add('hidden');
}

function showWorkspace() {
  authScreen.classList.add('hidden');
  mainWorkspace.classList.remove('hidden');
  userProfileBadge.classList.remove('hidden');
  if (topNav) topNav.classList.remove('hidden');

  badgeFullName.textContent = currentUser.full_name || 'Foydalanuvchi';
  badgeUsername.textContent = '@' + (currentUser.username || 'user');

  if (window.innerWidth <= 768) {
    switchMobileView('emails');
  }

  loadEmails();
  startSync();
}

// LOGIN SUBMIT
formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = loginUsername.value.trim();
  const password = loginPassword.value.trim();
  if (!username || !password) return;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.success && data.user && data.token) {
      saveSession(data.user, data.token);
      showToast(`Xush kelibsiz!`);
      formLogin.reset();
      showWorkspace();
    } else {
      showToast(data.error || 'Foydalanuvchi nomi yoki parol notoʻgʻri');
    }
  } catch (err) {
    showToast('Tarmoq xatosi');
  }
});

// REGISTER SUBMIT
formRegister.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fullName = regFullName.value.trim();
  const username = regUsername.value.trim();
  const password = regPassword.value.trim();
  if (!fullName || !username || !password) return;

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName, username, password })
    });
    const data = await res.json();

    if (data.success && data.user && data.token) {
      saveSession(data.user, data.token);
      showToast(`Root akkaunt ochildi!`);
      formRegister.reset();
      showWorkspace();
    } else {
      showToast(data.error || 'Roʻyxatdan oʻtishda xatolik');
    }
  } catch (err) {
    showToast('Tarmoq xatosi');
  }
});

// ==========================================
// 3. EMAILS & ADD +1 LOGIC
// ==========================================

async function loadEmails() {
  if (!currentUser) return;

  try {
    const res = await fetch('/api/get-emails', {
      headers: { 'Authorization': `Bearer ${currentUser.token}` }
    });
    const data = await res.json();

    if (data.success) {
      currentEmails = data.emails || [];
      if (data.domain) {
        activeDomain = data.domain;
        domainSuffixLabel.textContent = '@' + activeDomain;
      }
      renderEmails();
      renderInboxTabs();
      loadMessages();
    }
  } catch (err) {
    console.warn('Load emails failed:', err);
  }
}

// ADD +1 CLICK -> OPEN MODAL
btnAddOne.addEventListener('click', () => {
  customEmailPrefix.value = '';
  addEmailModal.classList.remove('hidden');
  customEmailPrefix.focus();
});

btnAddEmailCancel.addEventListener('click', () => addEmailModal.classList.add('hidden'));
addEmailBackdrop.addEventListener('click', () => addEmailModal.classList.add('hidden'));

formAddCustomEmail.addEventListener('submit', async (e) => {
  e.preventDefault();
  const prefix = customEmailPrefix.value.trim();
  addEmailModal.classList.add('hidden');

  try {
    const res = await fetch('/api/add-emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentUser.token}`
      },
      body: JSON.stringify({ prefix })
    });

    const data = await res.json();

    if (data.success && data.email) {
      currentEmails.unshift(data.email);
      renderEmails();
      renderInboxTabs();
      showToast(`+1 email qo'shildi: ${data.email.address}`);
    } else {
      showToast(data.error || 'Email qoʻshishda xatolik');
    }
  } catch (err) {
    showToast('Tarmoq xatosi');
  }
});

function getHiddenEmails() {
  try {
    const key = STORAGE_KEY_HIDDEN + (currentUser ? currentUser.id : 'global');
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch (e) {
    return [];
  }
}

function hideEmail(address, event) {
  if (event) event.stopPropagation();
  const hidden = getHiddenEmails();
  if (!hidden.includes(address)) {
    hidden.push(address);
    const key = STORAGE_KEY_HIDDEN + (currentUser ? currentUser.id : 'global');
    localStorage.setItem(key, JSON.stringify(hidden));
  }
  renderEmails();
  renderInboxTabs();
  showToast('Yashirildi: ' + address);
}

// RENDER LEFT EMAILS LIST (ESKIZDAGIDEK)
function renderEmails() {
  const query = (emailSearchInput.value || '').trim().toLowerCase();
  const hidden = getHiddenEmails();
  const visible = currentEmails.filter(e => !hidden.includes(e.address));
  const filtered = visible.filter(e => e.address.toLowerCase().includes(query));

  if (mobileEmailsCount) mobileEmailsCount.textContent = visible.length;

  if (filtered.length === 0) {
    emailsListContainer.innerHTML = `
      <div class="empty-box">
        <p>${query ? 'Bunday email topilmadi' : 'Hozircha emaillar yoʻq'}</p>
        <span style="font-size:12px; color:#64748b;">ADD +1 tugmasini bosing</span>
      </div>
    `;
    return;
  }

  // Avatar bosh harfi
  const initial = (currentUser && currentUser.full_name) ? currentUser.full_name.charAt(0).toUpperCase() : 'M';
  const ownerName = currentUser ? currentUser.full_name : 'Qosimov Muhammadrasul';

  emailsListContainer.innerHTML = filtered.map(item => {
    const isSelected = activeFilter === item.address;
    return `
      <div class="email-card ${isSelected ? 'selected' : ''}" onclick="selectEmailTab('${item.address}')">
        <div class="email-avatar">${initial}</div>
        <div class="email-info">
          <div class="email-address-text" title="${escapeHtml(item.address)}">${escapeHtml(item.address)}</div>
          <div class="email-owner-text">${escapeHtml(ownerName)}</div>
        </div>
        <div class="email-card-actions">
          <button class="btn-card-copy" onclick="copyToClipboard('${item.address}', event)" title="Nusxalash">copy</button>
          <button class="btn-card-del" onclick="hideEmail('${item.address}', event)" title="Yashirish">&times;</button>
        </div>
      </div>
    `;
  }).join('');
}

emailSearchInput.addEventListener('input', renderEmails);

// ==========================================
// 4. INBOX RED FILTER TABS & MESSAGES
// ==========================================

function renderInboxTabs() {
  const hidden = getHiddenEmails();
  const visible = currentEmails.filter(e => !hidden.includes(e.address));

  let html = `<button class="filter-tab ${activeFilter === 'all' ? 'active' : ''}" onclick="selectEmailTab('all')">Barchasi</button>`;

  visible.forEach(item => {
    const isActive = activeFilter === item.address;
    // Tab text qisqartmasi (masalan mrdev@...uz)
    const shortLabel = item.address.length > 16 
      ? item.address.substring(0, item.address.indexOf('@') + 1) + '...' + item.address.slice(-3) 
      : item.address;

    html += `
      <button class="filter-tab ${isActive ? 'active' : ''}" onclick="selectEmailTab('${item.address}')" title="${escapeHtml(item.address)}">
        ${escapeHtml(shortLabel)}
      </button>
    `;
  });

  inboxFilterTabs.innerHTML = html;
}

window.selectEmailTab = function(address) {
  activeFilter = address;
  renderInboxTabs();
  renderEmails(); // Chap tomonda tanlangan kartani ajratib ko'rsatish
  loadMessages();
  if (window.innerWidth <= 768) {
    switchMobileView('inbox');
  }
};

async function loadMessages() {
  if (!currentUser) return;

  try {
    const url = `/api/get-messages?email=${encodeURIComponent(activeFilter)}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${currentUser.token}` }
    });
    const data = await res.json();

    if (data.success) {
      currentMessages = data.messages || [];
      renderMessages();
    }
  } catch (err) {
    console.warn('Load messages failed:', err);
  }
}

btnRefreshInbox.addEventListener('click', () => {
  loadMessages();
  showToast('Inbox yangilandi');
});

function renderMessages() {
  if (mobileInboxCount) mobileInboxCount.textContent = currentMessages.length;

  if (currentMessages.length === 0) {
    messagesListContainer.innerHTML = `
      <div class="empty-box">
        <p>Hech qanday xat kelmagan</p>
        <span style="font-size:12px; color:#94a3b8;">Claude yoki boshqa saytdan yuborilgan kodlar shu yerda paydo bo'ladi</span>
      </div>
    `;
    return;
  }

  messagesListContainer.innerHTML = currentMessages.map(msg => {
    const timeFormatted = formatTime(msg.created_at);
    const snippet = msg.body ? msg.body.substring(0, 70) : 'Welcome to the platform.';
    const sender = msg.from_name || 'Supabase';

    return `
      <div class="msg-row" onclick="openMessageModal('${msg.id}')">
        <div class="msg-check" onclick="event.stopPropagation()">
          <input type="checkbox">
        </div>
        <div class="msg-sender" title="${escapeHtml(sender)}">${escapeHtml(sender)}</div>
        <div class="msg-subject-snippet">
          <strong>${escapeHtml(msg.subject || 'Welcome to Supabase')}</strong>
          <span>${escapeHtml(snippet)}...</span>
        </div>
        <div class="msg-time">${timeFormatted}</div>
        <div class="msg-star ${msg.is_starred ? 'active' : ''}" onclick="toggleStar('${msg.id}', event)">
          ${msg.is_starred ? '★' : '☆'}
        </div>
      </div>
    `;
  }).join('');
}

// MESSAGE MODAL VIEW
window.openMessageModal = function(msgId) {
  const msg = currentMessages.find(m => m.id === msgId);
  if (!msg) return;

  msgDetailSubject.textContent = msg.subject || 'No Subject';
  msgDetailFrom.textContent = `From: ${msg.from_name || ''} <${msg.from_address || ''}>`;
  msgDetailTo.textContent = `To: ${msg.email_address}`;
  msgDetailDate.textContent = `Date: ${new Date(msg.created_at).toLocaleString()}`;

  if (msg.html) {
    msgDetailBody.innerHTML = msg.html;
  } else {
    msgDetailBody.innerHTML = `<pre style="white-space:pre-wrap; font-family:var(--font-mono);">${escapeHtml(msg.body || '')}</pre>`;
  }

  msgDetailModal.classList.remove('hidden');
};

btnCloseMsgDetail.addEventListener('click', () => msgDetailModal.classList.add('hidden'));
msgDetailBackdrop.addEventListener('click', () => msgDetailModal.classList.add('hidden'));

window.toggleStar = function(msgId, event) {
  event.stopPropagation();
  const msg = currentMessages.find(m => m.id === msgId);
  if (msg) {
    msg.is_starred = !msg.is_starred;
    renderMessages();
  }
};

// AUTO SYNC EVERY 8 SECONDS
function startSync() {
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(() => {
    if (currentUser) {
      loadMessages();
    }
  }, 8000);
}

// ==========================================
// 5. UTILITIES
// ==========================================

window.copyToClipboard = function(text, event) {
  if (event) event.stopPropagation();
  navigator.clipboard.writeText(text).then(() => {
    showToast(`Nusxalandi: ${text}`);
  });
};

function showToast(text) {
  toastMsg.textContent = text;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2200);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatTime(iso) {
  if (!iso) return '12:45';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// BOOTSTRAP
checkSession();
