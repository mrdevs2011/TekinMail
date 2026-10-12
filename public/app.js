// TEKINMAIL // ULTRA LIGHTWEIGHT SCRIPT WITH 2-STEP AUTH

const COOLDOWN_DURATION_MS = 5 * 60 * 1000;
const STORAGE_KEY_COOLDOWN = 'tekinmail_cooldown_until';
const STORAGE_KEY_ACCOUNT = 'tekinmail_account_key';
const STORAGE_KEY_THEME = 'tekinmail_theme';
const STORAGE_KEY_AUTH = 'tekinmail_auth_session';
const STORAGE_KEY_HIDDEN = 'tekinmail_hidden_emails';

// DOM AUTH
const loginCard = document.getElementById('loginCard');
const appCard = document.getElementById('appCard');
const loginTitle = document.getElementById('loginTitle');
const loginSubtitle = document.getElementById('loginSubtitle');
const formPass1 = document.getElementById('formPass1');
const inputPass1 = document.getElementById('inputPass1');
const formPass2 = document.getElementById('formPass2');
const inputPass2 = document.getElementById('inputPass2');

// DOM APP
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
let tempPass1 = '';

// ==========================================
// 1. TWO-STEP LOGIN CONTROLLER
// ==========================================

function checkSession() {
  const session = localStorage.getItem(STORAGE_KEY_AUTH);
  if (session) {
    showApp();
  } else {
    showLogin();
  }
}

function showLogin() {
  loginCard.classList.remove('hidden');
  appCard.classList.add('hidden');
  formPass1.classList.remove('hidden');
  formPass2.classList.add('hidden');
  inputPass1.focus();
}

function showApp() {
  loginCard.classList.add('hidden');
  appCard.classList.remove('hidden');
  checkCooldown();
  initApp();
}

// STEP 1 SUBMIT
formPass1.addEventListener('submit', async (e) => {
  e.preventDefault();
  const p1 = inputPass1.value.trim();
  if (!p1) return;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 1, pass1: p1 })
    });
    const data = await res.json();

    if (data.success && data.next_step === 2) {
      tempPass1 = p1;
      formPass1.classList.add('hidden');
      formPass2.classList.remove('hidden');
      loginTitle.textContent = 'security verification';
      loginSubtitle.textContent = '2-bosqichli maxfiy kalitni kiriting';
      inputPass2.focus();
    } else {
      showToast(data.error || '1-parol xato');
    }
  } catch (err) {
    showToast('Xatolik: Baza bilan bogʻlanib boʻlmadi');
  }
});

// STEP 2 SUBMIT
formPass2.addEventListener('submit', async (e) => {
  e.preventDefault();
  const p2 = inputPass2.value.trim();
  if (!p2) return;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 2, pass1: tempPass1, pass2: p2 })
    });
    const data = await res.json();

    if (data.success && data.token) {
      localStorage.setItem(STORAGE_KEY_AUTH, data.token);
      showToast('Xush kelibsiz!');
      showApp();
    } else {
      showToast(data.error || '2-parol xato');
    }
  } catch (err) {
    showToast('Xatolik: Baza bilan bogʻlanib boʻlmadi');
  }
});

// ==========================================
// 2. THEME CONTROLLER
// ==========================================

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

// ==========================================
// 3. COOLDOWN TAYMER (5 MIN, LOCALSTORAGE)
// ==========================================

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

// ==========================================
// 4. APP INITIALIZATION & EMAIL FETCH
// ==========================================

async function initApp() {
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

// ==========================================
// 5. ADD 5 EMAILS
// ==========================================

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

// ==========================================
// 6. RENDER & COPY & HIDE
// ==========================================

function getHiddenEmails() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_HIDDEN) || '[]');
  } catch (e) {
    return [];
  }
}

function hideEmail(address) {
  const hidden = getHiddenEmails();
  if (!hidden.includes(address)) {
    hidden.push(address);
    localStorage.setItem(STORAGE_KEY_HIDDEN, JSON.stringify(hidden));
  }
  render();
  showToast('yashirildi: ' + address);
}

function render() {
  const q = (emailSearch.value || '').trim().toLowerCase();
  const hidden = getHiddenEmails();

  // Yashirilgan emaillarni filtrlaymiz
  const visible = currentEmails.filter(e => !hidden.includes(e.address));
  const list = visible.filter(e => e.address.toLowerCase().includes(q));

  emailsCount.textContent = visible.length.toString();

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
      <div class="row-actions">
        <button class="btn-copy" onclick="copy('${item.address}', this)">copy</button>
        <button class="btn-del" onclick="hideEmail('${item.address}')" title="Yashirish">del</button>
      </div>
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
checkSession();
