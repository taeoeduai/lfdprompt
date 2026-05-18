// ============================================
// DESIGN MASTERCLASS — Liquid Glass Prompts
// Firebase Firestore real-time + Apple design
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

// --- DOM ---
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

// Restore author from localStorage
const saved = localStorage.getItem('mc_author') || '';
if (saved) authorInput.value = saved;

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
  el.className = 'bubble' + (enter ? ' bubble--enter' : '');
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
  el.innerHTML =
    '<button class="delete-btn" data-id="' + p.id + '" aria-label="삭제">&times;</button>' +
    (a ? '<p class="bubble__author">' + a + '</p>' : '') +
    '<p class="bubble__text">' + escHtml(p.text) + '</p>';
  el.querySelector('.delete-btn').addEventListener('click', function (e) {
    e.stopPropagation();
    deletePrompt(p.id, el);
  });

  let isDragging = false;
  let startX, startY, initialLeft, initialTop;

  el.addEventListener('pointerdown', function (e) {
    if (e.target.closest('.delete-btn')) return;
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
    el.style.left = (initialLeft + dx) + 'px';
    el.style.top = (initialTop + dy) + 'px';
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

  if (enter) el.addEventListener('animationend', () => el.classList.remove('bubble--enter'), { once: true });
  return el;
}

// --- Render Floating ---
function renderFloat() {
  const existingBubbles = Array.from(canvas.querySelectorAll('.bubble'));
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
  const currentBubbles = Array.from(canvas.querySelectorAll('.bubble'));
  currentBubbles.forEach(b => {
    const x = parseFloat(b.style.left) || 0;
    const y = parseFloat(b.style.top) || 0;
    placed.push({ x: x, y: y, w: b.offsetWidth || 200, h: b.offsetHeight || 60 });
  });

  // Update existing and create new bubbles
  show.forEach(p => {
    const existing = canvas.querySelector(`.bubble[data-id="${p.id}"]`);
    
    let targetX, targetY;
    const ew = Math.min(80 + p.text.length * 4, 250);
    const eh = 44 + Math.ceil(p.text.length / 16) * 16;

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
      deletePrompt(p.id, item);
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
            posY: typeof d.posY === 'number' ? d.posY : null
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

// --- Submit ---
function submitPrompt() {
  var text = textarea.value.trim();
  if (!text) return;
  var author = authorInput.value.trim().toUpperCase().slice(0, 3) || '';
  if (author) localStorage.setItem('mc_author', author);

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
}

// --- View Toggle ---
function setView(v) {
  if (v === currentView) return;
  currentView = v;
  navFloat.classList.toggle('is-active', v === 'float');
  navList.classList.toggle('is-active', v === 'list');
  navLibrary.classList.toggle('is-active', v === 'library');

  canvas.classList.add('hidden');
  listView.classList.add('hidden');
  libraryView.classList.add('hidden');

  if (v === 'float') {
    canvas.classList.remove('hidden');
    renderFloat();
  } else if (v === 'list') {
    listView.classList.remove('hidden');
    renderList();
  } else if (v === 'library') {
    libraryView.classList.remove('hidden');
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

// --- 1-hour auto-refresh of floating positions ---
setInterval(function () {
  if (currentView === 'float') renderFloat();
}, 3600000);

// --- Init ---
startListener();
renderFloat();