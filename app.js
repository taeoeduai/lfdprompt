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

// Deselect bubbles when clicking canvas background
canvas.addEventListener('pointerdown', function(e) {
  if (!e.target.closest('.bubble-wrapper')) {
    document.querySelectorAll('.bubble-wrapper.is-selected').forEach(function(b) {
      b.classList.remove('is-selected');
      b.classList.remove('show-delete');
      // If editing, blur it to auto-save
      const textEl = b.querySelector('.bubble__text');
      if (textEl && textEl.getAttribute('contenteditable') === 'true') {
        textEl.blur();
      }
    });
  }
});
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
let currentView = '';
let sortOrder = 'newest';
let unauthorizedClicksCount = 0;

// ============================================
// AUTH SYSTEM
// ============================================
const AUTH_CREDENTIALS = {
  admin: { password: '3913', role: 'admin' },
  guest: { password: '2026', role: 'guest' }
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
  const greetingEl = document.getElementById('nav-auth-greeting');
  if (isLoggedIn) {
    navLoginBtn.classList.add('hidden');
    navUserInfo.classList.remove('hidden');
    navUserBadge.textContent = currentUser.id.toUpperCase();
    if (greetingEl) {
      greetingEl.innerHTML = `${currentUser.id.toUpperCase()}님<br>환영합니다.`;
    }
    document.querySelectorAll('.is-blurred').forEach(el => el.classList.remove('is-blurred'));
  } else {
    navLoginBtn.classList.remove('hidden');
    navUserInfo.classList.add('hidden');
    navUserBadge.textContent = '';
    if (greetingEl) {
      greetingEl.innerHTML = '로그인을 해주세요!';
    }
  }
  
  // Show/Hide 새 프롬프트 추가 button based on admin status
  const addBtn = document.getElementById('lib-add-btn');
  if (addBtn) {
    if (isAdmin) {
      addBtn.classList.remove('hidden');
    } else {
      addBtn.classList.add('hidden');
    }
  }

  // Show/Hide admin cleanup buttons
  const cleanupDash = document.getElementById('admin-cleanup-btn-dash');
  const cleanupList = document.getElementById('admin-cleanup-btn-list');
  if (cleanupDash) {
    if (isAdmin) cleanupDash.classList.remove('hidden');
    else cleanupDash.classList.add('hidden');
  }
  if (cleanupList) {
    if (isAdmin) cleanupList.classList.remove('hidden');
    else cleanupList.classList.add('hidden');
  }

  // Toggle admin class on body for global admin styles (e.g. always show delete buttons)
  if (isAdmin) {
    document.body.classList.add('is-admin');
  } else {
    document.body.classList.remove('is-admin');
  }

  // Show/Hide MY filter button based on user status (hidden for admin or guest)
  const filterMy = document.getElementById('filter-my');
  if (filterMy) {
    if (isLoggedIn && !isAdmin && currentUser.role !== 'guest') {
      filterMy.style.display = 'inline-block';
    } else {
      filterMy.style.display = 'none';
      if (sortOrder === 'my') {
        sortOrder = 'newest';
        const filterNewest = document.getElementById('filter-newest');
        if (filterNewest) filterNewest.classList.add('is-active');
        filterMy.classList.remove('is-active');
      }
    }
  }
}

function applyLoginState() {
  if (isLoggedIn && currentUser) {
    // Auto-fill initials (not for admin)
    if (currentUser.role === 'admin') {
      // Admin uses "ADMIN" label
      authorInput.value = 'AD';
      authorInput.readOnly = true;
      authorInput.style.opacity = '0.7';
      localStorage.setItem('pl_author', 'AD');
    } else if (currentUser.role === 'guest') {
      authorInput.value = 'GST';
      authorInput.readOnly = true;
      authorInput.style.opacity = '0.7';
      localStorage.setItem('pl_author', 'GST');
    } else {
      authorInput.value = currentUser.id.toUpperCase();
      authorInput.readOnly = true;
      authorInput.style.opacity = '0.7';
      localStorage.setItem('pl_author', currentUser.id.toUpperCase());
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

  // Check guest
  if (id.toLowerCase() === 'guest' || id.toLowerCase() === '게스트') {
    if (pw === AUTH_CREDENTIALS.guest.password) {
      loginSuccess({ id: 'guest', role: 'guest' });
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
  if (typeof window.closeMobileMenu === 'function') window.closeMobileMenu();
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
  if (typeof window.closeMobileMenu === 'function') window.closeMobileMenu();
  openLoginModal();
});

navUserBadge.addEventListener('click', function(e) {
  if (window.innerWidth > 768) {
    e.stopPropagation();
    navLogoutBtn.classList.toggle('show');
  }
});

document.addEventListener('click', function(e) {
  if (window.innerWidth > 768 && !navUserInfo.contains(e.target)) {
    navLogoutBtn.classList.remove('show');
  }
});

navLogoutBtn.addEventListener('click', function() {
  navLogoutBtn.classList.remove('show');
  logout();
});

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
      Object.keys(overrides).forEach(itemId => {
        const data = overrides[itemId];
        if (data.isDeleted) {
          const index = libraryData.findIndex(d => d.id === itemId);
          if (index > -1) {
            libraryData.splice(index, 1);
          }
          return;
        }
        
        let item = libraryData.find(d => d.id === itemId);
        if (!item) {
          // Push custom item from local storage cache
          item = {
            id: itemId,
            category: data.category || '업스케일',
            tags: data.tags || [data.category || '업스케일'],
            title: data.title || '',
            desc: data.desc || '',
            prompt: data.prompt || '',
            promptKo: data.promptKo || '',
            promptEn: data.promptEn || '',
            images: data.images || [],
            thumbnails: data.thumbnails || [],
            originalImages: data.originalImages || [],
            isReferenceType: data.isReferenceType !== undefined ? data.isReferenceType : (data.images && data.images.length === 3)
          };
          libraryData.push(item);
        } else {
          // Override existing items
          if (data.category !== undefined) {
            item.category = data.category;
          }
          if (data.tags !== undefined) {
            item.tags = data.tags;
          } else if (data.category !== undefined) {
            item.tags = [data.category];
          }
          if (data.desc !== undefined) item.desc = data.desc;
          if (data.title !== undefined) item.title = data.title;
          if (data.prompt !== undefined) item.prompt = data.prompt;
          if (data.promptKo !== undefined) item.promptKo = data.promptKo;
          if (data.promptEn !== undefined) item.promptEn = data.promptEn;
          if (data.images !== undefined) item.images = data.images;
          if (data.thumbnails !== undefined) item.thumbnails = data.thumbnails;
          if (data.originalImages !== undefined) item.originalImages = data.originalImages;
          if (data.isReferenceType !== undefined) item.isReferenceType = data.isReferenceType;
          else if (data.images && data.images.length === 3) item.isReferenceType = true;
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
      
      // If marked as deleted, permanently filter it out from the local library array
      if (data.isDeleted) {
        const index = libraryData.findIndex(d => d.id === itemId);
        if (index > -1) {
          libraryData.splice(index, 1);
        }
        return;
      }
      
      let item = libraryData.find(d => d.id === itemId);
      if (!item) {
        // It's a new item added by the admin!
        item = {
          id: itemId,
          category: data.category || '업스케일',
          tags: data.tags || [data.category || '업스케일'],
          title: data.title || '',
          desc: data.desc || '',
          prompt: data.prompt || '',
          promptKo: data.promptKo || '',
          promptEn: data.promptEn || '',
          images: data.images || [],
          thumbnails: data.thumbnails || [],
          originalImages: data.originalImages || [],
          isReferenceType: data.isReferenceType !== undefined ? data.isReferenceType : (data.images && data.images.length === 3)
        };
        libraryData.push(item);
      } else {
        if (data.category !== undefined) {
          item.category = data.category;
        }
        if (data.tags !== undefined) {
          item.tags = data.tags;
        } else if (data.category !== undefined) {
          item.tags = [data.category];
        }
        if (data.desc !== undefined) item.desc = data.desc;
        if (data.title !== undefined) item.title = data.title;
        if (data.prompt !== undefined) item.prompt = data.prompt;
        if (data.promptKo !== undefined) item.promptKo = data.promptKo;
        if (data.promptEn !== undefined) item.promptEn = data.promptEn;
        if (data.images !== undefined) item.images = data.images;
        if (data.thumbnails !== undefined) item.thumbnails = data.thumbnails;
        if (data.originalImages !== undefined) item.originalImages = data.originalImages;
        if (data.isReferenceType !== undefined) item.isReferenceType = data.isReferenceType;
        else if (data.images && data.images.length === 3) item.isReferenceType = true;
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

// Compress image for localStorage storage and crop to a perfect 4:3 ratio
function compressImage(dataUrl, maxWidth, quality) {
  return new Promise(function(resolve) {
    const img = new Image();
    img.onload = function() {
      const cvs = document.createElement('canvas');
      const targetRatio = 4 / 3;
      let w = img.width;
      let h = img.height;
      
      // Calculate crop coordinates
      let sx = 0, sy = 0, sw = w, sh = h;
      if (w / h > targetRatio) {
        sw = h * targetRatio;
        sx = (w - sw) / 2;
      } else {
        sh = w / targetRatio;
        sy = (h - sh) / 2;
      }
      
      // Scale destination size
      let dw = sw;
      let dh = sh;
      if (dw > maxWidth) {
        dw = maxWidth;
        dh = maxWidth / targetRatio;
      }
      
      cvs.width = dw;
      cvs.height = dh;
      const ctx = cvs.getContext('2d');
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
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
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
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
  const textEl = el.querySelector('.bubble__text');

  textEl.addEventListener('blur', function() {
    if (textEl.getAttribute('contenteditable') === 'true') {
      textEl.removeAttribute('contenteditable');
      el.classList.remove('is-editable');
      
      const newText = textEl.textContent.trim();
      if (newText && newText !== p.text) {
        if (!p.id.startsWith('local-')) {
          db.collection('prompts').doc(p.id).update({ text: newText }).catch(function(err) { console.warn(err); });
        } else {
          p.text = newText;
        }
      } else if (!newText) {
        textEl.textContent = p.text; // revert if empty
      }
    }
  });
  
  let isDragging = false;
  let startX, startY, initialLeft, initialTop;
  let longPressTimer;

  el.querySelector('.delete-btn').addEventListener('click', function (e) {
    e.stopPropagation();
    // Auth gate for delete
    requireLogin(function() {
      deletePrompt(p.id, el);
    });
  });

  // Double click for desktop website version to edit
  el.addEventListener('dblclick', function (e) {
    if (e.target.closest('.delete-btn')) return;
    if (textEl.getAttribute('contenteditable') === 'true') return;

    const currentAuthor = localStorage.getItem('pl_author') || '';
    const canEdit = isLoggedIn && (isAdmin || (p.author === currentAuthor && currentAuthor !== ''));
    if (canEdit) {
      el.classList.add('is-editable');
      textEl.setAttribute('contenteditable', 'true');
      textEl.focus();

      // Move cursor to the very end of text
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(textEl);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  });

  el.addEventListener('pointerdown', function (e) {
    if (e.target.closest('.delete-btn')) return;
    
    // Prevent dragging if currently editing
    const targetTextEl = e.target.closest('.bubble__text');
    if (targetTextEl && targetTextEl.getAttribute('contenteditable') === 'true') {
      return; 
    }
    if (e.pointerType === 'mouse' && targetTextEl) return;
    
    // Deselect others and select current
    document.querySelectorAll('.bubble-wrapper.is-selected').forEach(function(b) {
      if (b !== el) {
        b.classList.remove('is-selected');
        b.classList.remove('show-delete');
      }
    });
    el.classList.add('is-selected');

    // If not logged in, block dragging, resizing, and mobile long-press triggers.
    if (!isLoggedIn) {
      return;
    }

    // Long press for mobile edit & delete button
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      longPressTimer = setTimeout(function() {
        el.classList.add('show-delete');
        
        const currentAuthor = localStorage.getItem('pl_author') || '';
        const canEdit = isLoggedIn && (isAdmin || (p.author === currentAuthor && currentAuthor !== ''));
        if (canEdit) {
          el.classList.add('is-editable');
          textEl.setAttribute('contenteditable', 'true');
          textEl.focus();
        }

        if (navigator.vibrate) navigator.vibrate([50, 50, 50]); // Distinct haptic pattern
      }, 1000); // 1.0 second
    }

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
    if (longPressTimer && (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10)) {
      clearTimeout(longPressTimer);
    }
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
    clearTimeout(longPressTimer);
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
    clearTimeout(longPressTimer);
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
    let ew = p.width;
    if (!ew) {
      if (r.width <= 768) ew = Math.min(220, 40 + p.text.length * 15);
      else ew = Math.min(350 + p.text.length * 6, 800);
    }
    
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
  
  let sorted = [...prompts];
  if (sortOrder === 'my') {
    const currentAuthor = localStorage.getItem('pl_author') || '';
    sorted = sorted.filter(p => p.author === currentAuthor && currentAuthor !== '');
  }
  
  sorted.sort((a, b) => sortOrder === 'oldest' ? a.time - b.time : b.time - a.time);
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
    
    const textEl = item.querySelector('.list-item__text');
    
    // Blur handler to automatically save when clicking outside or focus shifts
    textEl.addEventListener('blur', function() {
      if (textEl.getAttribute('contenteditable') === 'true') {
        textEl.removeAttribute('contenteditable');
        item.classList.remove('is-editable');
        
        const newText = textEl.textContent.trim();
        if (newText && newText !== p.text) {
          if (!p.id.startsWith('local-')) {
            db.collection('prompts').doc(p.id).update({ text: newText })
              .then(() => showToast('수정되었습니다'))
              .catch(function(err) { console.warn(err); });
          } else {
            p.text = newText;
            showToast('수정되었습니다');
          }
        } else if (!newText) {
          textEl.textContent = p.text; // revert if empty
        }
      }
    });

    // Save on Enter key press
    textEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        textEl.blur();
      }
    });

    let longPressTimer;
    let startX, startY;

    // Pointer events for cross-platform long press detection (mouse/touch/pen)
    item.addEventListener('pointerdown', function(e) {
      // Prevent double trigger if clicking internal elements like delete button or already editing
      if (e.target.closest('.delete-btn')) return;
      if (textEl.getAttribute('contenteditable') === 'true') return;

      startX = e.clientX;
      startY = e.clientY;

      longPressTimer = setTimeout(function() {
        const currentAuthor = localStorage.getItem('pl_author') || '';
        const canEdit = isLoggedIn && (isAdmin || (p.author === currentAuthor && currentAuthor !== ''));
        if (canEdit) {
          if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
          
          item.classList.add('is-editable');
          textEl.setAttribute('contenteditable', 'true');
          textEl.focus();

          // Move cursor to the very end of text
          const range = document.createRange();
          const sel = window.getSelection();
          range.selectNodeContents(textEl);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }, 1000); // 1.0 second
    });

    item.addEventListener('pointermove', function(e) {
      // If pointer moves significantly, cancel the long press detection (e.g. scroll or drag)
      if (longPressTimer && (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10)) {
        clearTimeout(longPressTimer);
      }
    });

    item.addEventListener('pointerup', function() {
      clearTimeout(longPressTimer);
    });

    item.addEventListener('pointercancel', function() {
      clearTimeout(longPressTimer);
    });

    // Double click for desktop website version to edit list item
    item.addEventListener('dblclick', function(e) {
      if (e.target.closest('.delete-btn')) return;
      if (textEl.getAttribute('contenteditable') === 'true') return;

      const currentAuthor = localStorage.getItem('pl_author') || '';
      const canEdit = isLoggedIn && (isAdmin || (p.author === currentAuthor && currentAuthor !== ''));
      if (canEdit) {
        item.classList.add('is-editable');
        textEl.setAttribute('contenteditable', 'true');
        textEl.focus();

        // Move cursor to the very end of text
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(textEl);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });

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
    promptKo: `[우선순위 1 — 신원 고정: 다른 모든 지침보다 우선함]
대상의 원래 얼굴 해부학적 구조, 골격, 비율 및 고유 신원을 절대적으로 유지합니다. 미세한 표정, 시선 방향, 눈 모양, 콧대, 턱선, 입술 형태를 편차 없이 완벽하게 보존하세요. 어떤 상황에서도 얼굴 특징을 왜곡하거나 변형하지 마십시오. 원본 이미지와 똑같은 포즈, 몸의 위치, 손의 배치를 유지합니다. 이 규칙은 아래의 조명, 색상 또는 스타일 관련 지침에 의해 무시될 수 없습니다.

[우선순위 2 — 배경 구조 고정]
원본과 동일하게 배경의 모든 물체, 위치, 레이아웃, 공간 배열 및 구도를 보존합니다. 어떠한 오브젝트도 추가, 삭제 또는 재배치할 수 없습니다. 단, 씬(Scene)의 영화적인 리라이팅(Relighting)으로 인한 배경 색온도, 밝기, 그림자 깊이 및 톤 변화는 허용되며 적극 반영되어야 합니다. 배경은 새로운 조명 환경에 자연스럽게 반응해야 합니다.

[우선순위 3 — 시네마틱 리라이팅(Cinematic Relighting)]
전체 장면의 조명을 시네마틱하고 피사체 중심의 스타일로 업그레이드합니다:

- 피사체에 부드러운 방향성 키 라이트(따뜻한 골드 톤)와 쿨한 섀도우 필(차분한 블루-그레이)을 적용합니다.
- 시네마틱 S-곡선으로 대비를 강화합니다: 어두운 영역은 살짝 올리고, 하이라이트는 부드럽게 압축하며, 미디움 톤의 분리도를 확장합니다.
- 자연스러운 라이트 랩(Light Wrap)과 미세한 림 라이트(Rim/Edge Light)를 추가하여 피사체를 배경과 분리합니다.
- 장면 전체의 다이내믹 레인지를 깊게 표현합니다. 거친 그림자 경계면을 부드러운 그라데이션으로 완화합니다.
- 일관된 조명 환경을 위해 배경 조명도 자연스럽게 변화해야 합니다.

[우선순위 4 — 카메라 & 렌즈 시뮬레이션]
Sony A1 카메라와 85mm f/1.4 GM 렌즈를 사용하여 f/1.6, ISO 100, 1/200초로 촬영한 듯한 퀄리티로 재현합니다:

- 피사체의 눈과 얼굴에 칼날 같은 초점이 맞추어진 시네마틱하고 얕은 심도(Shallow Depth of Field)를 구현합니다.
- 배경에는 자연스럽고 부드러우며 원형의 보케(Bokeh)가 흐려지도록 처리합니다.
- 풀프레임 센서 렌더링: 미세한 대비, 깊이 분리 및 광학적 선명함을 표현합니다.

[우선순위 5 — 디테일 & 텍스처]
자연스러운 리얼리즘과 함께 미세한 그레인 디테일을 복원하고 강화합니다:

- 피부: 모공, 미세한 주름, 피부 밑 산란(Subsurface Scattering)이 시각적으로 보이도록 합니다. 뭉개거나 플라스틱처럼 밀어버리는 스무딩, 에어브러시 작업 금지.
- 머리카락: 한 올 한 올의 디테일, 잔머리, 자연스러운 광택과 볼륨감 유지.
- 눈: 선명한 홍채 디테일, 자연스러운 캐치라이트 반사, 눈동자 미세 텍스처.
- 의류/원단: 섬유 조직의 직조 텍스처, 솔기, 자연스러운 주름 패턴 유지.

[우선순위 6 — 컬러 & 톤]

- 시네마틱 대비 곡선이 적용된 뉴트럴한 프리미엄 컬러 그레이딩.
- 자연스러운 채도 유지 — 풍부하지만 절대 과포화되지 않도록 처리.
- 10비트 컬러 깊이 렌더링.

[출력 사양]
8K 해상도. 원본 구도와 일치하는 포트레이트 크롭. 프리미엄 풀프레임 소니 A1 수준의 시네마틱 에디토리얼 피니시. 완성된 이미지는 AI 생성물 느낌이 아닌 야외에서 촬영된 하이엔드 잡지 화보 포트레이트 느낌이 나야 합니다.

[네거티브 제약 — 강력한 금지 규칙]

- ❌ 얼굴 왜곡, 모핑, 변형 또는 해부학적 변경 절대 금지
- ❌ 기형적인 손, 손가락 추가/누락 또는 신체 왜곡 절대 금지
- ❌ 원본 카메라 앵글로부터의 시점/원근 왜곡 금지
- ❌ 인위적인 글로우, 블룸 또는 몽환적인 헤이즈 효과 금지
- ❌ 피사체를 평평하게 만드는 단순 패션 뷰티 조명 금지
- ❌ 질감이 없이 인형처럼 매끄러운 스킨 텍스처 금지
- ❌ 배경 오브젝트의 추가, 제거 또는 재배치 절대 금지`,
    promptEn: `[PRIORITY 1 — IDENTITY LOCK: Violating this overrides all other instructions]
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
  }
];


let libCurrentCat = 'all';

// --- Render Library ---
let libLayoutMode = 'gallery'; // 'gallery' or 'list'
let globalSearchQuery = '';

// --- Render Library ---
function renderLibrary() {
  const libContent = document.getElementById('lib-content');
  if (!libContent) return;

  let sortedData = [...libraryData].sort((a, b) => {
    const isCustomA = String(a.id).startsWith('lib-custom-');
    const isCustomB = String(b.id).startsWith('lib-custom-');
    if (isCustomA && !isCustomB) return -1;
    if (!isCustomA && isCustomB) return 1;
    if (isCustomA && isCustomB) {
      // Sort newest custom first (custom-timestamp)
      const tsA = parseInt(String(a.id).replace('lib-custom-', '')) || 0;
      const tsB = parseInt(String(b.id).replace('lib-custom-', '')) || 0;
      return tsB - tsA;
    }
    return 0; // maintain original for default static
  });

  // Permanently filter out the card titled '제품 연출컷 9장(식품)'
  sortedData = sortedData.filter(item => item.title !== '제품 연출컷 9장(식품)');

  // Dynamically update filter pills based on all unique tags/categories
  const filterContainer = document.getElementById('lib-filters');
  if (filterContainer) {
    const addBtn = filterContainer.querySelector('#lib-add-btn');
    
    const uniqueTags = new Set();
    sortedData.forEach(d => {
      if (d.tags && d.tags.length > 0) {
        d.tags.forEach(t => uniqueTags.add(t));
      } else if (d.category) {
        uniqueTags.add(d.category);
      }
    });
    
    const tagArray = Array.from(uniqueTags);
    let html = `<button class="lib-filter-pill ${libCurrentCat === 'all' ? 'is-active' : ''}" data-cat="all">전체 <span class="lib-count">${sortedData.length}</span></button>`;
    
    tagArray.forEach(cat => {
      const count = sortedData.filter(d => (d.tags && d.tags.includes(cat)) || d.category === cat).length;
      html += `<button class="lib-filter-pill ${libCurrentCat === cat ? 'is-active' : ''}" data-cat="${escHtml(cat)}">${escHtml(cat)} <span class="lib-count">${count}</span></button>`;
    });
    
    filterContainer.innerHTML = html;
    if (addBtn) {
      filterContainer.appendChild(addBtn);
      // Ensure the add button has its event listener if it was overwritten
      addBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (!isAdmin) return;
        const typeModal = document.getElementById('lib-type-modal');
        if (typeModal) {
          typeModal.classList.remove('hidden');
          typeModal.setAttribute('aria-hidden', 'false');
        }
      });
    }
  }

  // 2. Filter by Category
  let filtered = libCurrentCat === 'all' 
    ? sortedData 
    : sortedData.filter(d => (d.tags && d.tags.includes(libCurrentCat)) || d.category === libCurrentCat);

  // 3. Filter by Search Query (Title, description, tags, prompt)
  if (globalSearchQuery.trim() !== '') {
    const q = globalSearchQuery.toLowerCase();
    filtered = filtered.filter(item => {
      return (item.title || '').toLowerCase().includes(q) ||
             (item.desc || '').toLowerCase().includes(q) ||
             (item.tags || []).some(t => String(t).toLowerCase().includes(q)) ||
             (item.prompt || '').toLowerCase().includes(q) ||
             (item.promptKo || '').toLowerCase().includes(q) ||
             (item.promptEn || '').toLowerCase().includes(q);
    });
  }

  libContent.innerHTML = '';

  // Apply layout styling
  if (libLayoutMode === 'list') {
    libContent.style.display = 'flex';
    libContent.style.flexDirection = 'column';
    libContent.style.gap = '12px';
  } else {
    libContent.style.display = 'grid';
    libContent.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
    libContent.style.gap = 'var(--sp-md)';
  }

  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'lib-card' + (libLayoutMode === 'list' ? ' is-list' : '');
    card.dataset.id = item.id;

    let thumbHtml = '';
    // If it's a Reference type with 3 images, use images[0] and images[2] for Before/After slider
    if (item.images && item.images.length === 3 && item.isReferenceType) {
      thumbHtml = `
        <div class="lib-card__thumb slider-container ${!isLoggedIn ? 'is-blurred' : ''}" onmousemove="handleSliderMove(event, this)" ontouchmove="handleSliderMove(event, this)">
          <img src="${item.images[2]}" alt="After" class="slider-after" />
          <div class="slider-before-wrapper" style="clip-path: inset(0 50% 0 0); -webkit-clip-path: inset(0 50% 0 0);">
            <img src="${item.images[0]}" alt="Before" class="slider-before" />
          </div>
          <div class="slider-handle" style="left: 50%;"></div>
        </div>
      `;
    } 
    // If exactly 2 images are uploaded (normal before/after), use them for slider
    else if (item.images && item.images.length === 2 && !item.isReferenceType) {
      thumbHtml = `
        <div class="lib-card__thumb slider-container ${!isLoggedIn ? 'is-blurred' : ''}" onmousemove="handleSliderMove(event, this)" ontouchmove="handleSliderMove(event, this)">
          <img src="${item.images[1]}" alt="After" class="slider-after" />
          <div class="slider-before-wrapper" style="clip-path: inset(0 50% 0 0); -webkit-clip-path: inset(0 50% 0 0);">
            <img src="${item.images[0]}" alt="Before" class="slider-before" />
          </div>
          <div class="slider-handle" style="left: 50%;"></div>
        </div>
      `;
    } else if (item.thumbnails && item.thumbnails.length > 0) {
      thumbHtml = `<div class="lib-card__thumb ${!isLoggedIn ? 'is-blurred' : ''}"><img src="${item.thumbnails[0]}" alt="썸네일" /></div>`;
    } else if (item.images && item.images.length > 0) {
      thumbHtml = `<div class="lib-card__thumb ${!isLoggedIn ? 'is-blurred' : ''}"><img src="${item.images[0]}" alt="썸네일" /></div>`;
    } else {
      thumbHtml = `
        <div class="lib-card__thumb lib-card__thumb--placeholder ${!isLoggedIn ? 'is-blurred' : ''}">
          <div class="placeholder-content">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3; margin-bottom: 8px;">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <span style="font-size: 11px; opacity: 0.35; font-weight: 500; letter-spacing: 0.5px;">NO IMAGE</span>
          </div>
        </div>
      `;
    }

    const descStr = typeof item.desc === 'string' ? item.desc : (item.desc && typeof item.desc.toString === 'function' ? item.desc.toString() : '');
    const displayDesc = descStr.trim() !== '' 
      ? descStr 
      : '바로 복사해서 실전에 적용할 수 있는 고품질 AI 이미지 프롬프트입니다.';

    if (libLayoutMode === 'list') {
      // Modern List View Layout
      card.style.flexDirection = 'row';
      card.style.alignItems = 'center';
      card.style.gap = '16px';
      card.style.padding = '12px var(--sp-md)';
      
      card.innerHTML = `
        ${thumbHtml ? `<div class="${!isLoggedIn ? 'is-blurred' : ''}" style="width: 80px; flex-shrink: 0;">${thumbHtml.replace('class="lib-card__thumb', 'style="margin-bottom: 0;" class="lib-card__thumb')}</div>` : '<div style="width: 80px; height: 60px; background: rgba(0,0,0,0.04); border-radius: var(--r-sm); flex-shrink:0;"></div>'}
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px;">
          <h3 class="lib-card__title" style="margin: 0; font-size: 15px;">${escHtml(item.title)}</h3>
          <p class="lib-card__desc" style="margin: 0; font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.65;">${escHtml(displayDesc)}</p>
        </div>
        <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-right: 12px; max-width: 200px;" class="list-hide-mobile">
          ${(item.tags || []).slice(0, 2).map(t => `<span class="lib-tag" style="font-size: 10px; padding: 2px 6px;">${escHtml(t)}</span>`).join('')}
        </div>
        <div style="display: flex; align-items: center; gap: var(--sp-sm); flex-shrink: 0;">
          <button class="lib-card__copy" data-id="${item.id}" aria-label="복사" style="padding: 4px 10px; font-size: 11px;">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> 복사
          </button>
        </div>
      `;
    } else {
      // Modern Grid Gallery Layout
      card.style.flexDirection = 'column';
      card.style.alignItems = 'stretch';
      card.style.gap = '';
      card.style.padding = '';
      
      card.innerHTML =
        '<div class="lib-card__tags">' +
          item.tags.map((t, i) => `<span class="lib-tag${i === 0 ? ' lib-tag--primary' : ''}">${t}</span>`).join('') +
        '</div>' +
        `<h3 class="lib-card__title">${escHtml(item.title)}</h3>` +
        thumbHtml +
        `<p class="lib-card__desc">${escHtml(displayDesc)}</p>` +
        '<div class="lib-card__footer">' +
          '<button class="lib-card__copy" data-id="' + item.id + '" aria-label="복사">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>' +
            ' 복사' +
          '</button>' +
          '<span class="lib-card__detail-hint">자세히 보기 →</span>' +
        '</div>';
    }

    // Copy button
    card.querySelector('.lib-card__copy').addEventListener('click', function(e) {
      e.stopPropagation();
      if (!isLoggedIn) {
        unauthorizedClicksCount++;
        if (unauthorizedClicksCount >= 2) {
          unauthorizedClicksCount = 0;
          openLoginModal();
        } else {
          showToast('로그인이 필요한 서비스입니다 (한 번 더 클릭하면 로그인 창이 뜹니다)');
        }
        return;
      }
      copyToClipboard(item.prompt, this);
    });

    // Card click
    card.addEventListener('click', function(e) {
      if (!isLoggedIn) {
        unauthorizedClicksCount++;
        if (unauthorizedClicksCount >= 2) {
          unauthorizedClicksCount = 0;
          openLoginModal();
        } else {
          showToast('로그인이 필요한 서비스입니다 (한 번 더 클릭하면 로그인 창이 뜹니다)');
        }
        return;
      }
      openLibModal(item);
    });

    libContent.appendChild(card);
  });
}

// --- Slider Handle Move ---
window.handleSliderMove = function(e, container) {
  if (e.type === 'touchmove') {
    if (e.cancelable) e.preventDefault(); // Prevent page scroll during slider dragging
    e.stopPropagation(); // Prevent card click on mobile touch swipe
  }
  const rect = container.getBoundingClientRect();
  let clientX = e.clientX;
  if (e.type === 'touchmove') {
    clientX = e.touches[0].clientX;
  }
  let x = clientX - rect.left;
  let percentage = (x / rect.width) * 100;
  
  if (percentage < 0) percentage = 0;
  if (percentage > 100) percentage = 100;
  
  const wrapper = container.querySelector('.slider-before-wrapper');
  const handle = container.querySelector('.slider-handle');
  if (wrapper && handle) {
    wrapper.style.clipPath = `inset(0 ${100 - percentage}% 0 0)`;
    wrapper.style.webkitClipPath = `inset(0 ${100 - percentage}% 0 0)`;
    handle.style.left = percentage + '%';
  }
};

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
const libModalEditTextareaKo = document.getElementById('lib-modal-edit-textarea-ko');
const libModalEditTextareaEn = document.getElementById('lib-modal-edit-textarea-en');
const libModalImages = document.getElementById('lib-modal-images');
const libModalImageGrid = document.getElementById('lib-modal-image-grid');
const libModalImgInput = document.getElementById('lib-modal-img-input');
const libModalThumbBtn = document.getElementById('lib-modal-thumb-btn');
const libModalSave = document.getElementById('lib-modal-save');
const libModalCancel = document.getElementById('lib-modal-cancel');
const libModalDelete = document.getElementById('lib-modal-delete');
const libModalThumbUpload = document.getElementById('lib-modal-thumb-upload');
const libModalPromptTabs = document.getElementById('lib-modal-prompt-tabs');

// Language tracking for the library modal
let libActiveLang = 'ko';
let libEditActiveLang = 'ko';


function openLibModal(item) {
  libEditingItem = item;
  libEditMode = false;
  libActiveLang = 'ko'; // Reset to Korean when opening

  document.getElementById('lib-modal-tags').innerHTML =
    item.tags.map((t, i) => `<span class="lib-tag${i === 0 ? ' lib-tag--primary' : ''}">${escHtml(t)}</span>`).join('');
  document.getElementById('lib-modal-title').textContent = item.title;
  document.getElementById('lib-modal-desc').textContent = item.desc;
  
  // Render prompt based on active language
  updatePromptDisplay();

  // Show/hide admin edit button
  if (isAdmin) {
    libModalEdit.classList.remove('hidden');
  } else {
    libModalEdit.classList.add('hidden');
  }

  // Reset edit mode
  libModalPromptWrap.classList.remove('hidden');
  libModalEditWrap.classList.add('hidden');
  if (libModalPromptTabs) libModalPromptTabs.classList.remove('hidden');

  // Show images if any
  renderLibImages(item);

  libModal.classList.add('is-open');
  libModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function updatePromptDisplay() {
  if (!libEditingItem) return;
  const promptEl = document.getElementById('lib-modal-prompt');
  const tabKo = document.getElementById('lib-prompt-tab-ko');
  const tabEn = document.getElementById('lib-prompt-tab-en');

  let activePrompt = '';
  if (libActiveLang === 'ko') {
    activePrompt = libEditingItem.promptKo || libEditingItem.prompt || '';
    tabKo.style.background = '#f5f5f7';
    tabKo.style.color = '#555';
    tabKo.classList.add('is-active');
    
    tabEn.style.background = 'transparent';
    tabEn.style.color = '#888';
    tabEn.classList.remove('is-active');
  } else {
    activePrompt = libEditingItem.promptEn || libEditingItem.prompt || '';
    tabEn.style.background = '#f5f5f7';
    tabEn.style.color = '#555';
    tabEn.classList.add('is-active');
    
    tabKo.style.background = 'transparent';
    tabKo.style.color = '#888';
    tabKo.classList.remove('is-active');
  }

  promptEl.textContent = activePrompt;
  libModalCopy._currentPrompt = activePrompt;
}

// Add event listeners for detailed view tabs
document.getElementById('lib-prompt-tab-ko').addEventListener('click', function() {
  libActiveLang = 'ko';
  updatePromptDisplay();
});
document.getElementById('lib-prompt-tab-en').addEventListener('click', function() {
  libActiveLang = 'en';
  updatePromptDisplay();
});

// Add event listeners for edit view tabs
document.getElementById('lib-edit-tab-ko').addEventListener('click', function() {
  libEditActiveLang = 'ko';
  document.getElementById('lib-edit-tab-ko').style.background = '#FFF1BC';
  document.getElementById('lib-edit-tab-ko').style.color = '#333';
  document.getElementById('lib-edit-tab-en').style.background = 'transparent';
  document.getElementById('lib-edit-tab-en').style.color = '#888';
  
  libModalEditTextareaKo.classList.remove('hidden');
  libModalEditTextareaEn.classList.add('hidden');
});
document.getElementById('lib-edit-tab-en').addEventListener('click', function() {
  libEditActiveLang = 'en';
  document.getElementById('lib-edit-tab-en').style.background = '#FFF1BC';
  document.getElementById('lib-edit-tab-en').style.color = '#333';
  document.getElementById('lib-edit-tab-ko').style.background = 'transparent';
  document.getElementById('lib-edit-tab-ko').style.color = '#888';
  
  libModalEditTextareaEn.classList.remove('hidden');
  libModalEditTextareaKo.classList.add('hidden');
});

function renderLibImages(item) {
  const images = item.images || [];
  const thumbs = item.thumbnails || [];
  const originalImages = item.originalImages || [];
  
  if (images.length === 0 && thumbs.length === 0) {
    libModalImages.classList.add('hidden');
    return;
  }

  libModalImages.classList.remove('hidden');
  libModalImageGrid.innerHTML = '';

  // Show images — use originalImages[i] for download if available
  // 썸네일 이미지는 상세 모달 그리드에서 제외하여 중복 노출 방지 (요청사항 반영)
  images.forEach((src, i) => {
    const div = document.createElement('div');
    div.className = 'lib-modal__image-item';
    div.style.cursor = 'pointer';
    div.innerHTML = '<img src="' + src + '" alt="이미지 ' + (i + 1) + '" style="transition: transform 0.2s;" />' +
      (isAdmin ? '<button class="lib-modal__image-delete" data-type="image" data-index="' + i + '">&times;</button>' : '');
    
    // Lightbox setup — pass originalImages[i] as second arg so download gets full quality
    div.addEventListener('click', function(e) {
      if (e.target.classList.contains('lib-modal__image-delete')) return;
      const originalSrc = originalImages[i] || src;
      openLightbox(src, originalSrc);
    });

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

// Lightbox controller functions
const lightboxEl = document.getElementById('lib-lightbox');
const lightboxImg = document.getElementById('lib-lightbox-img');
const lightboxClose = document.getElementById('lib-lightbox-close');

function openLightbox(src, originalSrc) {
  if (!lightboxEl || !lightboxImg) return;
  lightboxImg.src = src;
  
  // Update download button — use originalSrc if provided (full quality), else fallback to display src
  const dlBtn = document.getElementById('lib-lightbox-download');
  if (dlBtn) {
    const downloadSrc = originalSrc || src;
    dlBtn.href = downloadSrc;
    dlBtn.download = 'image_' + Date.now() + '.jpg';
  }
  
  lightboxEl.style.display = 'flex';
  lightboxEl.offsetHeight; // trigger reflow
  lightboxEl.style.opacity = '1';
  lightboxEl.style.pointerEvents = 'auto';
  lightboxImg.style.transform = 'scale(1)';
}

function closeLightbox() {
  if (!lightboxEl || !lightboxImg) return;
  lightboxEl.style.opacity = '0';
  lightboxEl.style.pointerEvents = 'none';
  lightboxImg.style.transform = 'scale(0.95)';
  setTimeout(() => {
    lightboxEl.style.display = 'none';
    lightboxImg.src = '';
  }, 300);
}

if (lightboxEl && lightboxClose) {
  lightboxClose.addEventListener('click', closeLightbox);
  lightboxEl.addEventListener('click', function(e) {
    if (e.target === lightboxEl) {
      closeLightbox();
    }
  });
}

function enterEditMode() {
  if (!isAdmin || !libEditingItem) return;
  libEditMode = true;
  libEditActiveLang = 'ko'; // Default edit tab is Korean

  libModalPromptWrap.classList.add('hidden');
  libModalEditWrap.classList.remove('hidden');
  if (libModalPromptTabs) libModalPromptTabs.classList.add('hidden');
  
  // Hide details image container so we don't see double images while editing
  libModalImages.classList.add('hidden');
  
  document.getElementById('lib-modal-edit-title').value = libEditingItem.title || '';
  document.getElementById('lib-modal-edit-desc').value = libEditingItem.desc || '';
  document.getElementById('lib-modal-edit-tags').value = libEditingItem.tags ? libEditingItem.tags.join(', ') : '';
  
  // Populate the bilingual textareas
  libModalEditTextareaKo.value = libEditingItem.promptKo || libEditingItem.prompt || '';
  libModalEditTextareaEn.value = libEditingItem.promptEn || libEditingItem.prompt || '';
  
  // Reset tab UI to Korean
  document.getElementById('lib-edit-tab-ko').style.background = '#FFF1BC';
  document.getElementById('lib-edit-tab-ko').style.color = '#333';
  document.getElementById('lib-edit-tab-en').style.background = 'transparent';
  document.getElementById('lib-edit-tab-en').style.color = '#888';
  
  libModalEditTextareaKo.classList.remove('hidden');
  libModalEditTextareaEn.classList.add('hidden');
  
  // Update Before/After Upload slots UI
  updateUploadSlotsUI(libEditingItem);
  
  document.getElementById('lib-modal-edit-title').focus();
}

function exitEditMode() {
  libEditMode = false;
  libModalEditWrap.classList.add('hidden');
  libModalPromptWrap.classList.remove('hidden');
  if (libModalPromptTabs) libModalPromptTabs.classList.remove('hidden');
  
  // Restore images container visibility on exit
  if (libEditingItem && (libEditingItem.images || []).length > 0) {
    libModalImages.classList.remove('hidden');
  }
}

async function translateText(text, targetLang) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data[0]) {
      return data[0].map(x => x[0]).join('');
    }
  } catch (err) {
    console.error("Translation error:", err);
  }
  return text;
}

async function saveEdit() {
  if (!libEditingItem) return;
  
  const oldPromptKo = (libEditingItem.promptKo || libEditingItem.prompt || '').trim();
  const oldPromptEn = (libEditingItem.promptEn || libEditingItem.prompt || '').trim();
  
  let newPromptKo = libModalEditTextareaKo.value.trim();
  let newPromptEn = libModalEditTextareaEn.value.trim();
  
  // Intelligent translation: Detect which side was modified/created and translate the other
  if (newPromptKo !== oldPromptKo && (newPromptEn === oldPromptEn || !newPromptEn)) {
    if (newPromptKo) {
      newPromptEn = await translateText(newPromptKo, 'en');
      libModalEditTextareaEn.value = newPromptEn;
    } else {
      newPromptEn = '';
      libModalEditTextareaEn.value = '';
    }
  } else if (newPromptEn !== oldPromptEn && (newPromptKo === oldPromptKo || !newPromptKo)) {
    if (newPromptEn) {
      newPromptKo = await translateText(newPromptEn, 'ko');
      libModalEditTextareaKo.value = newPromptKo;
    } else {
      newPromptKo = '';
      libModalEditTextareaKo.value = '';
    }
  }
  
  const newPrompt = newPromptEn || newPromptKo;
  
  const newTitle = document.getElementById('lib-modal-edit-title').value.trim() || libEditingItem.title || '새 프롬프트';
  const newDesc = document.getElementById('lib-modal-edit-desc').value.trim() || libEditingItem.desc || '';
  const newTagsVal = document.getElementById('lib-modal-edit-tags').value.trim();
  const parsedTags = newTagsVal ? newTagsVal.split(',').map(t => t.trim()).filter(Boolean) : [];
  const newTags = parsedTags.slice(0, 3); // 최대 3개까지만
  const newCat = newTags.length > 0 ? newTags[0] : '기타';
  
  libEditingItem.prompt = newPrompt;
  libEditingItem.promptKo = newPromptKo;
  libEditingItem.promptEn = newPromptEn;
  libEditingItem.title = newTitle;
  libEditingItem.desc = newDesc;
  libEditingItem.category = newCat;
  libEditingItem.tags = newTags.length > 0 ? newTags : [newCat];

  // Auto-generate 200px thumbnail from uploaded images
  if (libEditingItem.images && libEditingItem.images.length > 0) {
    const firstImg = libEditingItem.images[0] || libEditingItem.images[1];
    if (firstImg) {
      try {
        const thumb = await generateThumbnail(firstImg);
        libEditingItem.thumbnails = [thumb];
      } catch (err) {
        console.warn('Thumbnail generation failed:', err);
      }
    }
  }
  
  saveLibraryOverride(libEditingItem.id, { 
    prompt: newPrompt,
    promptKo: newPromptKo,
    promptEn: newPromptEn,
    title: newTitle,
    desc: newDesc,
    category: libEditingItem.category,
    tags: libEditingItem.tags,
    images: libEditingItem.images || [],
    thumbnails: libEditingItem.thumbnails || [],
    isReferenceType: libEditingItem.isReferenceType || false
  });

  const existing = libraryData.find(d => d.id === libEditingItem.id);
  if (!existing) {
    libraryData.push(libEditingItem);
  }

  // Update display
  document.getElementById('lib-modal-title').textContent = newTitle;
  document.getElementById('lib-modal-desc').textContent = newDesc;
  if (libModalPromptTabs) libModalPromptTabs.classList.remove('hidden');
  
  // Re-display active language prompt
  updatePromptDisplay();
  
  document.getElementById('lib-modal-tags').innerHTML =
    libEditingItem.tags.map((t, i) => `<span class="lib-tag${i === 0 ? ' lib-tag--primary' : ''}">${escHtml(t)}</span>`).join('');
  
  // Delightful "Saved" animation on the save button
  const saveBtn = document.getElementById('lib-modal-save');
  const originalHtml = saveBtn.innerHTML;
  saveBtn.innerHTML = '<span style="display:inline-flex; align-items:center; gap:4px; animation: popIn 0.3s ease;">✓ 저장됨</span>';
  saveBtn.style.background = '#34c759'; // Premium success green
  saveBtn.style.color = '#fff';
  saveBtn.style.borderColor = '#34c759';
  saveBtn.disabled = true;


  setTimeout(function() {
    // Restore button styles
    saveBtn.innerHTML = originalHtml;
    saveBtn.style.background = '';
    saveBtn.style.color = '';
    saveBtn.style.borderColor = '';
    saveBtn.disabled = false;
    
    exitEditMode();
    renderLibrary();
    showToast('프롬프트가 저장되었습니다');
  }, 800);
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

// Add custom prompt creation
const libAddBtn = document.getElementById('lib-add-btn');
const typeModal = document.getElementById('lib-type-modal');
const typeModalClose = document.getElementById('lib-type-modal-close');
const btnTypeBeforeAfter = document.getElementById('btn-type-before-after');
const btnTypeReference = document.getElementById('btn-type-reference');

if (libAddBtn) {
  libAddBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    if (!isAdmin) return;
    
    typeModal.classList.remove('hidden');
    typeModal.setAttribute('aria-hidden', 'false');
  });
}

if (typeModalClose) {
  typeModalClose.addEventListener('click', function() {
    typeModal.classList.add('hidden');
    typeModal.setAttribute('aria-hidden', 'true');
  });
}

function initNewPrompt(isReferenceType) {
  typeModal.classList.add('hidden');
  typeModal.setAttribute('aria-hidden', 'true');

  const newId = 'lib-custom-' + Date.now();
  const newItem = {
    id: newId,
    category: '',
    tags: [],
    title: '',
    desc: '',
    prompt: '',
    images: [],
    thumbnails: [],
    isReferenceType: isReferenceType
  };
  openLibModal(newItem);
  enterEditMode();
}

if (btnTypeBeforeAfter) {
  btnTypeBeforeAfter.addEventListener('click', function() {
    initNewPrompt(false);
  });
}
if (btnTypeReference) {
  btnTypeReference.addEventListener('click', function() {
    initNewPrompt(true);
  });
}

// Setup Before/After image upload logic
const beforeSlot = document.getElementById('lib-upload-slot-before');
const afterSlot = document.getElementById('lib-upload-slot-after');
const resultSlot = document.getElementById('lib-upload-slot-result');
const beforeInput = document.getElementById('lib-before-input');
const afterInput = document.getElementById('lib-after-input');
const resultInput = document.getElementById('lib-result-input');

function setupUploadSlot(slot, input, imageIndex) {
  if (!slot || !input) return;

  slot.addEventListener('click', function(e) {
    // Avoid triggering input if clicked on the delete button
    if (e.target.classList.contains('lib-upload-delete')) return;
    input.click();
  });

  // Drag and drop support
  slot.addEventListener('dragover', function(e) {
    e.preventDefault();
    slot.style.borderColor = 'var(--color-primary)';
    slot.style.background = '#f0f5ff';
  });

  slot.addEventListener('dragleave', function(e) {
    e.preventDefault();
    slot.style.borderColor = 'rgba(0,0,0,0.12)';
    slot.style.background = '#f9f9fb';
  });

  slot.addEventListener('drop', async function(e) {
    e.preventDefault();
    slot.style.borderColor = 'rgba(0,0,0,0.12)';
    slot.style.background = '#f9f9fb';
    
    if (!isAdmin || !libEditingItem) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length) {
      await handleSlotImageUpload(files[0], slot, imageIndex);
    }
  });

  input.addEventListener('change', async function() {
    if (!isAdmin || !libEditingItem) return;
    const files = Array.from(this.files);
    if (files.length) {
      await handleSlotImageUpload(files[0], slot, imageIndex);
    }
    this.value = ''; // Reset
  });

  const deleteBtn = slot.querySelector('.lib-upload-delete');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!isAdmin || !libEditingItem) return;
      if (!libEditingItem.images) libEditingItem.images = [];
      
      // Remove or nullify
      libEditingItem.images[imageIndex] = null;
      // Clean trailing nulls
      while (libEditingItem.images.length > 0 && libEditingItem.images[libEditingItem.images.length - 1] === null) {
        libEditingItem.images.pop();
      }
      
      // Update UI for slot
      const preview = slot.querySelector('.lib-upload-preview');
      const placeholder = slot.querySelector('.lib-upload-placeholder');
      
      preview.src = '';
      preview.classList.add('hidden');
      deleteBtn.classList.add('hidden');
      placeholder.classList.remove('hidden');

      saveLibraryOverride(libEditingItem.id, { images: libEditingItem.images });
      renderLibrary(); // Refresh main view cards
    });
  }
}

async function handleSlotImageUpload(file, slot, imageIndex) {
  try {
    const dataUrl = await readFileAsDataUrl(file);

    if (!libEditingItem.images) libEditingItem.images = [];
    if (!libEditingItem.originalImages) libEditingItem.originalImages = [];

    // Compress both images to 800px width with 0.7 quality to guarantee they fit within Firestore 1MB limits
    const displayImage = await compressImage(dataUrl, 800, 0.7);
    
    libEditingItem.images[imageIndex] = displayImage;
    libEditingItem.originalImages[imageIndex] = displayImage; // Match compressed to prevent payload bloat

    // Render inside the slot
    const preview = slot.querySelector('.lib-upload-preview');
    const placeholder = slot.querySelector('.lib-upload-placeholder');
    const deleteBtn = slot.querySelector('.lib-upload-delete');

    preview.src = displayImage;
    preview.classList.remove('hidden');
    deleteBtn.classList.remove('hidden');
    placeholder.classList.add('hidden');

    saveLibraryOverride(libEditingItem.id, {
      images: libEditingItem.images,
      originalImages: libEditingItem.originalImages
    });
    renderLibrary(); // Refresh cards in main view
    showToast((imageIndex === 0 ? 'Before' : 'After') + ' 사진이 정상 등록되었습니다');
  } catch (e) {
    console.warn('Failed to upload image into slot:', e);
    showToast('이미지 업로드 실패');
  }
}

setupUploadSlot(beforeSlot, beforeInput, 0);
setupUploadSlot(afterSlot, afterInput, 1);
setupUploadSlot(resultSlot, resultInput, 2);

// Helper function to update the Before/After upload slots inside modal edit mode
function updateUploadSlotsUI(item) {
  const images = item.images || [];
  const isRef = !!item.isReferenceType;

  const labelBefore = document.getElementById('lib-upload-label-before');
  const labelAfter = document.getElementById('lib-upload-label-after');

  if (isRef) {
    resultSlot.classList.remove('hidden');
    if (labelBefore) labelBefore.textContent = '1번 이미지 (원본)';
    if (labelAfter) labelAfter.textContent = '2번 이미지 (참조)';
  } else {
    resultSlot.classList.add('hidden');
    if (labelBefore) labelBefore.textContent = 'Before';
    if (labelAfter) labelAfter.textContent = 'After';
  }
  
  // Before Slot (index 0)
  const beforePreview = beforeSlot.querySelector('.lib-upload-preview');
  const beforePlaceholder = beforeSlot.querySelector('.lib-upload-placeholder');
  const beforeDelete = beforeSlot.querySelector('.lib-upload-delete');
  
  if (images[0]) {
    beforePreview.src = images[0];
    beforePreview.classList.remove('hidden');
    beforeDelete.classList.remove('hidden');
    beforePlaceholder.classList.add('hidden');
  } else {
    beforePreview.src = '';
    beforePreview.classList.add('hidden');
    beforeDelete.classList.add('hidden');
    beforePlaceholder.classList.remove('hidden');
  }

  // After Slot (index 1)
  const afterPreview = afterSlot.querySelector('.lib-upload-preview');
  const afterPlaceholder = afterSlot.querySelector('.lib-upload-placeholder');
  const afterDelete = afterSlot.querySelector('.lib-upload-delete');
  
  if (images[1]) {
    afterPreview.src = images[1];
    afterPreview.classList.remove('hidden');
    afterDelete.classList.remove('hidden');
    afterPlaceholder.classList.add('hidden');
  } else {
    afterPreview.src = '';
    afterPreview.classList.add('hidden');
    afterDelete.classList.add('hidden');
    afterPlaceholder.classList.remove('hidden');
  }

  // Result Slot (index 2)
  const resultPreview = resultSlot.querySelector('.lib-upload-preview');
  const resultPlaceholder = resultSlot.querySelector('.lib-upload-placeholder');
  const resultDelete = resultSlot.querySelector('.lib-upload-delete');
  
  if (images[2]) {
    resultPreview.src = images[2];
    resultPreview.classList.remove('hidden');
    resultDelete.classList.remove('hidden');
    resultPlaceholder.classList.add('hidden');
  } else {
    resultPreview.src = '';
    resultPreview.classList.add('hidden');
    resultDelete.classList.add('hidden');
    resultPlaceholder.classList.remove('hidden');
  }
}

// Handle Delete library item
if (libModalDelete) {
  libModalDelete.addEventListener('click', function() {
    if (!isAdmin || !libEditingItem) return;
    if (confirm('정말로 이 프롬프트를 삭제하시겠습니까?')) {
      // 1. Mark as deleted in Firestore so it permanently disappears for everyone
      db.collection('library_overrides').doc(libEditingItem.id).set({ isDeleted: true })
        .then(function() {
          console.log('Marked item as deleted in Firestore');
        })
        .catch(function(e) {
          console.warn('Failed to mark item as deleted in Firestore:', e);
        });
      
      // 2. Remove from local storage
      try {
        const overrides = JSON.parse(localStorage.getItem('pl_lib_overrides')) || {};
        delete overrides[libEditingItem.id];
        localStorage.setItem('pl_lib_overrides', JSON.stringify(overrides));
      } catch (e) {
        console.warn('Failed to delete from localStorage:', e);
      }
      
      // 3. Remove from local libraryData array
      const index = libraryData.findIndex(item => item.id === libEditingItem.id);
      if (index > -1) {
        libraryData.splice(index, 1);
      }
      
      closeLibModal();
      renderLibrary();
      showToast('프롬프트가 삭제되었습니다');
    }
  });
}

// Automatically generate Title, Description, Category, and Tags based on prompt text
function autoGenerateMetadata(promptText) {
  if (!promptText || promptText.trim().length < 10) return;
  
  const editTitle = document.getElementById('lib-modal-edit-title');
  const editDesc = document.getElementById('lib-modal-edit-desc');
  const editTags = document.getElementById('lib-modal-edit-tags');
  
  const currentTitle = editTitle.value.trim();
  const currentDesc = editDesc.value.trim();
  const currentTags = editTags.value.trim();
  
  let detectedTitle = "";
  let detectedDesc = "";
  let detectedCat = "업스케일";
  
  const textLower = promptText.toLowerCase();
  
  if (textLower.includes("upscale") || textLower.includes("업스케일") || textLower.includes("sony") || textLower.includes("a1")) {
    detectedTitle = "시네마틱 이미지 업스케일";
    detectedDesc = "Sony A1 고화질 카메라 스타일로 인물/사물 질감을 자연스럽고 사실적으로 업스케일합니다.";
    detectedCat = "업스케일";
  } else if (textLower.includes("composite") || textLower.includes("합성") || textLower.includes("background") || textLower.includes("배경")) {
    detectedTitle = "자연스러운 배경 합성";
    detectedDesc = "조명과 색온도를 유기적으로 맞추어 피사체를 배경에 완벽하게 자연스럽게 합성합니다.";
    detectedCat = "합성";
  } else if (textLower.includes("portrait") || textLower.includes("인물") || textLower.includes("얼굴") || textLower.includes("face")) {
    detectedTitle = "고품질 인물 포트레이트";
    detectedDesc = "인물의 얼굴 대칭, 이목구비 비율과 원본 디테일을 극대화하는 인물 전용 프롬프트입니다.";
    detectedCat = "인물";
  } else if (textLower.includes("edit") || textLower.includes("보정") || textLower.includes("color") || textLower.includes("색감") || textLower.includes("tone")) {
    detectedTitle = "프리미엄 사진 색감 보정";
    detectedDesc = "사진의 미세한 노이즈를 제어하고 풍부한 10비트 컬러 그레이딩으로 색감을 보정합니다.";
    detectedCat = "사진보정";
  } else {
    // Fallback parsing
    const lines = promptText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      detectedTitle = lines[0].replace(/[\[\]]/g, '').substring(0, 20);
      if (detectedTitle.length >= 20) detectedTitle += "...";
    } else {
      detectedTitle = "새 프롬프트";
    }
    detectedDesc = promptText.replace(/\s+/g, ' ').substring(0, 50) + "...";
  }
  
  // Enforce under 60 characters for description
  if (detectedDesc.length > 60) {
    detectedDesc = detectedDesc.substring(0, 57) + "...";
  }
  
  // Auto fill empty or placeholder inputs
  if (!currentTitle || currentTitle === "새 프롬프트 제목" || currentTitle === "새 프롬프트") {
    editTitle.value = detectedTitle;
  }
  if (!currentDesc || currentDesc === "설명을 입력해주세요." || currentDesc === "설명을 입력하세요" || !currentDesc) {
    editDesc.value = detectedDesc;
  }
}

// Attach listeners for autogeneration on prompt inputs
if (libModalEditTextareaKo && libModalEditTextareaEn) {
  libModalEditTextareaKo.addEventListener('input', function() {
    autoGenerateMetadata(this.value);
  });
  libModalEditTextareaEn.addEventListener('input', function() {
    autoGenerateMetadata(this.value);
  });
}


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

  currentView = v;
  navFloat.classList.toggle('is-active', v === 'float');
  if (navList) navList.classList.toggle('is-active', v === 'list');
  navLibrary.classList.toggle('is-active', v === 'library');

  canvas.classList.add('hidden');
  listView.classList.add('hidden');
  libraryView.classList.add('hidden');

  // Show/Hide search bar: only show in library view
  const searchContainer = document.querySelector('.global-nav__search-container');
  if (searchContainer) {
    if (v === 'library') {
      searchContainer.style.display = 'block';
    } else {
      searchContainer.style.display = 'none';
      // Clear query when leaving library to avoid stale states
      if (globalSearchInput) globalSearchInput.value = '';
      globalSearchQuery = '';
    }
  }

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

// --- Mobile Menu Events ---
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
const globalNavRight = document.getElementById('global-nav-right');

window.closeMobileMenu = function() {
  if (globalNavRight) globalNavRight.classList.remove('is-open');
  if (mobileMenuOverlay) mobileMenuOverlay.classList.remove('is-open');
  
  // Restore input bar when closing mobile menu, unless in library view
  if (inputBar && typeof currentView !== 'undefined' && currentView !== 'library') {
    inputBar.classList.remove('hidden');
  }
};

if (mobileMenuBtn && mobileMenuOverlay) {
  mobileMenuBtn.addEventListener('click', function () {
    const isOpen = globalNavRight.classList.toggle('is-open');
    mobileMenuOverlay.classList.toggle('is-open', isOpen);
    
    // Hide input bar when mobile menu is open
    if (inputBar) {
      if (isOpen) {
        inputBar.classList.add('hidden');
      } else {
        if (typeof currentView !== 'undefined' && currentView !== 'library') {
          inputBar.classList.remove('hidden');
        }
      }
    }
  });
  mobileMenuOverlay.addEventListener('click', closeMobileMenu);
}

// --- Events ---
navFloat.addEventListener('click', function () { setView('float'); closeMobileMenu(); });
if (navList) {
  navList.addEventListener('click', function () { setView('list'); closeMobileMenu(); });
}
navLibrary.addEventListener('click', function () { setView('library'); closeMobileMenu(); });

// Dashboard inner List View button
const dashboardListBtn = document.getElementById('dashboard-list-btn');
if (dashboardListBtn) {
  dashboardListBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    setView('list');
  });
}

// List View inner Dashboard button
const listDashboardBtn = document.getElementById('list-dashboard-btn');
if (listDashboardBtn) {
  listDashboardBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    setView('float');
  });
}


const filterMy = document.getElementById('filter-my');

filterNewest.addEventListener('click', function () {
  sortOrder = 'newest';
  filterNewest.classList.add('is-active');
  filterOldest.classList.remove('is-active');
  if (filterMy) filterMy.classList.remove('is-active');
  renderList();
});
filterOldest.addEventListener('click', function () {
  sortOrder = 'oldest';
  filterOldest.classList.add('is-active');
  filterNewest.classList.remove('is-active');
  if (filterMy) filterMy.classList.remove('is-active');
  renderList();
});
if (filterMy) {
  filterMy.addEventListener('click', function () {
    sortOrder = 'my';
    filterMy.classList.add('is-active');
    filterNewest.classList.remove('is-active');
    filterOldest.classList.remove('is-active');
    renderList();
  });
}

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

// --- Setup Search input and Layout Mode togglers ---
const globalSearchInput = document.getElementById('global-search-input');
if (globalSearchInput) {
  globalSearchInput.addEventListener('input', function() {
    globalSearchQuery = this.value;
    
    // Automatically switch to library view when typing to see results in real-time
    if (currentView !== 'library') {
      setView('library');
    } else {
      renderLibrary();
    }
  });
}

const toggleGalleryBtn = document.getElementById('lib-toggle-gallery');
const toggleListBtn = document.getElementById('lib-toggle-list');

if (toggleGalleryBtn && toggleListBtn) {
  toggleGalleryBtn.addEventListener('click', function() {
    libLayoutMode = 'gallery';
    toggleGalleryBtn.classList.add('is-active');
    toggleGalleryBtn.style.background = '#fff';
    toggleGalleryBtn.style.color = '#333';
    toggleGalleryBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
    
    toggleListBtn.classList.remove('is-active');
    toggleListBtn.style.background = 'transparent';
    toggleListBtn.style.color = '#777';
    toggleListBtn.style.boxShadow = 'none';
    
    renderLibrary();
  });

  toggleListBtn.addEventListener('click', function() {
    libLayoutMode = 'list';
    toggleListBtn.classList.add('is-active');
    toggleListBtn.style.background = '#fff';
    toggleListBtn.style.color = '#333';
    toggleListBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
    
    toggleGalleryBtn.classList.remove('is-active');
    toggleGalleryBtn.style.background = 'transparent';
    toggleGalleryBtn.style.color = '#777';
    toggleGalleryBtn.style.boxShadow = 'none';
    
    renderLibrary();
  });
}

// --- 1-hour auto-refresh of floating positions ---
setInterval(function () {
  if (currentView === 'float') renderFloat();
}, 3600000);

// --- Init ---
loadLibraryOverrides();
startLibraryOverridesListener();
restoreSession();
startListener();
setView('library');

// Global event to auto-save and blur editable list items when clicking outside
document.addEventListener('pointerdown', function(e) {
  if (!e.target.closest('.list-item.is-editable')) {
    document.querySelectorAll('.list-item.is-editable').forEach(function(item) {
      const textEl = item.querySelector('.list-item__text');
      if (textEl && textEl.getAttribute('contenteditable') === 'true') {
        textEl.blur();
      }
    });
  }
});

// Delete recent prompts logic
function deleteRecentPrompts() {
  if (!isAdmin) return;
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  
  if (!confirm('최근 1시간 내에 작성된 모든 프롬프트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
  
  let deletedCount = 0;
  
  // Find prompts created within last 1 hour
  prompts.forEach(p => {
    if (p.timestamp > oneHourAgo && !p.id.startsWith('local-')) {
      db.collection('prompts').doc(p.id).delete().catch(err => console.warn('Failed to delete prompt:', err));
      deletedCount++;
    }
  });
  
  showToast(`최근 1시간 내의 프롬프트 ${deletedCount}개가 삭제되었습니다.`);
}

const cleanupDashBtn = document.getElementById('admin-cleanup-btn-dash');
const cleanupListBtn = document.getElementById('admin-cleanup-btn-list');

if (cleanupDashBtn) cleanupDashBtn.addEventListener('click', deleteRecentPrompts);
if (cleanupListBtn) cleanupListBtn.addEventListener('click', deleteRecentPrompts);