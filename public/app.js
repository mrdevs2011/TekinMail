// TEKINMAIL // ULTRA LIGHTWEIGHT SCRIPT

const COOLDOWN_DURATION_MS = 5 * 60 * 1000;
const STORAGE_KEY_COOLDOWN = 'tekinmail_cooldown_until';
const STORAGE_KEY_ACCOUNT = 'tekinmail_account_key';
const STORAGE_KEY_THEME = 'tekinmail_theme';

// DOM
const themeToggle = document.getElementById('themeToggle');
const btnAddFive = document.getElementById('btnAddFive');
const btnIconPlus = document.getElementById('btnIconPlus');
const btnIconLock = document.getElementById('btnIconLock');
const btnText = document.getElementById('btnText');
const cooldownBanner = document.getElementById('cooldownBanner');
const cooldownTimerDisplay = document.getElementById('cooldownTimerDisplay');

const emailsList = document.getElementById('emailsList');
const emailsCount = document.getElementById('emailsCount');
const emailSearch = document.getElementById('emailSearch');
const toast = document.getElementById('toast');
const toastText = document.getElementById('toastText');

let currentAccountKey = null;
let currentEmails = [];
let cooldownInterval = null;

// THEME
function initTheme() {
  const theme = localStorage.getItem(STORAGE_KEY_THEME) || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
}

themeToggle.addEventListener('click', () => {
  const curr = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = curr === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(STORAGE_KEY_THEME, next);
});

// COOLDOWN
function checkCooldown() {
  const until = localStorage.getItem(STORAGE_KEY_COOLDOWN);
  if (!until) return;

  const untilTime = parseInt(until, 10);
  if (untilTime > Date.now()) {
    lockButton(untilTime);
  } else {
    localStorage.removeItem(STORAGE_KEY_COOLDOWN);
    unlockButton();
  }
}

function lockButton(untilTime) {
  if (cooldownInterval) clearInterval(cooldownInterval);

  btnAddFive.disabled = true;
  btnIconPlus.classList.add('hidden');
  btnIconLock.classList.remove('hidden');
  cooldownBanner.classList.remove('hidden');

  function tick() {
    const left = untilTime - Date.now();
    if (left <= 0) {
      clearInterval(cooldownInterval);
      localStorage.removeItem(STORAGE_KEY_COOLDOWN);
      unlockButton();
      return;
    }
    const sec = Math.ceil(left / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
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

// INIT
async function init() {
  currentAccountKey = localStorage.getItem(STORAGE_KEY_ACCOUNT);

  try {
    const url = currentAccountKey ? `/api/init-user?account_key=${encodeURIComponent(currentAccountKey)}` : `/api/init-user`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.success) {
      currentAccountKey = data.account_key;
      localStorage.setItem(STORAGE_KEY_ACCOUNT, currentAccountKey);
      currentEmails = data.emails || [];
      render();
    }
  } catch (e) {
    console.warn('Init error:', e);
  }
}

// ADD 5
btnAddFive.addEventListener('click', async () => {
  if (btnAddFive.disabled) return;

  btnAddFive.disabled = true;
  btnText.textContent = 'creating...';

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
      }
      currentEmails = [...data.emails, ...currentEmails];
      render();
      showToast(`+${data.added_count} aliases created`);

      const until = Date.now() + COOLDOWN_DURATION_MS;
      localStorage.setItem(STORAGE_KEY_COOLDOWN, until.toString());
      lockButton(until);
    } else {
      showToast('Error: ' + (data.error || 'Failed'));
      unlockButton();
    }
  } catch (err) {
    showToast('Network error');
    unlockButton();
  }
});

// RENDER
function render() {
  const q = (emailSearch.value || '').trim().toLowerCase();
  const list = currentEmails.filter(e => e.address.toLowerCase().includes(q));

  emailsCount.textContent = currentEmails.length.toString();

  if (list.length === 0) {
    emailsList.innerHTML = `
      <div class="empty">
        <p>${q ? 'no match' : 'no aliases yet'}</p>
        <span>click <code>add 5</code> to allocate</span>
      </div>
    `;
    return;
  }

  emailsList.innerHTML = list.map(item => `
    <div class="row">
      <span title="${item.address}">${item.address}</span>
      <button class="btn-copy" onclick="copy('${item.address}', this)">copy</button>
    </div>
  `).join('');
}

emailSearch.addEventListener('input', render);

function copy(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    if (btn) {
      btn.textContent = 'copied';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = 'copy';
        btn.classList.remove('copied');
      }, 1200);
    }
    showToast(`copied: ${text}`);
  });
}

function showToast(txt) {
  toastText.textContent = txt;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2000);
}

// START
initTheme();
checkCooldown();
init();
