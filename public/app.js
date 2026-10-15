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

const formLogin = document.getElementById('formLogin');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const btnLoginSubmit = document.getElementById('btnLoginSubmit');

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

let currentMobileView = 'inbox';

function switchMobileView(view) {
  currentMobileView = view;
  if (view === 'emails') {
    if (btnMobileShowEmails) btnMobileShowEmails.classList.add('active');
    if (btnMobileShowInbox) btnMobileShowInbox.classList.remove('active');
    if (colEmails) colEmails.classList.remove('mobile-hidden');
    if (colInbox) colInbox.classList.add('mobile-hidden');
  } else {
    if (btnMobileShowInbox) btnMobileShowInbox.classList.add('active');
    if (btnMobileShowEmails) btnMobileShowEmails.classList.remove('active');
    if (colEmails) colEmails.classList.add('mobile-hidden');
    if (colInbox) colInbox.classList.remove('mobile-hidden');
  }
}

if (btnMobileShowEmails) btnMobileShowEmails.addEventListener('click', () => switchMobileView('emails'));
if (btnMobileShowInbox) btnMobileShowInbox.addEventListener('click', () => switchMobileView('inbox'));

window.addEventListener('resize', () => {
  if (window.innerWidth <= 900) {
    switchMobileView(currentMobileView);
  } else {
    if (colEmails) colEmails.classList.remove('mobile-hidden');
    if (colInbox) colInbox.classList.remove('mobile-hidden');
  }
});

// DOM MODALS
const addEmailModal = document.getElementById('addEmailModal');
const addEmailBackdrop = document.getElementById('addEmailBackdrop');
const formAddCustomEmail = document.getElementById('formAddCustomEmail');
const customEmailPrefix = document.getElementById('customEmailPrefix');
const domainSuffixLabel = document.getElementById('domainSuffixLabel');
const btnAddEmailCancel = document.getElementById('btnAddEmailCancel');
const btnAddEmailConfirm = document.getElementById('btnAddEmailConfirm');
const prefixInputWrap = document.getElementById('prefixInputWrap');
const emailPrefixStatus = document.getElementById('emailPrefixStatus');
const emailPrefixStatusText = document.getElementById('emailPrefixStatusText');
let checkPrefixTimeout = null;

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
let activeDomain = '';
const INBOX_PAGE_SIZE = 15;
let hasMoreMessages = true;
let isLoadingMore = false;

// Public config (MAIL_DOMAIN from server)
async function loadPublicConfig() {
  // Public sahifada domen ko'rsatilmaydi — faqat login qilingan workspace da
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (data.success && data.domain) {
      activeDomain = data.domain;
    }
  } catch (e) {
    console.warn('config load failed', e);
  }
}

function applyDomainToWorkspace() {
  if (!activeDomain) return;
  if (domainSuffixLabel) domainSuffixLabel.textContent = '@' + activeDomain;
  // Faqat login keyin: workspace + modal lar (public landing ga tegmaydi)
  const roots = [
    document.getElementById('mainWorkspace'),
    document.getElementById('deleteConfirmModal'),
    document.getElementById('addEmailModal')
  ].filter(Boolean);
  roots.forEach(root => {
    root.querySelectorAll('[data-mail-domain]').forEach(el => {
      const prefix = el.getAttribute('data-mail-prefix') || '';
      const fmt = el.getAttribute('data-mail-format') || 'at';
      if (fmt === 'at') el.textContent = prefix ? prefix + '@' + activeDomain : '@' + activeDomain;
      else if (fmt === 'email') el.textContent = (prefix || 'user') + '@' + activeDomain;
      else el.textContent = activeDomain;
    });
  });
}

let messagesHydrated = false;
let emailsHydrated = false;
let syncInterval = null;
let emailToDelete = null;
let isTabSwitching = false;
let activeTabRequestId = 0;

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
        loadMessages({ force: true });
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
// 1. AUTH TABS (olib tashlandi — faqat login)
// ==========================================



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
  messagesHydrated = false;
  emailsHydrated = false;
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
  applyDomainToWorkspace();
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

  if (window.innerWidth <= 900) {
    switchMobileView('inbox');
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

// ==========================================
// 3. EMAILS & ADD +1 LOGIC
// ==========================================

async function loadEmails(opts = {}) {
  if (!currentUser) return;
  const silent = Boolean(opts.silent);

  if (!emailsHydrated && !silent) {
    renderEmailsSkeleton();
  }

  try {
    const res = await fetch('/api/get-emails', {
      headers: { 'Authorization': `Bearer ${currentUser.token}` }
    });
    const data = await res.json();

    if (res.status === 401) {
      logout();
      showToast('Sessiya muddati tugadi. Qayta kiring.');
      return;
    }
    if (data.success) {
      currentEmails = data.emails || [];
      emailsHydrated = true;
      activeDomain = (data.domain || '').trim().toLowerCase();
      applyDomainToWorkspace();
      renderEmails();
      renderInboxTabs();
      loadMessages({ silent });
    }
  } catch (err) {
    console.warn('Load emails failed:', err);
    emailsHydrated = true;
  } finally {
    dismissSplashScreen();
  }
}

// ADD +1 CLICK -> OPEN MODAL
function resetAddEmailModal() {
  if (customEmailPrefix) customEmailPrefix.value = '';
  if (prefixInputWrap) prefixInputWrap.classList.remove('has-error', 'has-success');
  if (emailPrefixStatus) emailPrefixStatus.classList.add('hidden');
  if (emailPrefixStatusText) emailPrefixStatusText.textContent = '';
  if (btnAddEmailConfirm) {
    btnAddEmailConfirm.classList.remove('loading');
    btnAddEmailConfirm.innerHTML = 'Yaratish';
    btnAddEmailConfirm.disabled = true;
  }
}

btnAddOne.addEventListener('click', () => {
  resetAddEmailModal();
  addEmailModal.classList.remove('hidden');
  setTimeout(() => {
    if (customEmailPrefix) customEmailPrefix.focus();
  }, 60);
});

btnAddEmailCancel.addEventListener('click', () => {
  addEmailModal.classList.add('hidden');
  resetAddEmailModal();
});
addEmailBackdrop.addEventListener('click', () => {
  addEmailModal.classList.add('hidden');
  resetAddEmailModal();
});

// REAL-TIME PREFIX VALIDATION (Doimo gray, faqat hamma narsa to'g'ri bo'lgandagina oq/faol bo'ladi)
function validateEmailPrefix() {
  if (!customEmailPrefix) return;
  const raw = (customEmailPrefix.value || '').trim().toLowerCase();
  const clean = raw.replace(/[^a-z0-9_.-]/g, '');

  if (checkPrefixTimeout) clearTimeout(checkPrefixTimeout);

  // Har doim kiritish paytida tugma kulrang (gray/disabled) bo'lib turadi
  if (btnAddEmailConfirm) btnAddEmailConfirm.disabled = true;

  // 1. Agar nom kiritilmasa -> tugma kulrang (gray), xatolik ko'rsatilmaydi
  if (!clean) {
    if (prefixInputWrap) prefixInputWrap.classList.remove('has-error', 'has-success');
    if (emailPrefixStatus) emailPrefixStatus.classList.add('hidden');
    if (emailPrefixStatusText) emailPrefixStatusText.textContent = '';
    return;
  }

  const domain = (activeDomain || 'bombaclat.uz').trim().toLowerCase();
  const fullAddress = `${clean}@${domain}`;

  // 2. Tezkor tekshiruv (foydalanuvchining o'z emaillari ro'yxatida bormi)
  const isLocalDuplicate = currentEmails.some(e => (e.address || '').toLowerCase() === fullAddress);
  if (isLocalDuplicate) {
    if (btnAddEmailConfirm) btnAddEmailConfirm.disabled = true;
    if (prefixInputWrap) {
      prefixInputWrap.classList.add('has-error');
      prefixInputWrap.classList.remove('has-success');
    }
    if (emailPrefixStatus) {
      emailPrefixStatus.className = 'email-prefix-status is-error';
      emailPrefixStatus.classList.remove('hidden');
    }
    if (emailPrefixStatusText) {
      emailPrefixStatusText.textContent = 'Bu email allaqachon band';
    }
    return;
  }

  // Hali serverdan tasdiqlanmagan — shuning uchun tugma baribir GRAY bo'lib turadi!
  if (prefixInputWrap) prefixInputWrap.classList.remove('has-error');
  if (emailPrefixStatus) emailPrefixStatus.classList.add('hidden');

  // 3. Serverdan bandlikni tekshirish (150ms tezkor debounce)
  checkPrefixTimeout = setTimeout(async () => {
    const cur = (customEmailPrefix.value || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    if (cur !== clean || !clean) return;

    try {
      const res = await fetch(`/api/check-email?prefix=${encodeURIComponent(clean)}`, {
        headers: { 'Authorization': `Bearer ${currentUser.token}` }
      });
      const data = await res.json();

      const latest = (customEmailPrefix.value || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
      if (latest !== clean) return;

      if (data.isTaken) {
        // Band bo'lsa: tugma doimo gray bo'lib qoladi va qizil yozuv chiqadi
        if (btnAddEmailConfirm) btnAddEmailConfirm.disabled = true;
        if (prefixInputWrap) {
          prefixInputWrap.classList.add('has-error');
          prefixInputWrap.classList.remove('has-success');
        }
        if (emailPrefixStatus) {
          emailPrefixStatus.className = 'email-prefix-status is-error';
          emailPrefixStatus.classList.remove('hidden');
        }
        if (emailPrefixStatusText) {
          emailPrefixStatusText.textContent = 'Bu email allaqachon band';
        }
      } else if (data.available) {
        // HAMMA NARSA TO'G'RI BO'LGANDAGINA OQ (ACTIVE) BO'LADI!
        if (btnAddEmailConfirm) btnAddEmailConfirm.disabled = false;
        if (prefixInputWrap) {
          prefixInputWrap.classList.remove('has-error');
        }
        if (emailPrefixStatus) emailPrefixStatus.classList.add('hidden');
      } else {
        // Noto'g'ri bo'lsa gray
        if (btnAddEmailConfirm) btnAddEmailConfirm.disabled = true;
      }
    } catch (e) {
      // Server xatosi bo'lsa ham tugma gray qoladi
      if (btnAddEmailConfirm) btnAddEmailConfirm.disabled = true;
    }
  }, 180);
}

if (customEmailPrefix) {
  customEmailPrefix.addEventListener('input', validateEmailPrefix);
}

formAddCustomEmail.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (btnAddEmailConfirm && btnAddEmailConfirm.disabled) return;
  const prefix = (customEmailPrefix.value || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
  if (!prefix) return;

  setButtonLoading(btnAddEmailConfirm, true, 'Yaratish');

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
      addEmailModal.classList.add('hidden');
      resetAddEmailModal();
      showToast(`+1 email qo'shildi: ${data.email.address}`);
      // Yangi yaratilgan emailga o'tish (2 sekunlik silliq skeleton bilan)
      selectEmailTab(data.email.address);
    } else {
      const errMsg = data.error || 'Email qoʻshishda xatolik';
      if (prefixInputWrap) {
        prefixInputWrap.classList.add('has-error');
        prefixInputWrap.classList.remove('has-success');
      }
      if (emailPrefixStatus) {
        emailPrefixStatus.className = 'email-prefix-status is-error';
        emailPrefixStatus.classList.remove('hidden');
      }
      if (emailPrefixStatusText) {
        emailPrefixStatusText.textContent = errMsg;
      }
      if (btnAddEmailConfirm) btnAddEmailConfirm.disabled = true;
    }
  } catch (err) {
    showToast('Tarmoq xatosi');
  } finally {
    if (btnAddEmailConfirm) {
      btnAddEmailConfirm.classList.remove('loading');
      btnAddEmailConfirm.innerHTML = 'Yaratish';
      btnAddEmailConfirm.disabled = true;
    }
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
      <div class="email-card ${isSelected ? 'selected' : ''}" onclick="selectEmailTab('${escapeAttr(item.address)}')">
        <div class="email-avatar">${initial}</div>
        <div class="email-info">
          <div class="email-address-text" title="${escapeHtml(item.address)}">${escapeHtml(item.address)}</div>
          <div class="email-owner-text">${escapeHtml(ownerName)}</div>
        </div>
        <div class="email-card-actions">
          <button class="btn-card-copy" onclick="copyToClipboard('${escapeAttr(item.address)}', event)" title="Nusxalash">copy</button>
          <button class="btn-card-del" onclick="openDeleteModal('${escapeAttr(item.address)}', event)" title="Oʻchirib tashlash">&times;</button>
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
      <button class="filter-tab ${isActive ? 'active' : ''}" onclick="selectEmailTab('${escapeAttr(item.address)}')" title="${escapeHtml(item.address)}">
        ${escapeHtml(shortLabel)}
      </button>
    `;
  });

  inboxFilterTabs.innerHTML = html;
}

window.selectEmailTab = async function(address) {
  if (window.innerWidth <= 900) {
    switchMobileView('inbox');
  }

  activeFilter = address;
  renderInboxTabs();
  renderEmails(); // Chap tomonda tanlangan kartani ajratib ko'rsatish

  // 1. Darhol boshqa tab xatlarini yashirib, Skeleton yuklashni ko'rsatamiz
  currentMessages = [];
  hasMoreMessages = true;
  isLoadingMore = false;
  renderMessagesSkeleton();

  // 2. Request ketma-ketlik raqami (agar foydalanuvchi tez-tez boshqa tabga bossa, eski natija ochilmaydi)
  const reqId = ++activeTabRequestId;
  isTabSwitching = true;

  try {
    // 3. Orqa fonda yuklash va 2 soniya davomida silliq skeleton saqlash
    const minDelayPromise = new Promise(resolve => setTimeout(resolve, 2000));
    const url = `/api/get-messages?email=${encodeURIComponent(address)}&offset=0&limit=${INBOX_PAGE_SIZE}`;
    const fetchPromise = fetch(url, {
      headers: { 'Authorization': `Bearer ${currentUser.token}` }
    }).then(async r => {
      if (r.status === 401) {
        logout();
        return { success: false, unauth: true };
      }
      return r.json();
    }).catch(err => ({ success: false, error: err.message }));

    const [_, data] = await Promise.all([minDelayPromise, fetchPromise]);

    // Agar foydalanuvchi shu 2 soniya ichida boshqa tabga o'tib ketgan bo'lsa — eskisi bekor qilinadi
    if (reqId !== activeTabRequestId) {
      return;
    }

    if (data && data.success) {
      currentMessages = data.messages || [];
      hasMoreMessages = Boolean(data.hasMore);
      messagesHydrated = true;
      renderMessages();
      if (messagesListContainer) messagesListContainer.scrollTop = 0;
    } else {
      currentMessages = [];
      hasMoreMessages = false;
      messagesHydrated = true;
      renderMessages();
    }
  } catch (err) {
    if (reqId === activeTabRequestId) {
      currentMessages = [];
      hasMoreMessages = false;
      messagesHydrated = true;
      renderMessages();
    }
  } finally {
    if (reqId === activeTabRequestId) {
      isTabSwitching = false;
    }
  }
};

function messagesSignature(list) {
  if (!list || !list.length) return '0';
  // id + is_read + is_starred — UI o'zgarishi mumkin bo'lgan maydonlar
  return list.length + '|' + list.map(m =>
    String(m.id) + ':' + (m.is_read ? '1' : '0') + (m.is_starred ? 's' : '')
  ).join(',');
}

async function loadMessages(opts = {}) {
  if (!currentUser || isTabSwitching) return;
  const force = Boolean(opts.force);
  const silent = Boolean(opts.silent);

  // Skeleton faqat eng birinchi yuklashda — polling da hech qachon
  if (!messagesHydrated && !silent) {
    renderMessagesSkeleton();
  }

  try {
    const url = `/api/get-messages?email=${encodeURIComponent(activeFilter)}&offset=0&limit=${INBOX_PAGE_SIZE}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${currentUser.token}` }
    });
    const data = await res.json();

    if (res.status === 401) {
      logout();
      showToast('Sessiya muddati tugadi. Qayta kiring.');
      return;
    }
    if (data.success) {
      const incoming = data.messages || [];
      const prevIds = new Set((currentMessages || []).map(m => String(m.id)));
      const firstPaint = !messagesHydrated;
      messagesHydrated = true;

      if (silent) {
        // Polling paytida yangi xatlar kelsa, ro'yxat tepasiga qo'shamiz (scroll orqali yuklangan eski xatlar o'chib ketmaydi)
        const newOnes = incoming.filter(m => !prevIds.has(String(m.id)));
        if (newOnes.length > 0) {
          currentMessages = newOnes.concat(currentMessages);
          renderMessages();
          const n = newOnes.length;
          const subj = cleanSubject(newOnes[0].subject || 'Mavzusiz').slice(0, 48);
          showToast(n === 1 ? `Yangi xat: ${subj}` : `${n} ta yangi xat`);
        }
      } else {
        currentMessages = incoming;
        hasMoreMessages = Boolean(data.hasMore);
        isLoadingMore = false;
        renderMessages();
        if (force && messagesListContainer) {
          messagesListContainer.scrollTop = 0;
        }
      }
    }
  } catch (err) {
    console.warn('Load messages failed:', err);
    if (!messagesHydrated) {
      messagesHydrated = true;
      renderMessages();
    }
  }
}

// SCROLL PAGINATION: 15 tadan keyingi xatlarni yuklash
async function loadMoreMessages() {
  if (isLoadingMore || !hasMoreMessages || !currentUser || isTabSwitching) return;
  isLoadingMore = true;

  // Pastda yuklanish indikatorini ko'rsatamiz
  let loaderEl = document.getElementById('inboxLoadMoreIndicator');
  if (!loaderEl && messagesListContainer) {
    loaderEl = document.createElement('div');
    loaderEl.id = 'inboxLoadMoreIndicator';
    loaderEl.className = 'inbox-load-more';
    loaderEl.innerHTML = `
      <div class="inbox-load-more-spinner"></div>
      <span>Yuklanmoqda...</span>
    `;
    messagesListContainer.appendChild(loaderEl);
  }

  try {
    const nextOffset = currentMessages.length;
    const url = `/api/get-messages?email=${encodeURIComponent(activeFilter)}&offset=${nextOffset}&limit=${INBOX_PAGE_SIZE}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${currentUser.token}` }
    });
    const data = await res.json();

    if (data.success) {
      const more = data.messages || [];
      if (more.length === 0) {
        hasMoreMessages = false;
      } else {
        const existingIds = new Set(currentMessages.map(m => String(m.id)));
        const uniqueMore = more.filter(m => !existingIds.has(String(m.id)));
        currentMessages = currentMessages.concat(uniqueMore);
        hasMoreMessages = Boolean(data.hasMore && more.length >= INBOX_PAGE_SIZE);

        const prevScroll = messagesListContainer ? messagesListContainer.scrollTop : 0;
        renderMessages();
        if (messagesListContainer) {
          messagesListContainer.scrollTop = prevScroll;
        }
      }
    } else {
      hasMoreMessages = false;
    }
  } catch (err) {
    console.warn('Load more messages failed:', err);
  } finally {
    isLoadingMore = false;
    const el = document.getElementById('inboxLoadMoreIndicator');
    if (el) el.remove();
  }
}

function handleInboxScroll() {
  if (!hasMoreMessages || isLoadingMore || isTabSwitching || !currentUser) return;
  if (!messagesListContainer) return;

  const scrollBottom = messagesListContainer.scrollHeight - messagesListContainer.scrollTop - messagesListContainer.clientHeight;
  if (scrollBottom <= 180) {
    loadMoreMessages();
  }
}

if (messagesListContainer) {
  messagesListContainer.addEventListener('scroll', handleInboxScroll, { passive: true });
}

window.addEventListener('scroll', () => {
  if (!hasMoreMessages || isLoadingMore || isTabSwitching || !currentUser) return;
  if ((window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 250)) {
    loadMoreMessages();
  }
}, { passive: true });

btnRefreshInbox.addEventListener('click', () => {
  loadMessages({ force: true });
  showToast('Inbox yangilandi');
});

// ==========================================
// EMAIL PARSING & DECODING HELPERS
// ==========================================
function decodeQuotedPrintableClient(str) {
  if (!str) return '';
  // Faqat Quoted-Printable formatida saqlangan bo'lsa dekodlaymiz.
  // Agar allaqachon dekodlangan bo'lsa, URL query paramlaridagi =20, =40 kabilarni buzmaslik uchun tegmaymiz!
  if (!/=3D/i.test(str) && !/=(?:\r\n|\n|\r)/.test(str)) {
    return str;
  }
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

// Clean sender name and sender email (strips bounce addresses, double brackets, and quotes)
function formatSenderInfo(rawName, rawAddress) {
  let name = (rawName || '').trim();
  let email = (rawAddress || '').trim();

  // 1. Agar rawName ichida email bo'lsa: "Anthropic" <no-reply@mail.anthropic.com>
  const match = name.match(/^"?([^"<]*)"?\s*<([^>]+)>/);
  if (match) {
    name = match[1].trim();
    const extractedEmail = match[2].trim();
    if (!email || email.includes('bounces+') || email.includes('bounce-') || !email.includes('@')) {
      email = extractedEmail;
    }
  } else if (name.includes('@') && !name.includes(' ')) {
    if (!email || email.includes('bounces+')) {
      email = name.replace(/[<>]/g, '').trim();
    }
  }

  // 2. Qo'shtirnoq va keraksiz burchak qavslarni tozalaymiz
  name = name.replace(/^["']+|["']+$/g, '').trim();
  email = email.replace(/[<>]/g, '').trim();

  // 3. Tasodifiy VERP tracking hashlarini (masalan: no-reply-k6ks6oole3u67k3659mibw@mail.anthropic.com -> no-reply@mail.anthropic.com) tozalash
  email = email.replace(/^(no-?reply)[+_-][a-zA-Z0-9_-]{6,}@/i, '$1@');
  name = name.replace(/^(no-?reply)[+_-][a-zA-Z0-9_-]{6,}@/i, '$1@');

  // 4. Agar name bo'sh bo'lsa, emaildan olamiz
  if (!name) {
    if (email && email.includes('@')) {
      name = email.split('@')[0];
    } else {
      name = 'Xabarchi';
    }
  }

  return { displayName: name, email };
}

// Clean trailing anti-threading timestamp from subject (e.g. "Subject | 2026-10-15 06:53:35" -> "Subject")
function cleanSubject(subject) {
  if (!subject) return 'Mavzusiz';
  return subject.replace(/\s*[|\-–]\s*\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?.*$/i, '').trim() || subject;
}

function formatDateFull(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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
    const senderInfo = formatSenderInfo(msg.from_name, msg.from_address);
    const sender = senderInfo.displayName || 'Xabarchi';
    const subjectClean = cleanSubject(msg.subject);

    return `
      <div class="msg-row" onclick="openMessageModal('${msg.id}')">
        <div class="msg-sender" title="${escapeHtml(sender)}">${escapeHtml(sender)}</div>
        <div class="msg-subject-snippet">
          <strong>${escapeHtml(subjectClean)}</strong>
          <span>${escapeHtml(snippet)}...</span>
        </div>
        <div class="msg-time">${timeFormatted}</div>
      </div>
    `;
  }).join('');
}

function extractVerificationDetails(subject, body, html) {
  const content = `${subject || ''}\n${body || ''}\n${html || ''}`;

  let code = null;
  const codePatterns = [
    /(?:verification|confirmation|login|security|sign[- ]in|passcode|one-time|otp|kod)[\s\w:]*?(\b\d{6}\b)/i,
    /\b(\d{6})\b[\s\w]*?(?:is your|kod|code|tasdiqlash)/i,
    /(?:code|kod):\s*(\b\d{6}\b)/i,
    /\b(\d{6})\b/
  ];
  for (const re of codePatterns) {
    const m = content.match(re);
    if (m && m[1]) {
      code = m[1];
      break;
    }
  }

  let link = null;
  const linkMatches = (html || body || '').match(/https?:\/\/[^\s"'<>]+(?:verify|confirm|magic-link|token|activate|login)[^\s"'<>]+/gi);
  if (linkMatches && linkMatches.length > 0) {
    link = linkMatches[0].replace(/&amp;/g, '&');
  }

  return { code, link };
}

// MESSAGE MODAL VIEW (1:1 RICH EMAIL WITH BEAUTIFUL HTML PREVIEW)
window.openMessageModal = function(msgIdOrObj) {
  const msg = (msgIdOrObj && typeof msgIdOrObj === "object")
    ? msgIdOrObj
    : (currentMessages.find(m => m.id === msgIdOrObj)
      || (typeof adminInspectData !== "undefined" && adminInspectData.messages
          ? adminInspectData.messages.find(m => m.id === msgIdOrObj) : null));
  if (!msg) return;

  const senderInfo = formatSenderInfo(msg.from_name, msg.from_address);
  const cleanSender = senderInfo.displayName || senderInfo.email || 'Xabarchi';

  msgDetailSubject.textContent = cleanSubject(msg.subject);
  msgDetailFrom.textContent = `Kimdan: ${cleanSender}`;
  if (senderInfo.email) {
    msgDetailFrom.title = senderInfo.email;
  }
  msgDetailTo.textContent = `Kimga: ${msg.email_address}`;
  msgDetailDate.textContent = `Sana: ${formatDateFull(msg.created_at)}`;

  // SMART ACTIONS (OTP / VERIFICATION LINK QUICK COPY)
  const smartActions = document.getElementById('msgSmartActions');
  if (smartActions) {
    const { code, link } = extractVerificationDetails(msg.subject, msg.body, msg.html);
    if (code || link) {
      let cardsHtml = '';
      if (code) {
        cardsHtml += `
          <div class="smart-card">
            <div class="smart-info">
              <span class="smart-badge">KOD</span>
              <span class="smart-value-code">${code}</span>
            </div>
            <button class="smart-btn" onclick="navigator.clipboard.writeText('${code}').then(() => { this.textContent = 'Nusxalandi! ✓'; setTimeout(() => this.textContent = 'Kodni nusxalash', 2000); })">
              Kodni nusxalash
            </button>
          </div>
        `;
      }
      if (link) {
        const safeLink = encodeURI(link);
        cardsHtml += `
          <div class="smart-card">
            <div class="smart-info">
              <span class="smart-badge">HAVOLA</span>
              <span class="smart-desc">Tasdiqlash havolasini nusxalab, Claude ochilgan Rail profilingizga paste qiling</span>
            </div>
            <button class="smart-btn smart-btn-accent" onclick="navigator.clipboard.writeText('${safeLink}').then(() => { this.textContent = 'Nusxalandi! ✓'; setTimeout(() => this.textContent = 'Havolani nusxalash', 2000); })">
              Havolani nusxalash
            </button>
          </div>
        `;
      }
      smartActions.innerHTML = cardsHtml;
      smartActions.classList.remove('hidden');
    } else {
      smartActions.innerHTML = '';
      smartActions.classList.add('hidden');
    }
  }

  msgDetailBody.innerHTML = '';

  let rawHtml = msg.html;
  if (!rawHtml && msg.body && (msg.body.includes('<!doctype html') || msg.body.includes('<html'))) {
    rawHtml = msg.body;
  }

  if (rawHtml) {
    let decodedHtml = decodeQuotedPrintableClient(rawHtml);

    // Rasmlarni to'siqsiz yuklash uchun no-referrer va barcha linklar yangi oynada ochilishi uchun base target
    const headMeta = `
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="referrer" content="no-referrer">
      <base target="_blank">
      <style>
        html, body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          box-sizing: border-box;
          overflow-y: auto !important;
          overflow-x: auto !important;
          -webkit-overflow-scrolling: touch;
        }
        img {
          max-width: 100%;
        }
        table {
          max-width: 100%;
        }
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.05);
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.25);
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.4);
        }
      </style>
    `;

    if (/<head[\s>]/i.test(decodedHtml)) {
      decodedHtml = decodedHtml.replace(/<head[^>]*>/i, `$&${headMeta}`);
    } else if (/<html[\s>]/i.test(decodedHtml)) {
      decodedHtml = decodedHtml.replace(/<html[^>]*>/i, `$&<head>${headMeta}</head>`);
    } else {
      decodedHtml = `<!DOCTYPE html><html><head>${headMeta}</head><body>${decodedHtml}</body></html>`;
    }

    // TRACKING PIXEL HIMOYASI:
    // 1x1 o'lchamdagi yoki kuzatuvchi CDN domenlaridagi yashirin piksellarni zararsizlantiramiz
    const trackingPattern = /(?:\/open\/|\/wf\/open|pixel|beacon|telemetry|mail\.anthropic\.com|sendgrid\.net|awstrack\.me|mandrillapp\.com)/i;
    const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

    const imgRe = /<img\b([^>]*?)src=(['"]?)(https?:\/\/[^\s'">]+)\2([^>]*?)>/gi;
    decodedHtml = decodedHtml.replace(imgRe, (match, before, quote, src, after) => {
      const allAttrs = (before + ' ' + after).toLowerCase();
      const isTiny = (allAttrs.includes('width="1"') || allAttrs.includes("width='1'")) &&
                    (allAttrs.includes('height="1"') || allAttrs.includes("height='1'"));
      const isTrack = trackingPattern.test(src) || isTiny || allAttrs.includes('width:1px') || allAttrs.includes('height:1px');

      if (isTrack) {
        return `<img ${before} src="${TRANSPARENT_PIXEL}" width="1" height="1" style="display:none!important;" alt="" ${after}>`;
      }

      // Oddiy haqiqiy rasmlar (logolar, bannerlar) foydalanuvchining o'z brauzeri orqali no-referrer bilan ochiladi
      return `<img ${before} src="${src}" referrerpolicy="no-referrer" loading="lazy" ${after}>`;
    });

    // Har qanday boshqa img teglariga ham no-referrer qo'shamiz
    decodedHtml = decodedHtml.replace(/<img\b([^>]*?)>/gi, (match, attrs) => {
      if (/referrerpolicy=/i.test(attrs)) {
        return `<img ${attrs.replace(/referrerpolicy=["'][^"']*["']/gi, 'referrerpolicy="no-referrer"')}>`;
      }
      return `<img referrerpolicy="no-referrer" ${attrs}>`;
    });

    const wrap = document.createElement('div');
    wrap.className = 'msg-iframe-wrap';

    const iframe = document.createElement('iframe');
    iframe.className = 'msg-email-frame';
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    iframe.srcdoc = decodedHtml;

    wrap.appendChild(iframe);
    msgDetailBody.appendChild(wrap);
  } else {
    const card = document.createElement('div');
    card.className = 'msg-plain-card';
    card.innerHTML = `<pre style="white-space:pre-wrap; font-family:var(--font-sans); font-size:13.5px; line-height:1.6; color:#f4f4f6; margin:0;">${escapeHtml(msg.body || '')}</pre>`;
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

// Fon tekshiruv: faqat o'zgarish bo'lsa UI yangilanadi
function startSync() {
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(() => {
    if (currentUser && !isTabSwitching) {
      loadMessages({ silent: true });
    }
  }, 15000);
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
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/`/g, '&#96;');
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
    if (!fullName || !username || !password) return;

    const btn = document.getElementById('btnAdminAddUserConfirm');
    setButtonLoading(btn, true, 'Userni Saqlash');
    try {
      const res = await fetch('/api/admin-create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentUser.token}` },
        body: JSON.stringify({ full_name: fullName, username, password })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`"${fullName}" (@${username}) muvaffaqiyatli qoʻshildi`);
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
          <span style="font-size:13px; font-weight:600; color:#fff; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(cleanSubject(msg.subject))}</span>
          <span style="font-size:11px; color:var(--text-dim); flex-shrink:0;">${date}</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:12px; color:var(--text-secondary);">${escapeHtml(formatSenderInfo(msg.from_name, msg.from_address).displayName)}</span>
          <span style="font-size:11px; color:var(--text-dim);">${escapeHtml(msg.email_address || '')}</span>
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
loadPublicConfig().finally(() => checkSession());

// Global Escape closes open modals
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (msgDetailModal && !msgDetailModal.classList.contains('hidden')) msgDetailModal.classList.add('hidden');
  if (addEmailModal && !addEmailModal.classList.contains('hidden')) addEmailModal.classList.add('hidden');
  if (deleteConfirmModal && !deleteConfirmModal.classList.contains('hidden')) closeDeleteModal();
});
