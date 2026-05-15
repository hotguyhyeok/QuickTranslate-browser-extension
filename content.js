(() => {
  'use strict';

  const DEFAULT = { displayMode: 'popup', autohideDuration: 5000, theme: 'system', opacity: 100 };
  let cfg = { ...DEFAULT };
  let floatPos = { left: null, top: null };
  let floatSize = { width: 300, height: 180 };
  let qtEnabled = true;

  chrome.storage.local.get(['qtEnabled'], (data) => {
    if (data.qtEnabled === false) qtEnabled = false;
  });

  chrome.storage.sync.get(['displayMode', 'autohideDuration', 'theme', 'opacity'], (data) => {
    if (data.displayMode) cfg.displayMode = data.displayMode;
    if (data.autohideDuration !== undefined) cfg.autohideDuration = data.autohideDuration;
    if (data.theme) cfg.theme = data.theme;
    if (data.opacity !== undefined) cfg.opacity = data.opacity;
  });

  chrome.storage.local.get(['floatingPosition', 'floatingSize'], (data) => {
    if (data.floatingPosition) floatPos = data.floatingPosition;
    if (data.floatingSize) floatSize = data.floatingSize;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    try {
      if (area === 'local' && changes.qtEnabled !== undefined) {
        qtEnabled = changes.qtEnabled.newValue !== false;
        return;
      }
      if (area !== 'sync') return;
      if (changes.displayMode) cfg.displayMode = changes.displayMode.newValue;
      if (changes.autohideDuration !== undefined) cfg.autohideDuration = changes.autohideDuration.newValue;
      if (changes.theme) {
        cfg.theme = changes.theme.newValue;
        if (popupEl) applyTheme(popupEl);
        if (floatingEl) applyTheme(floatingEl);
      }
      if (changes.opacity !== undefined) {
        cfg.opacity = changes.opacity.newValue;
        if (popupEl) applyOpacity(popupEl);
        if (floatingEl) applyOpacity(floatingEl);
      }
    } catch { invalidate(); }
  });

  let popupEl = null;
  let floatingEl = null;
  let hideTimer = null;
  let currentRequestId = 0;
  let contextAlive = true;

  function invalidate() {
    contextAlive = false;
    if (popupEl) popupEl.style.display = 'none';
    if (floatingEl) floatingEl.style.display = 'none';
  }

  function applyTheme(el) {
    el.classList.remove('qt-dark', 'qt-light');
    if (cfg.theme === 'dark') el.classList.add('qt-dark');
    else if (cfg.theme === 'light') el.classList.add('qt-light');
  }

  function applyOpacity(el) {
    el.style.setProperty('--qt-bg-alpha', (cfg.opacity / 100).toFixed(2));
  }

  document.addEventListener('dblclick', (e) => {
    if (!qtEnabled || isInsideUI(e.target)) return;
    const text = getSelectedText();
    if (text) requestTranslation(text, e);
  });

  // triple-click fires dblclick first — cancel that pending request, then handle as sentence
  document.addEventListener('mousedown', (e) => {
    if (!qtEnabled || e.detail !== 3 || isInsideUI(e.target)) return;
    currentRequestId++;
  });

  document.addEventListener('mouseup', (e) => {
    if (!qtEnabled) return;
    if (e.detail === 2) return; // handled by dblclick
    if (isInsideUI(e.target)) return;

    setTimeout(() => {
      const text = e.detail >= 3
        ? (getSentenceAtPoint(e.clientX, e.clientY) || getSelectedText())
        : getSelectedText();
      if (text) requestTranslation(text, e);
    }, 0);
  });

  function getSentenceAtPoint(x, y) {
    const range = document.caretRangeFromPoint(x, y);
    if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) return null;

    const BLOCK = /^(P|LI|TD|TH|DIV|SECTION|ARTICLE|BLOCKQUOTE|H[1-6]|FIGCAPTION|CAPTION)$/;
    let block = range.startContainer.parentElement;
    while (block && block !== document.body && !BLOCK.test(block.tagName)) {
      block = block.parentElement;
    }
    if (!block || block === document.body) block = range.startContainer.parentElement;

    let globalOffset = 0;
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let node, found = false;
    while ((node = walker.nextNode()) !== null) {
      if (node === range.startContainer) {
        globalOffset += range.startOffset;
        found = true;
        break;
      }
      globalOffset += node.textContent.length;
    }
    if (!found) return null;

    const text = block.textContent;
    const offset = globalOffset;
    const boundary = /[.!?。！？]['"'"\s]/g;
    let start = 0, end = text.length, m;
    while ((m = boundary.exec(text)) !== null) {
      const pos = m.index + 1;
      if (pos <= offset) start = pos;
      else { end = pos; break; }
    }
    return text.slice(start, end).trim() || null;
  }

  function getSelectedText() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return null;
    const text = sel.toString().trim();
    return text.length >= 2 ? text.slice(0, 5000) : null;
  }

  function isInsideUI(el) {
    return !!(el && el.closest && el.closest('[data-qt]'));
  }

  function requestTranslation(text, event) {
    if (!contextAlive) return;
    const context = getContext();
    const reqId = ++currentRequestId;
    show({ loading: true }, event);

    try {
      chrome.runtime.sendMessage({ type: 'translate', text }, (response) => {
        try {
          if (reqId !== currentRequestId) return;
          if (chrome.runtime.lastError) {
            show({ error: chrome.runtime.lastError.message }, event);
            return;
          }
          if (!response) {
            show({ error: '응답이 없습니다.' }, event);
            return;
          }
          if (response.error) {
            show({ error: response.error }, event);
            return;
          }
          show({ original: text, translated: response.translation }, event);
          saveHistory(text, response.translation, response.detectedLang, context);
        } catch { invalidate(); }
      });
    } catch { invalidate(); }
  }

  function getContext() {
    try {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return null;
      const range = sel.getRangeAt(0);
      if (range.startContainer.nodeType !== Node.TEXT_NODE) return null;
      const nodeText = range.startContainer.textContent;
      const start = range.startOffset;
      const selected = nodeText.slice(start, range.endOffset).trim();
      if (selected.length > 80) return selected.slice(0, 300);
      const boundary = /[.!?。！？]['"'"\s]/g;
      let sStart = 0, sEnd = nodeText.length, m;
      while ((m = boundary.exec(nodeText)) !== null) {
        const pos = m.index + 1;
        if (pos <= start) sStart = pos;
        else { sEnd = pos; break; }
      }
      return nodeText.slice(sStart, sEnd).trim().slice(0, 300) || null;
    } catch { return null; }
  }

  function saveHistory(text, translation, detectedLang, context) {
    if (!contextAlive) return;
    const key = text.toLowerCase().trim();
    const now = Date.now();
    try {
      chrome.storage.local.get(['translationHistory'], (data) => {
        try {
          const history = data.translationHistory || [];
          const idx = history.findIndex(item => item.key === key);
          if (idx !== -1) {
            history[idx].count++;
            history[idx].lastSeen = now;
            history[idx].translation = translation;
            if (context) history[idx].context = context;
            const [item] = history.splice(idx, 1);
            history.unshift(item);
          } else {
            history.unshift({
              key, text, translation,
              detectedLang: detectedLang || 'en',
              context: context || null,
              count: 1, firstSeen: now, lastSeen: now,
              favorite: false, status: 'new'
            });
            if (history.length > 500) history.length = 500;
          }
          chrome.storage.local.set({ translationHistory: history });
        } catch { invalidate(); }
      });
    } catch { invalidate(); }
  }

  function show(data, event) {
    if (cfg.displayMode === 'popup') renderPopup(data, event);
    else renderFloating(data);
  }

  function startHideTimer(el) {
    clearTimeout(hideTimer);
    if (cfg.autohideDuration <= 0) return;
    hideTimer = setTimeout(() => fadeOut(el), cfg.autohideDuration);
  }

  function fadeOut(el) {
    el.classList.add('qt-fadeout');
    el.addEventListener('animationend', () => {
      el.style.display = 'none';
      el.classList.remove('qt-fadeout');
    }, { once: true });
  }

  function bindHoverPause(el) {
    el.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    el.addEventListener('mouseleave', () => startHideTimer(el));
  }

  function renderPopup(data, event) {
    if (!popupEl) {
      popupEl = buildPopup();
      bindHoverPause(popupEl);
    }

    clearTimeout(hideTimer);
    popupEl.style.display = 'block';
    popupEl.classList.remove('qt-fadeout');

    setBody(popupEl.querySelector('.qt-body'), data);
    const isLong = data.original &&
      (data.original.length > 40 || data.original.trim().split(/\s+/).length > 3);
    popupEl.classList.toggle('qt-wide', !!isLong);
    positionPopup(popupEl);
    startHideTimer(popupEl);
  }

  function buildPopup() {
    const el = document.createElement('div');
    el.className = 'qt-popup';
    el.setAttribute('data-qt', '');
    el.innerHTML = `
      <div class="qt-body"></div>
      <button class="qt-close" title="닫기">✕</button>
    `;
    el.querySelector('.qt-close').addEventListener('click', () => {
      clearTimeout(hideTimer);
      el.style.display = 'none';
    });
    applyTheme(el);
    applyOpacity(el);
    document.documentElement.appendChild(el);
    return el;
  }

  function positionPopup(el) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const margin = 8;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    el.style.visibility = 'hidden';
    el.style.display = 'block';
    const elW = el.offsetWidth;
    const elH = el.offsetHeight;
    el.style.visibility = '';

    // 세로: 선택 위에 배치, 공간 부족 시 아래로, 이후 뷰포트 안으로 클램핑
    let top = rect.top + scrollY - elH - margin;
    if (top < scrollY + margin) top = rect.bottom + scrollY + margin;
    top = Math.min(top, scrollY + vh - elH - margin);
    top = Math.max(top, scrollY + margin);

    // 가로: 선택 중앙 정렬, 뷰포트 안으로 클램핑
    let left = rect.left + scrollX + rect.width / 2 - elW / 2;
    left = Math.max(scrollX + margin, Math.min(left, scrollX + vw - elW - margin));

    el.style.top  = top  + 'px';
    el.style.left = left + 'px';
  }

  function renderFloating(data) {
    if (!floatingEl) {
      floatingEl = buildFloating();
      bindHoverPause(floatingEl);
    }

    clearTimeout(hideTimer);
    floatingEl.style.display = 'flex';
    floatingEl.classList.remove('qt-fadeout');

    setBody(floatingEl.querySelector('.qt-body'), data);
    startHideTimer(floatingEl);
  }

  function buildFloating() {
    const el = document.createElement('div');
    el.className = 'qt-floating';
    el.setAttribute('data-qt', '');
    el.style.width = floatSize.width + 'px';
    el.style.height = floatSize.height + 'px';

    const left = floatPos.left !== null
      ? Math.max(0, Math.min(floatPos.left, window.innerWidth - floatSize.width))
      : window.innerWidth - floatSize.width - 20;
    const top = floatPos.top !== null
      ? Math.max(0, Math.min(floatPos.top, window.innerHeight - floatSize.height))
      : window.innerHeight - floatSize.height - 20;

    el.style.left = left + 'px';
    el.style.top = top + 'px';

    el.innerHTML = `
      <div class="qt-drag-handle">
        <button class="qt-close" title="닫기">✕</button>
      </div>
      <div class="qt-body qt-float-body"></div>
    `;

    el.querySelector('.qt-close').addEventListener('click', () => {
      clearTimeout(hideTimer);
      el.style.display = 'none';
    });

    applyTheme(el);
    applyOpacity(el);
    makeDraggable(el, el.querySelector('.qt-drag-handle'));
    watchResize(el);

    document.documentElement.appendChild(el);
    return el;
  }

  function makeDraggable(el, handle) {
    handle.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('qt-close')) return;
      e.preventDefault();

      const startX = e.clientX;
      const startY = e.clientY;
      const startLeft = el.offsetLeft;
      const startTop = el.offsetTop;

      document.body.style.userSelect = 'none';
      el.classList.add('qt-dragging');

      const onMove = (e) => {
        const newLeft = Math.max(0, Math.min(startLeft + e.clientX - startX, window.innerWidth - el.offsetWidth));
        const newTop = Math.max(0, Math.min(startTop + e.clientY - startY, window.innerHeight - el.offsetHeight));
        el.style.left = newLeft + 'px';
        el.style.top = newTop + 'px';
      };

      const onUp = () => {
        document.body.style.userSelect = '';
        el.classList.remove('qt-dragging');
        floatPos = { left: el.offsetLeft, top: el.offsetTop };
        try { chrome.storage.local.set({ floatingPosition: floatPos }); } catch { invalidate(); }
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  function watchResize(el) {
    const ro = new ResizeObserver(() => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w !== floatSize.width || h !== floatSize.height) {
        floatSize = { width: w, height: h };
        try { chrome.storage.local.set({ floatingSize: floatSize }); } catch { invalidate(); }
      }
    });
    ro.observe(el);
  }

  function setBody(body, data) {
    if (data.loading) {
      body.innerHTML = '<div class="qt-loading"><span></span><span></span><span></span></div>';
      return;
    }
    if (data.error) {
      body.innerHTML = `<div class="qt-error">${esc(data.error)}</div>`;
      return;
    }
    body.innerHTML = `<div class="qt-result">${esc(data.translated)}</div>`;
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
