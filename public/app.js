// TEKINMAIL // FRONTEND CLIENT SCRIPT (WITH CLAUDE BYPASS)

const COOLDOWN_DURATION_MS = 5 * 60 * 1000;
const STORAGE_KEY_ACCOUNT = 'tekinmail_account_key';
const STORAGE_KEY_COOLDOWN = 'tekinmail_add5_cooldown_until';
const STORAGE_KEY_THEME = 'tekinmail_theme';
const STORAGE_KEY_BASE_EMAIL = 'tekinmail_base_email';

// DOM ELEMENTLAR
const themeToggle = document.getElementById('themeToggle');
const accountPill = document.getElementById('accountPill');
const accountKeyDisplay = document.getElementById('accountKeyDisplay');

// TABS
const tabTemp = document.getElementById('tabTemp');
const tabBypass = document.getElementById('tabBypass');
const sectionTemp = document.getElementById('sectionTemp');
const sectionBypass = document.getElementById('sectionBypass');

// TEMP INBOX ELEMENTS
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

// CLAUDE BYPASS ELEMENTS
const baseEmailInput = document.getElementById('baseEmailInput');
const btnGen100 = document.getElementById('btnGen100');
const btnCopyAllBypass = document.getElementById('btnCopyAllBypass');
const bypassSearch = document.getElementById('bypassSearch');
const bypassList = document.getElementById('bypassList');
const bypassCount = document.getElementById('bypassCount');

// MODAL & TOAST
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
let generatedBypassAliases = [];
let cooldownInterval = null;

// ==========================================
// 1. TABS SWITCHER
// ==========================================

tabTemp.addEventListener('click', () => {
  tabTemp.classList.add('active');
  tabBypass.classList.remove('active');
  sectionTemp.classList.remove('hidden');
  sectionBypass.classList.add('hidden');
});

tabBypass.addEventListener('click', () => {
  tabBypass.classList.add('active');
  tabTemp.classList.remove('active');
  sectionBypass.classList.remove('hidden');
  sectionTemp.classList.add('hidden');

  if (generatedBypassAliases.length === 0) {
    generateClaudeAliases();
  }
});

// ==========================================
// 2. CLAUDE 100x ALIAS GENERATOR
// ==========================================

function generateClaudeAliases() {
  const rawEmail = (baseEmailInput.value || '').trim().toLowerCase();

  if (!rawEmail || !rawEmail.includes('@')) {
    showToast('Iltimos, toʻgʻri email kiriting (masalan mrdevs2011@proton.me)');
    return;
  }

  localStorage.setItem(STORAGE_KEY_BASE_EMAIL, rawEmail);

  const [username, domain] = rawEmail.split('@');
  const aliases = [];

  // 1. Numerik taglar: +cl01 ... +cl50
  for (let i = 1; i <= 50; i++) {
    const num = String(i).padStart(2, '0');
    aliases.push(`${username}+cl${num}@${domain}`);
  }

  // 2. Maxsus maqsadli taglar: +dev, +pro, +core, +lab va h.k.
  const tags = [
    'ai', 'core', 'dev', 'pro', 'lab', 'hub', 'box', 'run', 'net', 'sys',
    'app', 'bot', 'code', 'fast', 'work', 'test', 'team', 'auth', 'flow', 'task',
    'alpha', 'beta', 'deep', 'live', 'sync', 'desk', 'node', 'link', 'zone', 'meta',
    'prime', 'agent', 'smart', 'cloud', 'quick', 'shift', 'pulse', 'spark', 'nexus', 'byte',
    'intel', 'logic', 'micro', 'macro', 'turbo', 'space', 'craft', 'pixel', 'stack', 'ultra'
  ];

  tags.forEach(t => {
    aliases.push(`${username}+${t}@${domain}`);
  });

  generatedBypassAliases = aliases;
  renderBypassAliases();
  showToast(`✅ ${aliases.length} ta Claude uchun yangi alias yaratildi!`);
}

function renderBypassAliases() {
  const query = (bypassSearch.value || '').trim().toLowerCase();
  const filtered = generatedBypassAliases.filter(a => a.toLowerCase().includes(query));

  bypassCount.textContent = `${filtered.length} ta alias`;

  if (filtered.length === 0) {
    bypassList.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><p>Hech narsa topilmadi</p></div>`;
    return;
  }

  bypassList.innerHTML = filtered.map((item, idx) => `
    <div class="bypass-item">
      <span class="alias-text" title="${escapeHtml(item)}">${escapeHtml(item)}</span>
      <button class="btn-alias-copy" onclick="copyAddress('${item}', this)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
        </svg>
        <span>copy</span>
      </button>
    </div>
  `).join('');
}

btnGen100.addEventListener('click', generateClaudeAliases);
bypassSearch.addEventListener('input', renderBypassAliases);

btnCopyAllBypass.addEventListener('click', () => {
  if (generatedBypassAliases.length === 0) return;
  const allText = generatedBypassAliases.join('\n');
  navigator.clipboard.writeText(allText).then(() => {
    showToast(`Barcha ${generatedBypassAliases.length} ta alias nusxalandi!`);
  });
});

// ==========================================
// 3. THEME TOGGLE
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
// 4. COOLDOWN TAYMER
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
// 5. TEMP INBOX INIT & ALLOCATION
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
    }
  } catch (err) {
    console.warn('Init fetch failed:', err);
  }
}

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
      if (data.account_key) {
        currentAccountKey = data.account_key;
        localStorage.setItem(STORAGE_KEY_ACCOUNT, currentAccountKey);
        accountKeyDisplay.textContent = currentAccountKey;
      }
      currentEmails = [...data.emails, ...currentEmails];
      renderEmails();
      showToast(`+${data.added_count} addresses allocated`);
      startFiveMinuteCooldown();
    } else {
      showToast('allocation failed: ' + (data.error || 'unknown'));
      unlockButton();
    }
  } catch (err) {
    showToast('error: ' + err.message);
    unlockButton();
  }
}

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
// 6. MESSAGES
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

function openMessageDetail(messageId, toEmail) {
  const found = currentMessages.find(m => m.id === messageId);
  messageModal.classList.remove('hidden');

  if (found) {
    modalSubject.textContent = found.subject || '(no subject)';
    modalFrom.textContent = `from: ${found.from}`;
    modalTo.textContent = `to: ${found.to_email}`;
    if (found.html) {
      modalBody.innerHTML = found.html;
    } else {
      modalBody.innerHTML = `<pre style="white-space: pre-wrap; font-family: var(--font-mono);">${escapeHtml(found.body || found.intro || '')}</pre>`;
    }
  }
}

// ==========================================
// UTILS
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
    showToast('account key copied');
  }
});

btnAddFive.addEventListener('click', handleAddFive);
btnRefreshInbox.addEventListener('click', fetchMessages);
emailSearch.addEventListener('input', renderEmails);

modalClose.addEventListener('click', () => messageModal.classList.add('hidden'));
messageModal.addEventListener('click', (e) => {
  if (e.target === messageModal) messageModal.classList.add('hidden');
});

// START
initTheme();
checkAndStartCooldown();
initAccount();

// Saved emailni tiklash
const savedBaseEmail = localStorage.getItem(STORAGE_KEY_BASE_EMAIL);
if (savedBaseEmail) {
  baseEmailInput.value = savedBaseEmail;
}

setInterval(fetchMessages, 10000);
