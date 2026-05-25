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

// Sync initials input with localStorage in real-time
authorInput.addEventListener('input', function() {
  const val = this.value.trim().toUpperCase().slice(0, 3);
  if (val) {
    localStorage.setItem('mc_author', val);
  } else {
    localStorage.removeItem('mc_author');
  }
});

// Clear the input value on focus so user can immediately type fresh initials
authorInput.addEventListener('focus', function() {
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
    deletePrompt(p.id, el);
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

// --- Submit ---
function submitPrompt() {
  var text = textarea.value.trim();
  if (!text) return;
  var author = authorInput.value.trim().toUpperCase().slice(0, 3) || '';
  if (author) {
    localStorage.setItem('mc_author', author);
  } else {
    localStorage.removeItem('mc_author');
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
- ❌ No flat or muddy lighting — maintain dimensional depth at all times`
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
- Brand-appropriate mood and tone`
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
    card.innerHTML =
      '<div class="lib-card__tags">' +
        item.tags.map((t, i) => `<span class="lib-tag${i === 0 ? ' lib-tag--primary' : ''}">${t}</span>`).join('') +
      '</div>' +
      `<h3 class="lib-card__title">${escHtml(item.title)}</h3>` +
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

function openLibModal(item) {
  document.getElementById('lib-modal-tags').innerHTML =
    item.tags.map((t, i) => `<span class="lib-tag${i === 0 ? ' lib-tag--primary' : ''}">${escHtml(t)}</span>`).join('');
  document.getElementById('lib-modal-title').textContent = item.title;
  document.getElementById('lib-modal-desc').textContent = item.desc;
  document.getElementById('lib-modal-prompt').textContent = item.prompt;

  libModal.classList.add('is-open');
  libModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  libModalCopy._currentPrompt = item.prompt;
}

function closeLibModal() {
  libModal.classList.remove('is-open');
  libModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

libModalBackdrop.addEventListener('click', closeLibModal);
libModalClose.addEventListener('click', closeLibModal);
libModalCopy.addEventListener('click', function() {
  copyToClipboard(this._currentPrompt, this);
});

// ESC to close
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeLibModal();
});

// --- View Toggle ---
const inputBar = document.getElementById('input-bar');

function setView(v) {
  if (v === currentView) return;
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

// --- 1-hour auto-refresh of floating positions ---
setInterval(function () {
  if (currentView === 'float') renderFloat();
}, 3600000);

// --- Init ---
startListener();
renderFloat();