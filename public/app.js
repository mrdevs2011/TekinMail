// TEKINMAIL // FRONTEND CLIENT SCRIPT

const COOLDOWN_DURATION_MS = 5 * 60 * 1000; // 5 minut
const STORAGE_KEY_ACCOUNT = 'tekinmail_account_key';
const STORAGE_KEY_COOLDOWN = 'tekinmail_add5_cooldown_until';
const STORAGE_KEY_THEME = 'tekinmail_theme';

// DOM ELEMENTLAR
const themeToggle = document.getElementById('themeToggle');
const accountPill = document.getElementById('accountPill');
const accountKeyDisplay = document.getElementById('accountKeyDisplay');

const btnAddFive = document.getElementById('btnAddFive');
const btnIconPlus = document.getElementById('btnIconPlus');
const btnIconLock = document.getElementById('btnIconLock');
const btnText = document.getElementById('btnText');
const cooldownBanner = document.getElementById('cooldownBanner');
const cooldownTimerDisplay = document.getElementById('cooldownTimerDisplay');

const emailsList = document.getElementById('emailsList');
const emailsCount = document.getElementById('emailsCount');
const emailSearch = document.getElementById('emailSearch');

const messagesList = document.getElementById('messagesList');
const messagesCount = document.getElementById('messagesCount');
const btnRefreshInbox = document.getElementById('btnRefreshInbox');

const messageModal = document.getElementById('messageModal');
const modalClose = document.getElementById('modalClose');
const modalSubject = document.getElementById('modalSubject');
const modalFrom = document.getElementById('modalFrom');
const modalTo = document.getElementById('modalTo');
const modalBody = document.getElementById('modalBody');

const toast = document.getElementById('toast');
const toastText = document.getElementById('toastText');

// STATE
let currentAccountKey = null;
let currentEmails = [];
let currentMessages = [];
let cooldownInterval = null;

// ==========================================
// 1. THEME SWITCHER (DARK / LIGHT)
// ==========================================

function initTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(STORAGE_KEY_THEME, next);
}

themeToggle.addEventListener('click', toggleTheme);

// ==========================================
// 2. COOLDOWN TAYMER (5 MINUT, LOCALSTORAGE)
// ==========================================

function checkAndStartCooldown() {
  const savedUntil = localStorage.getItem(STORAGE_KEY_COOLDOWN);
  if (!savedUntil) return;

  const untilTime = parseInt(savedUntil, 10);
  const now = Date.now();

  if (untilTime > now) {
    lockButtonWithTimer(untilTime);
  } else {
    localStorage.removeItem(STORAGE_KEY_COOLDOWN);
    unlockButton();
  }
}

function startFiveMinuteCooldown() {
  const untilTime = Date.now() + COOLDOWN_DURATION_MS;
  localStorage.setItem(STORAGE_KEY_COOLDOWN, untilTime.toString());
  lockButtonWithTimer(untilTime);
}

function lockButtonWithTimer(untilTime) {
  if (cooldownInterval) clearInterval(cooldownInterval);

  btnAddFive.disabled = true;
  btnIconPlus.classList.add('hidden');
  btnIconLock.classList.remove('hidden');
  cooldownBanner.classList.remove('hidden');

  function tick() {
    const remainingMs = untilTime - Date.now();
    if (remainingMs <= 0) {
      clearInterval(cooldownInterval);
      localStorage.removeItem(STORAGE_KEY_COOLDOWN);
      unlockButton();
      return;
    }

    const totalSec = Math.ceil(remainingMs / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const formatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    btnText.textContent = `wait (${formatted})`;
    cooldownTimerDisplay.textContent = formatted;
  }

  tick();
  cooldownInterval = setInterval(tick, 1000);
}

function unlockButton() {
  btnAddFive.disabled = false;
  btnIconPlus.classList.remove('hidden');
  btnIconLock.classList.add('hidden');
  btnText.textContent = 'add 5';
  cooldownBanner.classList.add('hidden');
}

// ==========================================
// 3. ACCOUNT INITIALIZATION
// ==========================================

async function initAccount() {
  let savedKey = localStorage.getItem(STORAGE_KEY_ACCOUNT);

  try {
    const url = savedKey ? `/api/init-user?account_key=${encodeURIComponent(savedKey)}` : `/api/init-user`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.success) {
      currentAccountKey = data.account_key;
      localStorage.setItem(STORAGE_KEY_ACCOUNT, currentAccountKey);
      accountKeyDisplay.textContent = currentAccountKey;

      currentEmails = data.emails || [];
      renderEmails();
      fetchMessages();
    } else {
      showToast('init error: ' + data.error);
    }
  } catch (err) {
    showToast('network error: api unreachable');
  }
}

// ==========================================
// 4. ADD 5 EMAILS
// ==========================================

async function handleAddFive() {
  if (btnAddFive.disabled) return;

  btnAddFive.disabled = true;
  btnText.textContent = 'allocating...';

  try {
    const res = await fetch('/api/add-emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_key: currentAccountKey })
    });

    const data = await res.json();

    if (data.success && data.emails) {
      currentEmails = [...data.emails, ...currentEmails];
      renderEmails();
      showToast(`+${data.added_count} addresses allocated`);
      startFiveMinuteCooldown();
    } else {
      const errMsg = data.error || (data.details ? data.details.join(', ') : 'unknown');
      showToast('allocation failed: ' + errMsg);
      unlockButton();
    }
  } catch (err) {
    showToast('error: ' + err.message);
    unlockButton();
  }
}

// ==========================================
// 5. RENDER EMAILS
// ==========================================

function renderEmails() {
  const query = emailSearch.value.trim().toLowerCase();
  const filtered = currentEmails.filter(e => e.address.toLowerCase().includes(query));

  emailsCount.textContent = currentEmails.length.toString();

  if (filtered.length === 0) {
    emailsList.innerHTML = `
      <div class="empty-state">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.3-4.3"/>
        </svg>
        <p>${query ? 'no matching address found' : 'no addresses allocated'}</p>
        <span class="dimmed">click <code>add 5</code> to allocate</span>
      </div>
    `;
    return;
  }

  emailsList.innerHTML = filtered.map(item => `
    <div class="alias-row">
      <span class="alias-text" title="${escapeHtml(item.address)}">${escapeHtml(item.address)}</span>
      <button class="btn-alias-copy" onclick="copyAddress('${item.address}', this)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
        </svg>
        <span>copy</span>
      </button>
    </div>
  `).join('');
}

// ==========================================
// 6. RENDER MESSAGES & INBOX
// ==========================================

async function fetchMessages() {
  if (!currentAccountKey) return;

  btnRefreshInbox.classList.add('loading');
  try {
    const res = await fetch(`/api/get-messages?account_key=${encodeURIComponent(currentAccountKey)}`);
    const data = await res.json();

    if (data.success) {
      currentMessages = data.messages || [];
      renderMessages();
    }
  } catch (err) {
    console.error('Inbox sync error:', err);
  } finally {
    btnRefreshInbox.classList.remove('loading');
  }
}

function renderMessages() {
  messagesCount.textContent = currentMessages.length.toString();

  if (currentMessages.length === 0) {
    messagesList.innerHTML = `
      <div class="empty-state">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect width="20" height="16" x="2" y="4" rx="2"/>
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
        </svg>
        <p>inbox empty</p>
        <span class="dimmed">waiting for inbound messages</span>
      </div>
    `;
    return;
  }

  messagesList.innerHTML = currentMessages.map(msg => `
    <div class="msg-card" onclick="openMessageDetail('${msg.id}', '${msg.to_email}')">
      <div class="msg-card-top">
        <span class="msg-to-tag">${escapeHtml(msg.to_email)}</span>
        <span class="msg-time">${formatTime(msg.created_at)}</span>
      </div>
      <div class="msg-subject">${escapeHtml(msg.subject)}</div>
      <div class="msg-preview">${escapeHtml(msg.intro || 'click to inspect payload...')}</div>
    </div>
  `).join('');
}

// INSPECTION MODAL
async function openMessageDetail(messageId, toEmail) {
  messageModal.classList.remove('hidden');
  modalSubject.textContent = 'fetching payload...';
  modalFrom.textContent = '';
  modalTo.textContent = `to: ${toEmail}`;
  modalBody.innerHTML = '<div class="loading-state">decrypting and rendering message...</div>';

  try {
    const res = await fetch(`/api/get-message-detail?message_id=${messageId}&to_email=${encodeURIComponent(toEmail)}`);
    const data = await res.json();

    if (data.success && data.message) {
      const m = data.message;
      modalSubject.textContent = m.subject || '(no subject)';
      modalFrom.textContent = `from: ${m.from ? (m.from.name + ' <' + m.from.address + '>') : 'unknown'}`;
      modalTo.textContent = `to: ${m.to}`;

      if (m.html) {
        modalBody.innerHTML = m.html;
      } else {
        modalBody.innerHTML = `<pre style="white-space: pre-wrap; font-family: var(--font-mono);">${escapeHtml(m.text || '')}</pre>`;
      }
    } else {
      modalBody.textContent = 'failed to render payload stream.';
    }
  } catch (err) {
    modalBody.textContent = 'error: ' + err.message;
  }
}

// ==========================================
// UTILITIES
// ==========================================

function copyAddress(address, btn) {
  navigator.clipboard.writeText(address).then(() => {
    if (btn) {
      btn.classList.add('copied');
      const span = btn.querySelector('span');
      if (span) span.textContent = 'copied';
      setTimeout(() => {
        btn.classList.remove('copied');
        if (span) span.textContent = 'copy';
      }, 1500);
    }
    showToast(`copied: ${address}`);
  });
}

function showToast(text) {
  toastText.textContent = text;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2500);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// LISTENERS
accountPill.addEventListener('click', () => {
  if (currentAccountKey) {
    navigator.clipboard.writeText(currentAccountKey);
    showToast('account key copied to clipboard');
  }
});

btnAddFive.addEventListener('click', handleAddFive);
btnRefreshInbox.addEventListener('click', fetchMessages);
emailSearch.addEventListener('input', renderEmails);

modalClose.addEventListener('click', () => messageModal.classList.add('hidden'));
messageModal.addEventListener('click', (e) => {
  if (e.target === messageModal) messageModal.classList.add('hidden');
});

// BOOTSTRAP
initTheme();
checkAndStartCooldown();
initAccount();
setInterval(fetchMessages, 10000);
