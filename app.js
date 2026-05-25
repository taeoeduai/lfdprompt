// ============================================
// Promptlibrary — Liquid Glass Prompts
// Firebase Firestore real-time + Apple design
// Auth system + Admin library editing
// ============================================

// --- Firebase Init (compat SDK) ---
const firebaseConfig = {
  apiKey: "AIzaSyALsGTWeB1MUfkXQOsHuA4E2wVOh9tZ_iI",
  authDomain: "foundfounded-7cd3e.firebaseapp.com",
  projectId: "foundfounded-7cd3e",
  storageBucket: "foundfounded-7cd3e.firebasestorage.app",
  messagingSenderId: "705068371976",
  appId: "1:705068371976:web:546b664ff9b87d99eac1bd",
  measurementId: "G-G0DR5QJZY0"
};

firebase.initializeApp(firebaseConfig);
firebase.analytics();
const db = firebase.firestore();

const canvas = document.getElementById('canvas');
const listView = document.getElementById('list-view');
const libraryView = document.getElementById('library-view');
const listContent = document.getElementById('list-content');
const textarea = document.getElementById('prompt-input');
const authorInput = document.getElementById('author-input');
const submitBtn = document.getElementById('submit-btn');
const navFloat = document.getElementById('nav-float');
const navList = document.getElementById('nav-list');
const navLibrary = document.getElementById('nav-library');
const filterNewest = document.getElementById('filter-newest');
const filterOldest = document.getElementById('filter-oldest');

// --- State ---
let prompts = [];
let currentView = 'float';
let sortOrder = 'newest';

// ============================================
// AUTH SYSTEM
// ============================================
const AUTH_CREDENTIALS = {
  admin: { password: '3913', role: 'admin' }
};
const DEFAULT_PASSWORD = '3377';

let isLoggedIn = false;
let currentUser = null; // { id, role }
let isAdmin = false;

// Auth DOM elements
const navLoginBtn = document.getElementById('nav-login-btn');
const navUserInfo = document.getElementById('nav-user-info');
const navUserBadge = document.getElementById('nav-user-badge');
const navLogoutBtn = document.getElementById('nav-logout-btn');
const loginModal = document.getElementById('login-modal');
const loginModalBackdrop = document.getElementById('login-modal-backdrop');
const loginModalClose = document.getElementById('login-modal-close');
const loginIdInput = document.getElementById('login-id');
const loginPwInput = document.getElementById('login-pw');
const loginError = document.getElementById('login-error');
const loginSubmitBtn = document.getElementById('login-submit');

// Pending action after login (callback)
let pendingAuthAction = null;

// --- Restore session from localStorage ---
function restoreSession() {
  try {
    const session = JSON.parse(localStorage.getItem('pl_session'));
    if (session && session.id) {
      isLoggedIn = true;
      currentUser = session;
      isAdmin = session.role === 'admin';
      updateAuthUI();
      applyLoginState();
    }
  } catch (e) {
    localStorage.removeItem('pl_session');
  }
}

function saveSession() {
  if (isLoggedIn && currentUser) {
    localStorage.setItem('pl_session', JSON.stringify(currentUser));
  } else {
    localStorage.removeItem('pl_session');
  }
}

function updateAuthUI() {
  if (isLoggedIn) {
    navLoginBtn.classList.add('hidden');
    navUserInfo.classList.remove('hidden');
    navUserBadge.textContent = currentUser.id.toUpperCase();
  } else {
    navLoginBtn.classList.remove('hidden');
    navUserInfo.classList.add('hidden');
    navUserBadge.textContent = '';
  }
}

function applyLoginState() {
  if (isLoggedIn && currentUser) {
    // Auto-fill initials (not for admin)
    if (currentUser.role !== 'admin') {
      authorInput.value = currentUser.id.toUpperCase();
      authorInput.readOnly = true;
      authorInput.style.opacity = '0.7';
      localStorage.setItem('pl_author', currentUser.id.toUpperCase());
    } else {
      // Admin uses "ADMIN" label
      authorInput.value = 'AD';
      authorInput.readOnly = true;
      authorInput.style.opacity = '0.7';
      localStorage.setItem('pl_author', 'AD');
    }
  } else {
    authorInput.readOnly = false;
    authorInput.style.opacity = '';
  }
}

// --- Login ---
function attemptLogin() {
  const id = loginIdInput.value.trim();
  const pw = loginPwInput.value.trim();

  if (!id || !pw) {
    showLoginError('아이디와 비밀번호를 입력해주세요.');
    return;
  }

  // Check admin
  if (id.toLowerCase() === 'admin') {
    if (pw === AUTH_CREDENTIALS.admin.password) {
      loginSuccess({ id: 'admin', role: 'admin' });
      return;
    } else {
      showLoginError('비밀번호가 올바르지 않습니다.');
      return;
    }
  }

  // Check normal user (initials)
  if (pw === DEFAULT_PASSWORD) {
    loginSuccess({ id: id.toUpperCase().slice(0, 3), role: 'user' });
    return;
  }

  showLoginError('아이디 또는 비밀번호가 올바르지 않습니다.');
}

function loginSuccess(user) {
  isLoggedIn = true;
  currentUser = user;
  isAdmin = user.role === 'admin';
  saveSession();
  updateAuthUI();
  applyLoginState();
  closeLoginModal();
  showToast((isAdmin ? '관리자' : currentUser.id) + '로 로그인되었습니다');

  // Execute pending action
  if (pendingAuthAction) {
    const action = pendingAuthAction;
    pendingAuthAction = null;
    setTimeout(action, 100);
  }
}

function logout() {
  isLoggedIn = false;
  currentUser = null;
  isAdmin = false;
  saveSession();
  updateAuthUI();

  // Reset author input
  authorInput.readOnly = false;
  authorInput.style.opacity = '';
  authorInput.value = '';
  localStorage.removeItem('pl_author');

  // If on library view, go back to dashboard
  if (currentView === 'library') {
    setView('float');
  }

  showToast('로그아웃되었습니다');
}

// --- Login Modal ---
function openLoginModal(afterLoginAction) {
  pendingAuthAction = afterLoginAction || null;
  loginIdInput.value = '';
  loginPwInput.value = '';
  loginError.classList.add('hidden');
  loginModal.classList.add('is-open');
  loginModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  setTimeout(() => loginIdInput.focus(), 200);
}

function closeLoginModal() {
  loginModal.classList.remove('is-open');
  loginModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  pendingAuthAction = null;
}

function showLoginError(msg) {
  loginError.textContent = msg;
  loginError.classList.remove('hidden');
  // Re-trigger shake animation
  loginError.style.animation = 'none';
  loginError.offsetHeight; // force reflow
  loginError.style.animation = '';
}

// --- Auth Gate ---
function requireLogin(action) {
  if (isLoggedIn) {
    action();
  } else {
    openLoginModal(action);
  }
}

// Auth event listeners
navLoginBtn.addEventListener('click', function() {
  openLoginModal();
});

navLogoutBtn.addEventListener('click', logout);

loginModalBackdrop.addEventListener('click', closeLoginModal);
loginModalClose.addEventListener('click', closeLoginModal);

loginSubmitBtn.addEventListener('click', attemptLogin);

loginPwInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') attemptLogin();
});

loginIdInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') loginPwInput.focus();
});

// --- Toast ---
function showToast(msg) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('is-visible');
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(function() {
    toast.classList.remove('is-visible');
  }, 2200);
}

// ============================================
// LIBRARY ADMIN EDITING
// ============================================
let libEditingItem = null;
let libEditMode = false;

// Load custom library data from local storage as initial cache
function loadLibraryOverrides() {
  try {
    const overrides = JSON.parse(localStorage.getItem('pl_lib_overrides'));
    if (overrides) {
      libraryData.forEach(item => {
        if (overrides[item.id]) {
          if (overrides[item.id].title !== undefined) item.title = overrides[item.id].title;
          if (overrides[item.id].prompt !== undefined) item.prompt = overrides[item.id].prompt;
          if (overrides[item.id].images !== undefined) item.images = overrides[item.id].images;
          if (overrides[item.id].thumbnails !== undefined) item.thumbnails = overrides[item.id].thumbnails;
        }
      });
    }
  } catch (e) {
    console.warn('Failed to load library overrides from cache:', e);
  }
}

// Real-time listen to library overrides from Firestore so they sync everywhere
function startLibraryOverridesListener() {
  db.collection('library_overrides').onSnapshot(function(snapshot) {
    snapshot.forEach(function(doc) {
      const itemId = doc.id;
      const data = doc.data();
      const item = libraryData.find(d => d.id === itemId);
      if (item) {
        if (data.title !== undefined) item.title = data.title;
        if (data.prompt !== undefined) item.prompt = data.prompt;
        if (data.images !== undefined) item.images = data.images;
        if (data.thumbnails !== undefined) item.thumbnails = data.thumbnails;
      }
    });
    // Re-render library if active
    if (currentView === 'library') {
      renderLibrary();
    }
  }, function(error) {
    console.warn('Failed to listen to library overrides from Firestore:', error);
  });
}

function saveLibraryOverride(itemId, data) {
  // 1. Sync to Firestore
  db.collection('library_overrides').doc(itemId).set(data, { merge: true })
    .then(function() {
      console.log('Saved library override to Firestore');
    })
    .catch(function(e) {
      console.warn('Failed to save library override to Firestore:', e);
    });

  // 2. Cache locally
  try {
    const overrides = JSON.parse(localStorage.getItem('pl_lib_overrides')) || {};
    if (!overrides[itemId]) overrides[itemId] = {};
    Object.assign(overrides[itemId], data);
    localStorage.setItem('pl_lib_overrides', JSON.stringify(overrides));
  } catch (e) {
    console.warn('Failed to save library override to localStorage:', e);
  }
}

// Compress image for localStorage storage
function compressImage(dataUrl, maxWidth, quality) {
  return new Promise(function(resolve) {
    const img = new Image();
    img.onload = function() {
      const cvs = document.createElement('canvas');
      let w = img.width;
      let h = img.height;
      if (w > maxWidth) {
        h = (maxWidth / w) * h;
        w = maxWidth;
      }
      cvs.width = w;
      cvs.height = h;
      const ctx = cvs.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(cvs.toDataURL('image/jpeg', quality || 0.7));
    };
    img.src = dataUrl;
  });
}

// Generate thumbnail from image
function generateThumbnail(dataUrl) {
  return compressImage(dataUrl, 200, 0.6);
}

// ============================================
// ORIGINAL APP LOGIC (with auth gates)
// ============================================

// Restore author from localStorage (only if not logged in)
const saved = localStorage.getItem('pl_author') || '';
if (saved) authorInput.value = saved;

// Sync initials input with localStorage in real-time
authorInput.addEventListener('input', function() {
  if (authorInput.readOnly) return;
  const val = this.value.trim().toUpperCase().slice(0, 3);
  if (val) {
    localStorage.setItem('pl_author', val);
  } else {
    localStorage.removeItem('pl_author');
  }
});

// Clear the input value on focus so user can immediately type fresh initials
authorInput.addEventListener('focus', function() {
  if (authorInput.readOnly) return;
  this.value = '';
  localStorage.removeItem('mc_author');
});

// --- Helpers ---
function rand(a, b) { return Math.random() * (b - a) + a; }
function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function fmtTime(ts) {
  const diff = Math.floor((Date.now() - ts) / 60000);
  if (diff < 1) return '방금 전';
  if (diff < 60) return diff + '분 전';
  const h = Math.floor(diff / 60);
  if (h < 24) return h + '시간 전';
  const d = new Date(ts);
  return (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
    String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

// --- Positioning ---
let placed = [];

function findPos(cw, ch, bw, bh) {
  const pad = 14;
  for (let i = 0; i < 50; i++) {
    const x = rand(pad, Math.max(cw - bw - pad, pad + 10));
    const y = rand(pad, Math.max(ch - bh - pad, pad + 10));
    let ok = true;
    for (const r of placed) {
      if (x < r.x + r.w + 6 && x + bw + 6 > r.x && y < r.y + r.h + 6 && y + bh + 6 > r.y) { ok = false; break; }
    }
    if (ok) return { x, y };
  }
  return { x: rand(14, Math.max(cw - bw - 14, 24)), y: rand(14, Math.max(ch - bh - 14, 24)) };
}

// --- Bubble ---
function mkBubble(p, x, y, enter) {
  const el = document.createElement('div');
  el.className = 'bubble-wrapper' + (enter ? ' bubble-wrapper--enter' : '');
  el.dataset.id = p.id;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  const dr = 35;
  el.style.setProperty('--d-dur', rand(12, 20) + 's');
  el.style.setProperty('--d-del', rand(0, 6) + 's');
  el.style.setProperty('--dx1', rand(-dr, dr) + 'px');
  el.style.setProperty('--dy1', rand(-dr, dr) + 'px');
  el.style.setProperty('--dx2', rand(-dr, dr) + 'px');
  el.style.setProperty('--dy2', rand(-dr, dr) + 'px');
  el.style.setProperty('--dx3', rand(-dr, dr) + 'px');
  el.style.setProperty('--dy3', rand(-dr, dr) + 'px');
  const a = p.author ? escHtml(p.author) : '';
  
  let widthStyle = p.width ? `width: ${p.width}px; ` : '';

  el.innerHTML =
    `<div class="bubble" style="${widthStyle}">` +
      (a ? '<p class="bubble__author">' + a + '</p>' : '') +
      '<p class="bubble__text">' + escHtml(p.text) + '</p>' +
    '</div>' +
    '<button class="delete-btn" data-id="' + p.id + '" aria-label="삭제">&times;</button>';
  
  const innerBubble = el.querySelector('.bubble');
  
  let isDragging = false;
  let startX, startY, initialLeft, initialTop;

  el.querySelector('.delete-btn').addEventListener('click', function (e) {
    e.stopPropagation();
    // Auth gate for delete
    requireLogin(function() {
      deletePrompt(p.id, el);
    });
  });

  el.addEventListener('pointerdown', function (e) {
    if (e.target.closest('.delete-btn')) return;
    if (e.pointerType === 'mouse' && e.target.closest('.bubble__text')) return;
    // Prevent drag if clicking resize handle (bottom-right 24x24 px of bubble)
    if (e.target.closest('.bubble')) {
      const rect = innerBubble.getBoundingClientRect();
      if (e.clientX >= rect.right - 24 && e.clientY >= rect.bottom - 24) {
        // User is resizing width. Save width on pointerup anywhere on screen
        window.addEventListener('pointerup', () => {
          if (!p.id.startsWith('local-')) {
            const w = innerBubble.offsetWidth;
            db.collection('prompts').doc(p.id).update({ width: w }).catch(err => console.warn(err));
          }
        }, { once: true });
        return;
      }
    }
    isDragging = true;
    el.classList.add('is-dragging');
    startX = e.clientX;
    startY = e.clientY;
    initialLeft = parseFloat(el.style.left) || 0;
    initialTop = parseFloat(el.style.top) || 0;
    el.setPointerCapture(e.pointerId);
  });

  el.addEventListener('pointermove', function (e) {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    let newLeft = initialLeft + dx;
    let newTop = initialTop + dy;
    
    // Clamp within canvas bounds to prevent disappearing
    newLeft = Math.max(0, Math.min(newLeft, canvas.offsetWidth - innerBubble.offsetWidth));
    newTop = Math.max(0, Math.min(newTop, canvas.offsetHeight - innerBubble.offsetHeight));
    
    el.style.left = newLeft + 'px';
    el.style.top = newTop + 'px';
  });

  el.addEventListener('pointerup', function (e) {
    if (!isDragging) return;
    isDragging = false;
    el.classList.remove('is-dragging');
    el.releasePointerCapture(e.pointerId);
    
    // Save new proportional position to Firestore
    if (!p.id.startsWith('local-')) {
      const px = (parseFloat(el.style.left) || 0) / canvas.offsetWidth;
      const py = (parseFloat(el.style.top) || 0) / canvas.offsetHeight;
      db.collection('prompts').doc(p.id).update({ posX: px, posY: py }).catch(function(err) {
        console.warn('Update position failed:', err.message);
      });
    }
  });

  el.addEventListener('pointercancel', function (e) {
    if (!isDragging) return;
    isDragging = false;
    el.classList.remove('is-dragging');
    el.releasePointerCapture(e.pointerId);
  });

  if (enter) el.addEventListener('animationend', () => el.classList.remove('bubble-wrapper--enter'), { once: true });
  return el;
}

// --- Render Floating ---
function renderFloat() {
  const existingBubbles = Array.from(canvas.querySelectorAll('.bubble-wrapper'));
  const emptyState = canvas.querySelector('.empty-state');

  if (!prompts.length) {
    existingBubbles.forEach(b => b.remove());
    if (!emptyState) {
      canvas.insertAdjacentHTML('beforeend',
        '<div class="empty-state"><p class="empty-state__text">아직 프롬프트가 없습니다.<br>아래에서 입력해 주세요.</p></div>');
    }
    placed = [];
    return;
  }

  if (emptyState) emptyState.remove();

  const r = canvas.getBoundingClientRect();
  const show = prompts.slice(0, 25);
  const showIds = new Set(show.map(p => p.id));

  // Remove old bubbles
  existingBubbles.forEach(b => {
    if (!showIds.has(b.dataset.id)) {
      b.remove();
    }
  });

  placed = [];
  
  // Register existing bubbles into 'placed'
  const currentBubbles = Array.from(canvas.querySelectorAll('.bubble-wrapper'));
  currentBubbles.forEach(b => {
    const x = parseFloat(b.style.left) || 0;
    const y = parseFloat(b.style.top) || 0;
    const inner = b.querySelector('.bubble');
    placed.push({ x: x, y: y, w: (inner ? inner.offsetWidth : 200), h: (inner ? inner.offsetHeight : 60) });
  });

  // Update existing and create new bubbles
  show.forEach(p => {
    const existing = canvas.querySelector(`.bubble-wrapper[data-id="${p.id}"]`);
    
    let targetX, targetY;
    
    // Default to a much wider box to keep text within 1~8 lines and emphasize horizontal shape
    let ew = p.width || Math.min(350 + p.text.length * 6, 800);
    
    // On mobile, the box cannot be wider than the screen.
    if (ew > r.width - 32) ew = r.width - 32;
    
    const eh = p.height || (44 + Math.ceil(p.text.length / 16) * 16);

    if (p.posX !== null && p.posY !== null) {
      targetX = p.posX * r.width;
      targetY = p.posY * r.height;
      // Clamp to bounds
      targetX = Math.max(0, Math.min(targetX, r.width - ew));
      targetY = Math.max(0, Math.min(targetY, r.height - eh));
    }

    if (!existing) {
      if (targetX === undefined) {
        const pos = findPos(r.width, r.height, ew, eh);
        targetX = pos.x;
        targetY = pos.y;
      }
      placed.push({ x: targetX, y: targetY, w: ew, h: eh });
      canvas.appendChild(mkBubble(p, targetX, targetY, true));
    } else {
      // Sync width if updated remotely (height is always auto)
      const innerBubble = existing.querySelector('.bubble');
      if (innerBubble && !existing.classList.contains('is-dragging')) {
        if (p.width && p.width !== innerBubble.offsetWidth) innerBubble.style.width = p.width + 'px';
      }

      // Move existing bubble if it has remote coordinates and is NOT currently being dragged by THIS user
      if (targetX !== undefined && !existing.classList.contains('is-dragging')) {
        existing.style.left = targetX + 'px';
        existing.style.top = targetY + 'px';
      }
    }
  });
}

// --- Render List ---
function renderList() {
  listContent.innerHTML = '';
  if (!prompts.length) {
    listContent.innerHTML = '<div class="empty-state" style="position:relative;min-height:200px"><p class="empty-state__text">아직 프롬프트가 없습니다.</p></div>';
    return;
  }
  const sorted = [...prompts].sort((a, b) => sortOrder === 'newest' ? b.time - a.time : a.time - b.time);
  sorted.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.style.animationDelay = (i * 0.03) + 's';
    const a = p.author ? escHtml(p.author) : '—';
    item.innerHTML =
      '<div class="list-item__author">' + a + '</div>' +
      '<div class="list-item__body">' +
      '<p class="list-item__text">' + escHtml(p.text) + '</p>' +
      '<p class="list-item__time">' + fmtTime(p.time) + '</p>' +
      '</div>' +
      '<button class="delete-btn delete-btn--list" data-id="' + p.id + '" aria-label="삭제">&times;</button>';
    item.querySelector('.delete-btn').addEventListener('click', function (e) {
      e.stopPropagation();
      // Auth gate for delete
      requireLogin(function() {
        deletePrompt(p.id, item);
      });
    });
    listContent.appendChild(item);
  });
}

// --- Delete Prompt ---
function deletePrompt(id, el) {
  // Fade out animation
  el.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
  el.style.opacity = '0';
  el.style.transform = 'scale(0.9)';

  if (id && !id.startsWith('local-')) {
    db.collection('prompts').doc(id).delete().catch(function (e) {
      console.warn('Delete failed:', e.message);
    });
    // onSnapshot will auto-update
  } else {
    // Local-only prompt
    setTimeout(function () {
      prompts = prompts.filter(function (p) { return p.id !== id; });
      if (currentView === 'float') renderFloat();
      if (currentView === 'list') renderList();
    }, 250);
  }
}

// --- Firestore Listener ---
function startListener() {
  try {
    db.collection('prompts').orderBy('createdAt', 'desc')
      .onSnapshot(function (snapshot) {
        prompts = snapshot.docs.map(function (doc) {
          var d = doc.data();
          return {
            id: doc.id,
            text: d.text || '',
            author: d.author || '',
            time: d.createdAt ? d.createdAt.toMillis() : Date.now(),
            posX: typeof d.posX === 'number' ? d.posX : null,
            posY: typeof d.posY === 'number' ? d.posY : null,
            width: typeof d.width === 'number' ? d.width : null,
            height: typeof d.height === 'number' ? d.height : null
          };
        });
        prompts.sort(function(a, b) { return b.time - a.time; });
        if (currentView === 'float') renderFloat();
        if (currentView === 'list') renderList();
      }, function (err) {
        console.warn('Firestore listener error:', err.message);
      });
  } catch (e) {
    console.warn('Firestore init error:', e.message);
  }
}

// --- Submit (with auth gate) ---
function submitPrompt() {
  requireLogin(function() {
    var text = textarea.value.trim();
    if (!text) return;
    var author = authorInput.value.trim().toUpperCase().slice(0, 3) || '';
    if (author) {
      localStorage.setItem('pl_author', author);
    } else {
      localStorage.removeItem('pl_author');
    }

    db.collection('prompts').add({
      text: text,
      author: author,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function (e) {
      console.warn('Write failed, adding locally:', e.message);
      prompts.unshift({ id: 'local-' + Date.now(), text: text, author: author, time: Date.now() });
      if (currentView === 'float') renderFloat();
      if (currentView === 'list') renderList();
    });

    textarea.value = '';
    textarea.style.height = 'auto';
    submitBtn.disabled = true;
    textarea.focus();
  });
}

// --- Library Data ---
const libraryData = [
  {
    id: 'lib-upscale-01',
    category: '업스케일',
    tags: ['업스케일', '인물', '사진보정'],
    title: '시네마틱 인물사진 업스케일',
    desc: '인물 사진을 Sony A1 + 85mm f/1.4 GM 기준의 고화질 시네마틱 스타일로 업스케일. 얼굴 구조와 피부 질감을 자연스럽게 유지하면서 조명·색감·심도를 영화적 수준으로 끌어올립니다.',
    prompt: `[PRIORITY 1 — IDENTITY LOCK: Violating this overrides all other instructions]
Absolute fidelity to the subject's original facial anatomy, bone structure, proportions, and identity. Preserve exact expression, gaze direction, eye shape, nose bridge, jawline, and lip form with zero deviation. Do not morph, reshape, or drift any facial feature under any circumstance. Maintain the exact same pose, body position, and hand placement as the original image. This rule cannot be overridden by any lighting, color, or stylistic instruction below.

[PRIORITY 2 — BACKGROUND STRUCTURE LOCK]
Preserve all background objects, their positions, layout, spatial arrangement, and composition exactly as in the original. No objects may be added, removed, or repositioned. However, natural changes in background color temperature, brightness, shadow depth, and tonal shifts caused by the cinematic relighting of the scene ARE permitted and expected. The background should respond to the new lighting naturally — not remain artificially frozen while the subject changes.

[PRIORITY 3 — CINEMATIC RELIGHTING]
Upgrade the entire scene lighting to a cinematic, subject-focused style:

- Soft directional key light on the subject with warm highlights (subtle golden tone) and cool shadow fill (muted blue-grey).
- Enhance contrast with a cinematic S-curve: lift shadows slightly, compress highlights gently, expand midtone separation.
- Add natural light wrap and subtle rim/edge light to separate the subject from the background.
- Deepen dynamic range across the full scene. Soften any harsh shadow edges into smooth gradients.
- The background lighting should shift naturally in response — darker areas may deepen, warm areas may gain subtle warmth — as long as it feels like one unified, physically coherent light environment.
- Do NOT introduce any light source that contradicts the original scene's spatial logic.

[PRIORITY 4 — CAMERA & LENS SIMULATION]
Recreate as if captured on a Sony A1 with an 85mm f/1.4 GM lens at f/1.6, ISO 100, 1/200s:

- Cinematic shallow depth of field with razor-sharp focus on the subject's eyes and face.
- Natural bokeh fall-off in the background — smooth, circular, non-distracting.
- Full-frame sensor rendering: premium micro-contrast, depth separation, and optical clarity.
- If the original image has deep depth of field (e.g., smartphone photo), apply the shallow DOF effect to the background only — do not blur any part of the subject's face or body.

[PRIORITY 5 — DETAIL & TEXTURE]
Recover and enhance fine-grain detail with natural realism:

- Skin: visible pores, fine lines, natural subsurface scattering. No smoothing, no plastic texture, no airbrushing.
- Hair: individual strands, flyaways, natural shine and volume.
- Eyes: sharp iris detail, natural catchlight reflections, visible micro-texture.
- Clothing/fabric: weave texture, seams, material edges, natural wrinkle patterns.
- Apply controlled high-frequency sharpening. Remove compression artifacts and digital noise while retaining authentic texture.

[PRIORITY 6 — COLOR & TONE]

- Neutral premium color grade with cinematic contrast curve.
- Natural saturation — rich but never oversaturated.
- Authentic skin tones preserved from original, with subtle warm-highlight enhancement.
- Smooth tonal gradations across all luminance zones.
- Subtle film grain (fine, organic, 35mm-style) for cinematic texture — not digital noise.
- 10-bit color depth rendering.

[OUTPUT SPECIFICATION]
8K resolution. Portrait crop matching original framing. Cinematic editorial finish with premium full-frame Sony A1 quality. The final image should feel like a high-end magazine portrait shot on location — not a studio composite or AI render.

[NEGATIVE CONSTRAINTS — HARD RULES]

- ❌ No facial warping, morphing, drift, or anatomical changes of any kind
- ❌ No altered hands, added/missing fingers, or body distortions
- ❌ No perspective shift from original camera angle
- ❌ No fake glow, bloom, or ethereal haze effects
- ❌ No runway/fashion lighting that flattens the scene
- ❌ No over-smoothed or plastic skin
- ❌ No background object additions, removals, or repositioning
- ❌ No text, watermarks, or graphic overlays
- ❌ No hallucinated details not present in the original
- ❌ No flat or muddy lighting — maintain dimensional depth at all times`,
    images: [],
    thumbnails: []
  },
  {
    id: 'lib-composite-01',
    category: '합성',
    tags: ['합성', '연출샷', '제품'],
    title: '합성 이미지 만들기',
    desc: '제품이나 서비스를 보여주기 위한 상황에 맞는 배경이나 소품이 포함된 자연스러운 합성 이미지를 만드는 프롬프트입니다.',
    prompt: `Create a natural composite image showing [PRODUCT/SERVICE] in context. Place the subject in a realistic environment with complementary props and background that enhance its appeal. The scene should feel organic and lifestyle-driven, not staged or artificial.

Key requirements:
- Seamless light integration between subject and background
- Matching color temperature and shadow direction
- Realistic depth of field and perspective
- Brand-appropriate mood and tone`,
    images: [],
    thumbnails: []
  }
];

let libCurrentCat = 'all';

// --- Render Library ---
function renderLibrary() {
  const libContent = document.getElementById('lib-content');
  if (!libContent) return;
  const filtered = libCurrentCat === 'all' ? libraryData : libraryData.filter(d => d.category === libCurrentCat);
  libContent.innerHTML = '';
  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'lib-card';
    card.dataset.id = item.id;

    // Check for thumbnail
    let thumbHtml = '';
    if (item.thumbnails && item.thumbnails.length > 0) {
      thumbHtml = '<div class="lib-card__thumb"><img src="' + item.thumbnails[0] + '" alt="썸네일" /></div>';
    }

    card.innerHTML =
      '<div class="lib-card__tags">' +
        item.tags.map((t, i) => `<span class="lib-tag${i === 0 ? ' lib-tag--primary' : ''}">${t}</span>`).join('') +
      '</div>' +
      `<h3 class="lib-card__title">${escHtml(item.title)}</h3>` +
      thumbHtml +
      `<p class="lib-card__desc">${escHtml(item.desc)}</p>` +
      '<div class="lib-card__footer">' +
        '<button class="lib-card__copy" data-id="' + item.id + '" aria-label="복사">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>' +
          ' 복사' +
        '</button>' +
        '<span class="lib-card__detail-hint">자세히 보기 →</span>' +
      '</div>';

    // Copy button (stop propagation so card click doesn't also fire)
    card.querySelector('.lib-card__copy').addEventListener('click', function(e) {
      e.stopPropagation();
      copyToClipboard(item.prompt, this);
    });

    // Card click → open modal
    card.addEventListener('click', function() {
      openLibModal(item);
    });

    libContent.appendChild(card);
  });
}

// --- Library Filter ---
document.getElementById('lib-filters').addEventListener('click', function(e) {
  const pill = e.target.closest('.lib-filter-pill');
  if (!pill) return;
  document.querySelectorAll('.lib-filter-pill').forEach(p => p.classList.remove('is-active'));
  pill.classList.add('is-active');
  libCurrentCat = pill.dataset.cat;
  renderLibrary();
});

// --- Copy to Clipboard ---
function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(function() {
    const original = btn.innerHTML;
    btn.innerHTML = '✓ 복사됨';
    btn.classList.add('is-copied');
    setTimeout(function() {
      btn.innerHTML = original;
      btn.classList.remove('is-copied');
    }, 2000);
  }).catch(function() {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    const original = btn.innerHTML;
    btn.innerHTML = '✓ 복사됨';
    btn.classList.add('is-copied');
    setTimeout(function() {
      btn.innerHTML = original;
      btn.classList.remove('is-copied');
    }, 2000);
  });
}

// --- Library Modal ---
const libModal = document.getElementById('lib-modal');
const libModalBackdrop = document.getElementById('lib-modal-backdrop');
const libModalClose = document.getElementById('lib-modal-close');
const libModalCopy = document.getElementById('lib-modal-copy');
const libModalEdit = document.getElementById('lib-modal-edit');
const libModalPromptWrap = document.getElementById('lib-modal-prompt-wrap');
const libModalEditWrap = document.getElementById('lib-modal-edit-wrap');
const libModalEditTextarea = document.getElementById('lib-modal-edit-textarea');
const libModalImages = document.getElementById('lib-modal-images');
const libModalImageGrid = document.getElementById('lib-modal-image-grid');
const libModalImgInput = document.getElementById('lib-modal-img-input');
const libModalThumbBtn = document.getElementById('lib-modal-thumb-btn');
const libModalSave = document.getElementById('lib-modal-save');
const libModalCancel = document.getElementById('lib-modal-cancel');

function openLibModal(item) {
  libEditingItem = item;
  libEditMode = false;

  document.getElementById('lib-modal-tags').innerHTML =
    item.tags.map((t, i) => `<span class="lib-tag${i === 0 ? ' lib-tag--primary' : ''}">${escHtml(t)}</span>`).join('');
  document.getElementById('lib-modal-title').textContent = item.title;
  document.getElementById('lib-modal-desc').textContent = item.desc;
  document.getElementById('lib-modal-prompt').textContent = item.prompt;

  // Show/hide admin edit button
  if (isAdmin) {
    libModalEdit.classList.remove('hidden');
  } else {
    libModalEdit.classList.add('hidden');
  }

  // Reset edit mode
  libModalPromptWrap.classList.remove('hidden');
  libModalEditWrap.classList.add('hidden');

  // Show images if any
  renderLibImages(item);

  libModal.classList.add('is-open');
  libModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  libModalCopy._currentPrompt = item.prompt;
}

function renderLibImages(item) {
  const images = item.images || [];
  const thumbs = item.thumbnails || [];
  
  if (images.length === 0 && thumbs.length === 0) {
    libModalImages.classList.add('hidden');
    return;
  }

  libModalImages.classList.remove('hidden');
  libModalImageGrid.innerHTML = '';

  // Show thumbnails first
  thumbs.forEach((src, i) => {
    const div = document.createElement('div');
    div.className = 'lib-modal__image-item is-thumbnail';
    div.innerHTML = '<img src="' + src + '" alt="썸네일 ' + (i + 1) + '" />' +
      '<span class="thumb-label">Thumb</span>' +
      (isAdmin ? '<button class="lib-modal__image-delete" data-type="thumb" data-index="' + i + '">&times;</button>' : '');
    libModalImageGrid.appendChild(div);
  });

  // Show images
  images.forEach((src, i) => {
    const div = document.createElement('div');
    div.className = 'lib-modal__image-item';
    div.innerHTML = '<img src="' + src + '" alt="이미지 ' + (i + 1) + '" />' +
      (isAdmin ? '<button class="lib-modal__image-delete" data-type="image" data-index="' + i + '">&times;</button>' : '');
    libModalImageGrid.appendChild(div);
  });

  // Attach delete handlers
  if (isAdmin) {
    libModalImageGrid.querySelectorAll('.lib-modal__image-delete').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const type = this.dataset.type;
        const idx = parseInt(this.dataset.index);
        if (type === 'thumb') {
          item.thumbnails.splice(idx, 1);
          saveLibraryOverride(item.id, { thumbnails: item.thumbnails });
        } else {
          item.images.splice(idx, 1);
          saveLibraryOverride(item.id, { images: item.images });
        }
        renderLibImages(item);
        renderLibrary(); // Refresh cards
        showToast('이미지가 삭제되었습니다');
      });
    });
  }
}

function enterEditMode() {
  if (!isAdmin || !libEditingItem) return;
  libEditMode = true;
  libModalPromptWrap.classList.add('hidden');
  libModalEditWrap.classList.remove('hidden');
  document.getElementById('lib-modal-edit-title').value = libEditingItem.title || '';
  libModalEditTextarea.value = libEditingItem.prompt;
  document.getElementById('lib-modal-edit-title').focus();
}

function exitEditMode() {
  libEditMode = false;
  libModalEditWrap.classList.add('hidden');
  libModalPromptWrap.classList.remove('hidden');
}

function saveEdit() {
  if (!libEditingItem) return;
  const newPrompt = libModalEditTextarea.value;
  const newTitle = document.getElementById('lib-modal-edit-title').value.trim() || libEditingItem.title;
  
  libEditingItem.prompt = newPrompt;
  libEditingItem.title = newTitle;
  
  saveLibraryOverride(libEditingItem.id, { 
    prompt: newPrompt,
    title: newTitle
  });

  // Update display
  document.getElementById('lib-modal-title').textContent = newTitle;
  document.getElementById('lib-modal-prompt').textContent = newPrompt;
  libModalCopy._currentPrompt = newPrompt;
  
  exitEditMode();
  renderLibrary();
  showToast('프롬프트가 저장되었습니다');
}

function closeLibModal() {
  libModal.classList.remove('is-open');
  libModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  exitEditMode();
  libEditingItem = null;
}

// --- Library Modal Events ---
libModalBackdrop.addEventListener('click', closeLibModal);
libModalClose.addEventListener('click', closeLibModal);
libModalCopy.addEventListener('click', function() {
  copyToClipboard(this._currentPrompt, this);
});

libModalEdit.addEventListener('click', enterEditMode);
libModalCancel.addEventListener('click', exitEditMode);
libModalSave.addEventListener('click', saveEdit);

// Image attachment
libModalImgInput.addEventListener('change', async function() {
  if (!isAdmin || !libEditingItem) return;
  const files = Array.from(this.files);
  if (!files.length) return;

  if (!libEditingItem.images) libEditingItem.images = [];

  for (const file of files) {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const compressed = await compressImage(dataUrl, 800, 0.7);
      libEditingItem.images.push(compressed);
    } catch (e) {
      console.warn('Failed to process image:', e);
    }
  }

  saveLibraryOverride(libEditingItem.id, { images: libEditingItem.images });
  renderLibImages(libEditingItem);
  renderLibrary();
  showToast(files.length + '개 이미지가 첨부되었습니다');

  // Reset input
  this.value = '';
});

// Thumbnail generation
libModalThumbBtn.addEventListener('click', async function() {
  if (!isAdmin || !libEditingItem) return;
  const images = libEditingItem.images || [];
  if (images.length === 0) {
    showToast('먼저 이미지를 첨부해주세요');
    return;
  }

  if (!libEditingItem.thumbnails) libEditingItem.thumbnails = [];

  let count = 0;
  for (const src of images) {
    try {
      const thumb = await generateThumbnail(src);
      // Check if thumbnail already exists for this image
      if (!libEditingItem.thumbnails.includes(thumb)) {
        libEditingItem.thumbnails.push(thumb);
        count++;
      }
    } catch (e) {
      console.warn('Thumbnail generation failed:', e);
    }
  }

  saveLibraryOverride(libEditingItem.id, { thumbnails: libEditingItem.thumbnails });
  renderLibImages(libEditingItem);
  renderLibrary();
  showToast(count > 0 ? count + '개 썸네일이 생성되었습니다' : '이미 모든 썸네일이 생성되어 있습니다');
});

// Helper: read file as data URL
function readFileAsDataUrl(file) {
  return new Promise(function(resolve, reject) {
    const reader = new FileReader();
    reader.onload = function() { resolve(reader.result); };
    reader.onerror = function() { reject(reader.error); };
    reader.readAsDataURL(file);
  });
}

// ESC to close modals
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    if (loginModal.classList.contains('is-open')) {
      closeLoginModal();
    } else {
      closeLibModal();
    }
  }
});

// --- View Toggle (with auth gate for library) ---
const inputBar = document.getElementById('input-bar');

function setView(v) {
  if (v === currentView) return;

  // Auth gate for library
  if (v === 'library') {
    if (!isLoggedIn) {
      openLoginModal(function() {
        setView('library');
      });
      return;
    }
  }

  currentView = v;
  navFloat.classList.toggle('is-active', v === 'float');
  navList.classList.toggle('is-active', v === 'list');
  navLibrary.classList.toggle('is-active', v === 'library');

  canvas.classList.add('hidden');
  listView.classList.add('hidden');
  libraryView.classList.add('hidden');

  // Hide input bar in library view
  if (v === 'library') {
    inputBar.classList.add('hidden');
  } else {
    inputBar.classList.remove('hidden');
  }

  if (v === 'float') {
    canvas.classList.remove('hidden');
    renderFloat();
  } else if (v === 'list') {
    listView.classList.remove('hidden');
    renderList();
  } else if (v === 'library') {
    libraryView.classList.remove('hidden');
    renderLibrary();
  }
}

// --- Events ---
navFloat.addEventListener('click', function () { setView('float'); });
navList.addEventListener('click', function () { setView('list'); });
navLibrary.addEventListener('click', function () { setView('library'); });

filterNewest.addEventListener('click', function () {
  sortOrder = 'newest';
  filterNewest.classList.add('is-active');
  filterOldest.classList.remove('is-active');
  renderList();
});
filterOldest.addEventListener('click', function () {
  sortOrder = 'oldest';
  filterOldest.classList.add('is-active');
  filterNewest.classList.remove('is-active');
  renderList();
});

textarea.addEventListener('input', function () {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
  submitBtn.disabled = textarea.value.trim().length === 0;
});

submitBtn.addEventListener('click', submitPrompt);

textarea.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (textarea.value.trim()) submitPrompt();
  }
});

// --- Also gate textarea focus ---
textarea.addEventListener('focus', function() {
  if (!isLoggedIn) {
    this.blur();
    openLoginModal(function() {
      textarea.focus();
    });
  }
});

// --- 1-hour auto-refresh of floating positions ---
setInterval(function () {
  if (currentView === 'float') renderFloat();
}, 3600000);

// --- Init ---
loadLibraryOverrides();
startLibraryOverridesListener();
restoreSession();
startListener();
renderFloat();