// ========================================================
// TEKINMAIL // BLUEPRINT APP ENGINE
// ========================================================

const STORAGE_KEY_AUTH = 'tekinmail_user_session';
const STORAGE_KEY_HIDDEN = 'tekinmail_hidden_emails_';
const SPLASH_MIN_DURATION = 2000;
const splashStartTime = Date.now();

function dismissSplashScreen() {
  const splash = document.getElementById('splashScreen');
  if (!splash) return;
  const elapsed = Date.now() - splashStartTime;
  const remaining = Math.max(0, SPLASH_MIN_DURATION - elapsed);
  setTimeout(() => {
    splash.classList.add('splash-fade-out');
    setTimeout(() => {
      splash.style.display = 'none';
    }, 550);
  }, remaining);
}

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

// DOM DELETE MODAL
const deleteConfirmModal = document.getElementById('deleteConfirmModal');
const deleteConfirmBackdrop = document.getElementById('deleteConfirmBackdrop');
const deleteTargetAddress = document.getElementById('deleteTargetAddress');
const btnCancelDelete = document.getElementById('btnCancelDelete');
const btnConfirmDelete = document.getElementById('btnConfirmDelete');

// TOAST
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toastMsg');

// STATE
let currentUser = null; // { id, full_name, username, token, is_admin }
let currentEmails = [];
let currentMessages = [];
let activeFilter = 'all'; // 'all' yoki email address
let activeDomain = 'bombaclat.uz';
let syncInterval = null;
let emailToDelete = null;

// ADMIN STATE
let adminUsers = [];
let adminUserToDelete = null;
let adminInspectData = { user: null, emails: [], messages: [] };
let adminCurrentInspectTab = 'emails';

// SKELETON LOADERS
function renderEmailsSkeleton() {
  if (!emailsListContainer) return;
  emailsListContainer.innerHTML = Array(4).fill(0).map(() => `
    <div class="skeleton-card">
      <div class="skeleton-avatar"></div>
      <div class="skeleton-info">
        <div class="skeleton-line skeleton-addr"></div>
        <div class="skeleton-line skeleton-sub"></div>
      </div>
      <div class="skeleton-badge"></div>
    </div>
  `).join('');
}

function renderMessagesSkeleton() {
  if (!messagesListContainer) return;
  messagesListContainer.innerHTML = Array(5).fill(0).map(() => `
    <div class="skeleton-msg-row">
      <div class="skeleton-check"></div>
      <div class="skeleton-sender"></div>
      <div class="skeleton-snippet"></div>
      <div class="skeleton-time"></div>
    </div>
  `).join('');
}

// DELETE MODAL ACTIONS
window.openDeleteModal = function(address, event) {
  if (event) event.stopPropagation();
  emailToDelete = address;
  if (deleteTargetAddress) deleteTargetAddress.textContent = address;
  if (deleteConfirmModal) deleteConfirmModal.classList.remove('hidden');
};

function closeDeleteModal() {
  emailToDelete = null;
  if (deleteConfirmModal) deleteConfirmModal.classList.add('hidden');
}

if (btnCancelDelete) btnCancelDelete.addEventListener('click', closeDeleteModal);
if (deleteConfirmBackdrop) deleteConfirmBackdrop.addEventListener('click', closeDeleteModal);

if (btnConfirmDelete) {
  btnConfirmDelete.addEventListener('click', async () => {
    if (!emailToDelete || !currentUser) return;
    const targetAddress = emailToDelete;
    setButtonLoading(btnConfirmDelete, true, 'Oʻchirilmoqda...');

    try {
      const res = await fetch('/api/delete-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({ address: targetAddress })
      });
      const data = await res.json();

      if (data.success) {
        currentEmails = currentEmails.filter(e => e.address !== targetAddress);
        if (activeFilter === targetAddress) {
          activeFilter = 'all';
        }
        closeDeleteModal();
        renderEmails();
        renderInboxTabs();
        loadMessages();
        showToast(`Email bazadan butunlay oʻchirildi`);
      } else {
        showToast(data.error || 'Emailni oʻchirishda xatolik');
      }
    } catch (err) {
      showToast('Tarmoq xatosi');
    } finally {
      setButtonLoading(btnConfirmDelete, false, 'Ha, butunlay oʻchirilsin');
    }
  });
}

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
  dismissSplashScreen();
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
  document.body.classList.remove('workspace-active');
  authScreen.classList.remove('hidden');
  mainWorkspace.classList.add('hidden');
  const adminWs = document.getElementById('adminWorkspace');
  if (adminWs) adminWs.classList.add('hidden');
  userProfileBadge.classList.add('hidden');
  const adminNavSwitcher = document.getElementById('adminNavSwitcher');
  if (adminNavSwitcher) adminNavSwitcher.classList.add('hidden');
  if (topNav) topNav.classList.add('hidden');
}

function showWorkspace() {
  document.body.classList.add('workspace-active');
  authScreen.classList.add('hidden');
  mainWorkspace.classList.remove('hidden');
  const adminWs = document.getElementById('adminWorkspace');
  if (adminWs) adminWs.classList.add('hidden');
  userProfileBadge.classList.remove('hidden');
  if (topNav) topNav.classList.remove('hidden');

  // Admin nav switcher — faqat admin userga ko'rsatish
  const adminNavSwitcher = document.getElementById('adminNavSwitcher');
  if (adminNavSwitcher) {
    if (currentUser && currentUser.is_admin) {
      adminNavSwitcher.classList.remove('hidden');
    } else {
      adminNavSwitcher.classList.add('hidden');
    }
  }

  // Active tab indicator
  const btnTabWorkspace = document.getElementById('btnTabWorkspace');
  const btnTabAdminUsers = document.getElementById('btnTabAdminUsers');
  if (btnTabWorkspace) btnTabWorkspace.classList.add('active');
  if (btnTabAdminUsers) btnTabAdminUsers.classList.remove('active');

  badgeFullName.textContent = currentUser.full_name || 'Foydalanuvchi';
  badgeUsername.textContent = '@' + (currentUser.username || 'user');

  if (window.innerWidth <= 768) {
    switchMobileView('emails');
  }

  loadEmails();
  startSync();
}

function showAdminPanel() {
  document.body.classList.add('workspace-active');
  authScreen.classList.add('hidden');
  mainWorkspace.classList.add('hidden');
  const adminWs = document.getElementById('adminWorkspace');
  if (adminWs) adminWs.classList.remove('hidden');
  userProfileBadge.classList.remove('hidden');
  if (topNav) topNav.classList.remove('hidden');

  const adminNavSwitcher = document.getElementById('adminNavSwitcher');
  if (adminNavSwitcher) adminNavSwitcher.classList.remove('hidden');

  const btnTabWorkspace = document.getElementById('btnTabWorkspace');
  const btnTabAdminUsers = document.getElementById('btnTabAdminUsers');
  if (btnTabWorkspace) btnTabWorkspace.classList.remove('active');
  if (btnTabAdminUsers) btnTabAdminUsers.classList.add('active');

  badgeFullName.textContent = currentUser.full_name || 'Admin';
  badgeUsername.textContent = '@' + (currentUser.username || 'admin');

  loadAdminUsers();
}

// Admin nav tab listeners
document.addEventListener('DOMContentLoaded', () => {
  const btnTabWorkspace = document.getElementById('btnTabWorkspace');
  const btnTabAdminUsers = document.getElementById('btnTabAdminUsers');
  if (btnTabWorkspace) btnTabWorkspace.addEventListener('click', showWorkspace);
  if (btnTabAdminUsers) btnTabAdminUsers.addEventListener('click', showAdminPanel);
});


// LANDING INTERACTION HELPERS
window.toggleFaq = function(element) {
  if (!element) return;
  const isOpen = element.classList.contains('open');
  document.querySelectorAll('.faq-item').forEach(el => el.classList.remove('open'));
  if (!isOpen) {
    element.classList.add('open');
  }
};

window.scrollToAuthBox = function() {
  const box = document.getElementById('authCardBox');
  if (box) {
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const input = document.getElementById('loginUsername');
    if (input) setTimeout(() => input.focus(), 450);
  }
};

// BUTTON SPINNER HELPER
function setButtonLoading(button, isLoading, originalText) {
  if (!button) return;
  if (isLoading) {
    button.disabled = true;
    button.classList.add('loading');
    button.innerHTML = `<span class="btn-spinner-icon"></span><span>Kutilmoqda...</span>`;
  } else {
    button.disabled = false;
    button.classList.remove('loading');
    button.innerHTML = originalText;
  }
}

// LOGIN SUBMIT
formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = loginUsername.value.trim();
  const password = loginPassword.value.trim();
  if (!username || !password) return;

  setButtonLoading(btnLoginSubmit, true, 'Tizimga kirish');

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
  } finally {
    setButtonLoading(btnLoginSubmit, false, 'Tizimga kirish');
  }
});

// REGISTER SUBMIT
formRegister.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fullName = regFullName.value.trim();
  const username = regUsername.value.trim();
  const password = regPassword.value.trim();
  if (!fullName || !username || !password) return;

  setButtonLoading(btnRegisterSubmit, true, 'Root akkaunt yaratish');

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
  } finally {
    setButtonLoading(btnRegisterSubmit, false, 'Root akkaunt yaratish');
  }
});

// ==========================================
// 3. EMAILS & ADD +1 LOGIC
// ==========================================

async function loadEmails() {
  if (!currentUser) return;
  if (currentEmails.length === 0) {
    renderEmailsSkeleton();
    renderMessagesSkeleton();
  }

  try {
    const res = await fetch('/api/get-emails', {
      headers: { 'Authorization': `Bearer ${currentUser.token}` }
    });
    const data = await res.json();

    if (data.success) {
      currentEmails = data.emails || [];
      activeDomain = (data.domain && !data.domain.includes('tekinmail')) ? data.domain : 'bombaclat.uz';
      if (domainSuffixLabel) {
        domainSuffixLabel.textContent = '@' + activeDomain;
      }
      renderEmails();
      renderInboxTabs();
      loadMessages();
    }
  } catch (err) {
    console.warn('Load emails failed:', err);
  } finally {
    dismissSplashScreen();
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
          <button class="btn-card-del" onclick="openDeleteModal('${escapeHtml(item.address)}', event)" title="Oʻchirib tashlash">&times;</button>
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
  if (currentMessages.length === 0) {
    renderMessagesSkeleton();
  }

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

// ==========================================
// EMAIL PARSING & DECODING HELPERS
// ==========================================
function decodeQuotedPrintableClient(str) {
  if (!str) return '';
  const unsoft = str.replace(/=(?:\r\n|\n|\r)/g, '');
  return unsoft.replace(/((?:=[0-9A-Fa-f]{2})+)/g, (match) => {
    try {
      const bytes = [];
      for (let i = 0; i < match.length; i += 3) {
        bytes.push(parseInt(match.substr(i + 1, 2), 16));
      }
      return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    } catch (e) {
      return match;
    }
  });
}

function cleanSnippetText(text) {
  if (!text) return 'Xat matni yoʻq';
  let clean = decodeQuotedPrintableClient(text);
  clean = clean.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
               .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
               .replace(/<[^>]+>/g, ' ')
               .replace(/\s+/g, ' ')
               .trim();
  return clean.substring(0, 80);
}

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
    const snippet = cleanSnippetText(msg.body);
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

// MESSAGE MODAL VIEW (1:1 RICH EMAIL WITH BEAUTIFUL HTML PREVIEW)
window.openMessageModal = function(msgId) {
  const msg = currentMessages.find(m => m.id === msgId);
  if (!msg) return;

  msgDetailSubject.textContent = msg.subject || 'Mavzusiz';
  msgDetailFrom.textContent = `Kimdan: ${msg.from_name || ''} <${msg.from_address || ''}>`;
  msgDetailTo.textContent = `Kimga: ${msg.email_address}`;
  msgDetailDate.textContent = `Sana: ${new Date(msg.created_at).toLocaleString()}`;

  msgDetailBody.innerHTML = '';

  let rawHtml = msg.html;
  if (!rawHtml && msg.body && (msg.body.includes('<!doctype html') || msg.body.includes('<html'))) {
    rawHtml = msg.body;
  }

  if (rawHtml) {
    let decodedHtml = decodeQuotedPrintableClient(rawHtml);

    // Rasmlarni to'siqsiz yuklash uchun no-referrer va barcha linklar yangi oynada ochilishi uchun base target
    if (decodedHtml.includes('<head>')) {
      decodedHtml = decodedHtml.replace('<head>', '<head><meta name="referrer" content="no-referrer"><base target="_blank">');
    } else if (decodedHtml.includes('<head ')) {
      decodedHtml = decodedHtml.replace(/<head[^>]*>/, '$&<meta name="referrer" content="no-referrer"><base target="_blank">');
    } else {
      decodedHtml = '<meta name="referrer" content="no-referrer"><base target="_blank">' + decodedHtml;
    }

    // Barcha img teglariga referrerpolicy="no-referrer" qo'shamiz
    decodedHtml = decodedHtml.replace(/<img\s+/gi, '<img referrerpolicy="no-referrer" ');

    const wrap = document.createElement('div');
    wrap.className = 'msg-iframe-wrap';

    const iframe = document.createElement('iframe');
    iframe.className = 'msg-email-frame';
    // Sandbox olib tashlandi - rasmlar to'liq va erkin yuklanadi
    iframe.srcdoc = decodedHtml;

    iframe.onload = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc && doc.body) {
          const scrollH = doc.body.scrollHeight;
          if (scrollH > 350) {
            iframe.style.height = (scrollH + 40) + 'px';
          }
        }
      } catch (e) {}
    };

    wrap.appendChild(iframe);
    msgDetailBody.appendChild(wrap);
  } else {
    const card = document.createElement('div');
    card.className = 'msg-plain-card';
    card.innerHTML = `<pre style="white-space:pre-wrap; font-family:var(--font-sans); font-size:13.5px; line-height:1.6; color:#f4f4f6;">${escapeHtml(msg.body || '')}</pre>`;
    msgDetailBody.appendChild(card);
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

// ==========================================
// 6. ADMIN PANEL LOGIC
// ==========================================

// -- Load users --
async function loadAdminUsers() {
  const list = document.getElementById('adminUsersList');
  if (!list || !currentUser) return;
  list.innerHTML = `<div style="padding:40px; text-align:center; color:#555; font-size:13px; grid-column:1/-1;">Yuklanmoqda...</div>`;

  try {
    const res = await fetch('/api/admin-users', {
      headers: { 'Authorization': `Bearer ${currentUser.token}` }
    });
    const data = await res.json();
    if (!data.success) { showToast(data.error || 'Xatolik'); return; }

    adminUsers = data.users || [];
    const stats = data.stats || {};
    const statUsers = document.getElementById('adminStatTotalUsers');
    const statEmails = document.getElementById('adminStatTotalEmails');
    const statMsgs = document.getElementById('adminStatTotalMessages');
    if (statUsers) statUsers.textContent = stats.total_users || 0;
    if (statEmails) statEmails.textContent = stats.total_emails || 0;
    if (statMsgs) statMsgs.textContent = stats.total_messages || 0;

    renderAdminUsers(adminUsers);
  } catch (err) {
    showToast('Server bilan aloqa uzildi');
  }
}

function renderAdminUsers(users) {
  const list = document.getElementById('adminUsersList');
  if (!list) return;

  if (!users || users.length === 0) {
    list.innerHTML = `<div class="admin-empty-state" style="grid-column:1/-1;">Hozircha hech qanday foydalanuvchi yoʻq.</div>`;
    return;
  }

  list.innerHTML = users.map(u => {
    const initial = (u.full_name || u.username || 'U')[0].toUpperCase();
    const isAdmin = u.is_admin || u.username?.toLowerCase() === 'admin';
    const isSelf = u.id === currentUser.id;
    const joinedDate = u.created_at ? new Date(u.created_at).toLocaleDateString('uz-UZ') : '–';
    return `
      <div class="admin-user-card" data-user-id="${u.id}">
        <div class="admin-user-card-head">
          <div class="admin-user-avatar ${isAdmin ? 'admin-user-avatar-gold' : ''}">${initial}</div>
          <div class="admin-user-info">
            <div class="admin-user-name-row">
              <span class="admin-user-fullname">${escapeHtml(u.full_name || '–')}</span>
              <span class="admin-role-badge-pill ${isAdmin ? 'badge-admin' : 'badge-user'}">${isAdmin ? 'Admin' : 'User'}</span>
            </div>
            <div class="admin-user-handle">@${escapeHtml(u.username || '–')}</div>
          </div>
        </div>

        <div class="admin-user-meta-chips">
          <div class="admin-meta-chip">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            <span>Emaillar: <strong>${u.email_count || 0}</strong></span>
          </div>
          <div class="admin-meta-chip">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
            <span>Xatlar: <strong>${u.message_count || 0}</strong></span>
          </div>
          <div class="admin-meta-chip">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>${joinedDate}</span>
          </div>
        </div>

        <div class="admin-user-actions-row">
          <button class="admin-btn-action" onclick="openAdminUserDetail('${u.id}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Ko'rish
          </button>
          <button class="admin-btn-delete" ${isSelf ? 'disabled title="O\'z akkauntingizni o\'chira olmaysiz"' : `onclick="openAdminDeleteUser('${u.id}', '${escapeHtml(u.full_name || u.username)}', '${escapeHtml(u.username)}')"`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            O'chirish
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// -- Admin search filter --
const adminSearchInput = document.getElementById('adminSearchInput');
if (adminSearchInput) {
  adminSearchInput.addEventListener('input', () => {
    const q = adminSearchInput.value.trim().toLowerCase();
    if (!q) { renderAdminUsers(adminUsers); return; }
    const filtered = adminUsers.filter(u =>
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q)
    );
    renderAdminUsers(filtered);
  });
}

// -- Refresh button --
const btnAdminRefresh = document.getElementById('btnAdminRefresh');
if (btnAdminRefresh) {
  btnAdminRefresh.addEventListener('click', loadAdminUsers);
}

// -- ADD USER MODAL --
const btnAdminAddUser = document.getElementById('btnAdminAddUser');
const adminAddUserModal = document.getElementById('adminAddUserModal');
const adminAddUserBackdrop = document.getElementById('adminAddUserBackdrop');
const btnAdminAddUserCancel = document.getElementById('btnAdminAddUserCancel');
const formAdminAddUser = document.getElementById('formAdminAddUser');

if (btnAdminAddUser) btnAdminAddUser.addEventListener('click', () => {
  if (formAdminAddUser) formAdminAddUser.reset();
  if (adminAddUserModal) adminAddUserModal.classList.remove('hidden');
});
if (btnAdminAddUserCancel) btnAdminAddUserCancel.addEventListener('click', () => {
  if (adminAddUserModal) adminAddUserModal.classList.add('hidden');
});
if (adminAddUserBackdrop) adminAddUserBackdrop.addEventListener('click', () => {
  if (adminAddUserModal) adminAddUserModal.classList.add('hidden');
});

if (formAdminAddUser) {
  formAdminAddUser.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = document.getElementById('adminNewFullName')?.value.trim();
    const username = document.getElementById('adminNewUsername')?.value.trim();
    const password = document.getElementById('adminNewPassword')?.value.trim();
    const isAdmin = document.getElementById('adminNewIsAdmin')?.checked || false;

    if (!fullName || !username || !password) return;

    const btn = document.getElementById('btnAdminAddUserConfirm');
    setButtonLoading(btn, true, 'Userni Saqlash');
    try {
      const res = await fetch('/api/admin-create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentUser.token}` },
        body: JSON.stringify({ full_name: fullName, username, password, is_admin: isAdmin })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✓ "${fullName}" (@${username}) muvaffaqiyatli qoʻshildi`);
        adminAddUserModal.classList.add('hidden');
        loadAdminUsers();
      } else {
        showToast(data.error || 'Yaratishda xatolik');
      }
    } catch (err) {
      showToast('Server bilan aloqa uzildi');
    } finally {
      setButtonLoading(btn, false, 'Userni Saqlash');
    }
  });
}

// -- DELETE USER MODAL --
const adminDeleteUserModal = document.getElementById('adminDeleteUserModal');
const adminDeleteUserBackdrop = document.getElementById('adminDeleteUserBackdrop');
const btnAdminCancelDelete = document.getElementById('btnAdminCancelDelete');
const btnAdminConfirmDelete = document.getElementById('btnAdminConfirmDelete');
const adminDeleteTargetInfo = document.getElementById('adminDeleteTargetInfo');

window.openAdminDeleteUser = function(userId, fullName, username) {
  adminUserToDelete = userId;
  if (adminDeleteTargetInfo) adminDeleteTargetInfo.textContent = `${fullName} (@${username})`;
  if (adminDeleteUserModal) adminDeleteUserModal.classList.remove('hidden');
};

function closeAdminDeleteModal() {
  adminUserToDelete = null;
  if (adminDeleteUserModal) adminDeleteUserModal.classList.add('hidden');
}

if (btnAdminCancelDelete) btnAdminCancelDelete.addEventListener('click', closeAdminDeleteModal);
if (adminDeleteUserBackdrop) adminDeleteUserBackdrop.addEventListener('click', closeAdminDeleteModal);

if (btnAdminConfirmDelete) {
  btnAdminConfirmDelete.addEventListener('click', async () => {
    if (!adminUserToDelete || !currentUser) return;
    const targetId = adminUserToDelete;
    setButtonLoading(btnAdminConfirmDelete, true, "Ha, butunlay o'chirilsin");
    try {
      const res = await fetch('/api/admin-delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentUser.token}` },
        body: JSON.stringify({ user_id: targetId })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Foydalanuvchi muvaffaqiyatli oʻchirildi');
        closeAdminDeleteModal();
        loadAdminUsers();
      } else {
        showToast(data.error || "O'chirishda xatolik");
      }
    } catch (err) {
      showToast('Server bilan aloqa uzildi');
    } finally {
      setButtonLoading(btnAdminConfirmDelete, false, "Ha, butunlay o'chirilsin");
    }
  });
}

// -- USER DETAIL INSPECTOR MODAL --
const adminUserDetailModal = document.getElementById('adminUserDetailModal');
const adminUserDetailBackdrop = document.getElementById('adminUserDetailBackdrop');
const btnCloseAdminUserDetail = document.getElementById('btnCloseAdminUserDetail');
const btnTabInspectEmails = document.getElementById('btnTabInspectEmails');
const btnTabInspectMessages = document.getElementById('btnTabInspectMessages');
const adminInspectEmailsPanel = document.getElementById('adminInspectEmailsPanel');
const adminInspectMessagesPanel = document.getElementById('adminInspectMessagesPanel');

function closeAdminUserDetail() {
  if (adminUserDetailModal) adminUserDetailModal.classList.add('hidden');
}
if (btnCloseAdminUserDetail) btnCloseAdminUserDetail.addEventListener('click', closeAdminUserDetail);
if (adminUserDetailBackdrop) adminUserDetailBackdrop.addEventListener('click', closeAdminUserDetail);

// Inspector tab switching
if (btnTabInspectEmails) {
  btnTabInspectEmails.addEventListener('click', () => {
    adminCurrentInspectTab = 'emails';
    btnTabInspectEmails.classList.add('active');
    btnTabInspectMessages?.classList.remove('active');
    adminInspectEmailsPanel?.classList.remove('hidden');
    adminInspectMessagesPanel?.classList.add('hidden');
  });
}
if (btnTabInspectMessages) {
  btnTabInspectMessages.addEventListener('click', () => {
    adminCurrentInspectTab = 'messages';
    btnTabInspectMessages.classList.add('active');
    btnTabInspectEmails?.classList.remove('active');
    adminInspectMessagesPanel?.classList.remove('hidden');
    adminInspectEmailsPanel?.classList.add('hidden');
    renderAdminInspectMessages();
  });
}

window.openAdminUserDetail = async function(userId) {
  if (!currentUser) return;
  // Reset tabs
  adminCurrentInspectTab = 'emails';
  if (btnTabInspectEmails) btnTabInspectEmails.classList.add('active');
  if (btnTabInspectMessages) btnTabInspectMessages.classList.remove('active');
  if (adminInspectEmailsPanel) adminInspectEmailsPanel.classList.remove('hidden');
  if (adminInspectMessagesPanel) adminInspectMessagesPanel.classList.add('hidden');

  // Show modal with loading state
  if (adminUserDetailModal) adminUserDetailModal.classList.remove('hidden');
  const emailsList = document.getElementById('adminInspectEmailsList');
  if (emailsList) emailsList.innerHTML = `<div class="admin-empty-state">Yuklanmoqda...</div>`;

  try {
    const res = await fetch(`/api/admin-user-details?user_id=${userId}`, {
      headers: { 'Authorization': `Bearer ${currentUser.token}` }
    });
    const data = await res.json();
    if (!data.success) { showToast(data.error || 'Xatolik'); closeAdminUserDetail(); return; }

    adminInspectData = { user: data.user, emails: data.emails || [], messages: data.messages || [] };
    const u = data.user;

    // Fill header
    const initial = (u.full_name || u.username || 'U')[0].toUpperCase();
    const avatarEl = document.getElementById('adminDetailAvatar');
    if (avatarEl) avatarEl.textContent = initial;
    const nameEl = document.getElementById('adminDetailFullName');
    if (nameEl) nameEl.textContent = u.full_name || '–';
    const usernameEl = document.getElementById('adminDetailUsername');
    if (usernameEl) usernameEl.textContent = '@' + (u.username || '–');
    const joinedEl = document.getElementById('adminDetailJoined');
    if (joinedEl) joinedEl.textContent = `Aʼzo boʻlgan: ${u.created_at ? new Date(u.created_at).toLocaleDateString('uz-UZ') : '–'}`;

    // Update counts
    const emailsCount = document.getElementById('adminInspectEmailsCount');
    const messagesCount = document.getElementById('adminInspectMessagesCount');
    if (emailsCount) emailsCount.textContent = adminInspectData.emails.length;
    if (messagesCount) messagesCount.textContent = adminInspectData.messages.length;

    // Render emails tab
    renderAdminInspectEmails();

  } catch (err) {
    showToast('Server bilan aloqa uzildi');
    closeAdminUserDetail();
  }
};

function renderAdminInspectEmails() {
  const list = document.getElementById('adminInspectEmailsList');
  if (!list) return;
  const emails = adminInspectData.emails;
  if (!emails || emails.length === 0) {
    list.innerHTML = `<div class="admin-empty-state">Bu foydalanuvchida hech qanday email manzili yoʻq.</div>`;
    return;
  }
  list.innerHTML = emails.map(email => {
    const date = email.created_at ? new Date(email.created_at).toLocaleDateString('uz-UZ') : '–';
    return `
      <div class="admin-inspect-item-card">
        <span style="font-family:var(--font-mono); font-size:13px; color:#38bdf8; font-weight:600;">${escapeHtml(email.address)}</span>
        <span style="font-size:11px; color:var(--text-dim); font-family:var(--font-mono);">${date}</span>
      </div>
    `;
  }).join('');
}

function renderAdminInspectMessages() {
  const list = document.getElementById('adminInspectMessagesList');
  if (!list) return;
  const messages = adminInspectData.messages;
  if (!messages || messages.length === 0) {
    list.innerHTML = `<div class="admin-empty-state">Bu foydalanuvchiga hali hech qanday xat kelganmagan.</div>`;
    return;
  }
  list.innerHTML = messages.map(msg => {
    const date = msg.created_at ? new Date(msg.created_at).toLocaleString('uz-UZ') : '–';
    const snippet = (msg.body || msg.subject || '').replace(/<[^>]+>/g, '').substring(0, 90);
    return `
      <div class="admin-inspect-msg-card" onclick='adminViewMessage(${JSON.stringify(msg.id)})'>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <span style="font-size:13px; font-weight:600; color:#fff; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(msg.subject || '(Mavzusiz)')}</span>
          <span style="font-size:11px; color:var(--text-dim); flex-shrink:0;">${date}</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:12px; color:var(--text-secondary);">${escapeHtml(msg.from_name || msg.from_address || 'Noma\u02bclum')}</span>
          <span style="font-size:11px; color:var(--text-dim);">→ ${escapeHtml(msg.email_address || '')}</span>
        </div>
        ${snippet ? `<div style="font-size:12px; color:var(--text-dim); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(snippet)}…</div>` : ''}
      </div>
    `;
  }).join('');
}

// Admin can view a user's message (reuses existing openMessageModal)
window.adminViewMessage = function(msgId) {
  const msg = adminInspectData.messages.find(m => m.id === msgId);
  if (msg && window.openMessageModal) {
    openMessageModal(msg);
  }
};

// BOOTSTRAP
checkSession();

