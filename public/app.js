// ========================================================
// TEKINMAIL // MULTI-USER CLIENT ENGINE (OLED DARK)
// ========================================================

const COOLDOWN_DURATION_MS = 5 * 60 * 1000; // 5 minut
const STORAGE_KEY_AUTH = 'tekinmail_user_session';

// DOM ELEMENTLAR - AUTH
const authCard = document.getElementById('authCard');
const dashboardCard = document.getElementById('dashboardCard');
const userProfileBar = document.getElementById('userProfileBar');
const displayFullName = document.getElementById('displayFullName');
const displayUsername = document.getElementById('displayUsername');
const btnLogout = document.getElementById('btnLogout');

// TABS & FORMS
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const formLogin = document.getElementById('formLogin');
const formRegister = document.getElementById('formRegister');
const linkToRegister = document.getElementById('linkToRegister');
const linkToLogin = document.getElementById('linkToLogin');

// INPUTS
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const btnLoginSubmit = document.getElementById('btnLoginSubmit');

const regFullName = document.getElementById('regFullName');
const regUsername = document.getElementById('regUsername');
const regPassword = document.getElementById('regPassword');
const btnRegisterSubmit = document.getElementById('btnRegisterSubmit');

// DOM ELEMENTLAR - DASHBOARD
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

// STATE
let currentUser = null; // { id, full_name, username, token }
let currentEmails = [];
let cooldownInterval = null;

// ==========================================
// 1. AUTH TABS NAVIGATION
// ==========================================

function switchToLogin() {
  tabLogin.classList.add('active');
  tabRegister.classList.remove('active');
  formLogin.classList.remove('hidden');
  formRegister.classList.add('hidden');
  loginUsername.focus();
}

function switchToRegister() {
  tabRegister.classList.add('active');
  tabLogin.classList.remove('active');
  formRegister.classList.remove('hidden');
  formLogin.classList.add('hidden');
  regFullName.focus();
}

tabLogin.addEventListener('click', switchToLogin);
tabRegister.addEventListener('click', switchToRegister);
linkToRegister.addEventListener('click', (e) => { e.preventDefault(); switchToRegister(); });
linkToLogin.addEventListener('click', (e) => { e.preventDefault(); switchToLogin(); });

// ==========================================
// 2. SESSION MANAGEMENT
// ==========================================

function checkSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUTH);
    if (raw) {
      currentUser = JSON.parse(raw);
      if (currentUser && currentUser.token && currentUser.id) {
        showDashboard();
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
  if (cooldownInterval) clearInterval(cooldownInterval);
  showToast('Tizimdan chiqildi');
  showAuth();
}

btnLogout.addEventListener('click', logout);

function showAuth() {
  authCard.classList.remove('hidden');
  dashboardCard.classList.add('hidden');
  userProfileBar.classList.add('hidden');
  switchToLogin(); // Standart holat: Login
}

function showDashboard() {
  authCard.classList.add('hidden');
  dashboardCard.classList.remove('hidden');
  userProfileBar.classList.remove('hidden');

  displayFullName.textContent = currentUser.full_name;
  displayUsername.textContent = '@' + currentUser.username;

  checkCooldown();
  loadUserEmails();
}

// ==========================================
// 3. REGISTER (ROOT HISOB OCHISH)
// ==========================================

formRegister.addEventListener('submit', async (e) => {
  e.preventDefault();

  const fullName = regFullName.value.trim();
  const username = regUsername.value.trim();
  const password = regPassword.value.trim();

  if (!fullName || !username || !password) return;

  btnRegisterSubmit.disabled = true;
  btnRegisterSubmit.textContent = 'ochilmoqda...';

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName, username, password })
    });

    const data = await res.json();

    if (data.success && data.user && data.token) {
      saveSession(data.user, data.token);
      showToast(`Xush kelibsiz, ${data.user.full_name}!`);
      formRegister.reset();
      showDashboard();
    } else {
      showToast(data.error || 'Roʻyxatdan oʻtishda xatolik');
    }
  } catch (err) {
    showToast('Tarmoq xatosi: serverga ulanib boʻlmadi');
  } finally {
    btnRegisterSubmit.disabled = false;
    btnRegisterSubmit.textContent = 'root hisob ochish';
  }
});

// ==========================================
// 4. LOGIN (TIZIMGA KIRISH)
// ==========================================

formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = loginUsername.value.trim();
  const password = loginPassword.value.trim();

  if (!username || !password) return;

  btnLoginSubmit.disabled = true;
  btnLoginSubmit.textContent = 'tekshirilmoqda...';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (data.success && data.user && data.token) {
      saveSession(data.user, data.token);
      showToast(`Xush kelibsiz, ${data.user.full_name}!`);
      formLogin.reset();
      showDashboard();
    } else {
      showToast(data.error || 'Kirishda xatolik');
    }
  } catch (err) {
    showToast('Tarmoq xatosi: serverga ulanib boʻlmadi');
  } finally {
    btnLoginSubmit.disabled = false;
    btnLoginSubmit.textContent = 'tizimga kirish';
  }
});

// ==========================================
// 5. COOLDOWN TAYMER (5 MIN, HAR BIR USER UCHUN)
// ==========================================

function getCooldownStorageKey() {
  return currentUser ? `tekinmail_cooldown_${currentUser.id}` : 'tekinmail_cooldown_global';
}

function checkCooldown() {
  const until = localStorage.getItem(getCooldownStorageKey());
  if (!until) return;

  const untilTime = parseInt(until, 10);
  if (untilTime > Date.now()) {
    lockButton(untilTime);
  } else {
    localStorage.removeItem(getCooldownStorageKey());
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
      localStorage.removeItem(getCooldownStorageKey());
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
// 6. EMAILLARNI YUKLASH VA QO'SHISH
// ==========================================

async function loadUserEmails() {
  if (!currentUser) return;

  try {
    const res = await fetch('/api/get-emails', {
      headers: { 'Authorization': `Bearer ${currentUser.token}` }
    });
    const data = await res.json();

    if (data.success) {
      currentEmails = data.emails || [];
      renderEmails();
    }
  } catch (err) {
    console.warn('Load emails failed:', err);
  }
}

btnAddFive.addEventListener('click', async () => {
  if (btnAddFive.disabled || !currentUser) return;

  btnAddFive.disabled = true;
  btnText.textContent = 'creating...';

  try {
    const res = await fetch('/api/add-emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentUser.token}`
      }
    });

    const data = await res.json();

    if (data.success && data.emails) {
      currentEmails = [...data.emails, ...currentEmails];
      renderEmails();
      showToast(`+${data.added_count} ta yangi email qo'shildi`);

      const until = Date.now() + COOLDOWN_DURATION_MS;
      localStorage.setItem(getCooldownStorageKey(), until.toString());
      lockButton(until);
    } else {
      showToast(data.error || 'Qoʻshishda xatolik');
      unlockButton();
    }
  } catch (err) {
    showToast('Tarmoq xatosi');
    unlockButton();
  }
});

// ==========================================
// 7. YASHIRISH (DELETE FROM UI) VA NUSXALASH
// ==========================================

function getHiddenStorageKey() {
  return currentUser ? `tekinmail_hidden_${currentUser.id}` : 'tekinmail_hidden_global';
}

function getHiddenEmails() {
  try {
    return JSON.parse(localStorage.getItem(getHiddenStorageKey()) || '[]');
  } catch (e) {
    return [];
  }
}

function hideEmail(address) {
  const hidden = getHiddenEmails();
  if (!hidden.includes(address)) {
    hidden.push(address);
    localStorage.setItem(getHiddenStorageKey(), JSON.stringify(hidden));
  }
  renderEmails();
  showToast('yashirildi: ' + address);
}

function renderEmails() {
  const q = (emailSearch.value || '').trim().toLowerCase();
  const hidden = getHiddenEmails();

  // Yashirilganlarni ro'yxatdan chiqarmaymiz
  const visible = currentEmails.filter(e => !hidden.includes(e.address));
  const list = visible.filter(e => e.address.toLowerCase().includes(q));

  emailsCount.textContent = visible.length.toString();

  if (list.length === 0) {
    emailsList.innerHTML = `
      <div class="empty">
        <p>${q ? 'bunday email topilmadi' : 'hozircha emaillar yoʻq'}</p>
        <span>birinchi 5 ta emailni ochish uchun <code>add 5</code> ni bosing</span>
      </div>
    `;
    return;
  }

  emailsList.innerHTML = list.map(item => `
    <div class="row">
      <span title="${escapeHtml(item.address)}">${escapeHtml(item.address)}</span>
      <div class="row-actions">
        <button class="btn-copy" onclick="copyAddress('${item.address}', this)">copy</button>
        <button class="btn-del" onclick="hideEmail('${item.address}')" title="UI dan yashirish">del</button>
      </div>
    </div>
  `).join('');
}

emailSearch.addEventListener('input', renderEmails);

function copyAddress(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    if (btn) {
      btn.textContent = 'copied';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = 'copy';
        btn.classList.remove('copied');
      }, 1200);
    }
    showToast(`nusxalandi: ${text}`);
  });
}

function showToast(txt) {
  toastText.textContent = txt;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2200);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// START
checkSession();
