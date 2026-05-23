document.addEventListener('DOMContentLoaded', () => {
  let allHistory = [];
  let filtered   = [];
  let currentFilter = 'all';
  let currentSort   = 'recent';
  let searchQuery   = '';

  const statusNext  = { new: 'learning', learning: 'done', done: 'new' };
  const statusLabel = { new: '새 단어', learning: '학습중', done: '완료' };
  const langMap     = { en: 'en-US', fr: 'fr-FR', de: 'de-DE', es: 'es-ES', ja: 'ja-JP', zh: 'zh-CN' };

  chrome.storage.sync.get(['theme'], (data) => applyTheme(data.theme || 'system'));

  function applyTheme(theme) {
    document.documentElement.classList.remove('qt-dark', 'qt-light');
    if (theme === 'dark')  document.documentElement.classList.add('qt-dark');
    if (theme === 'light') document.documentElement.classList.add('qt-light');
  }

  chrome.storage.local.get(['translationHistory'], (data) => {
    allHistory = data.translationHistory || [];
    update();
  });

  function update() {
    filtered = buildFiltered();
    renderList();
    renderStats();
  }

  function renderStats() {
    const counts = {
      all:      allHistory.length,
      new:      allHistory.filter(i => i.status === 'new').length,
      learning: allHistory.filter(i => i.status === 'learning').length,
      done:     allHistory.filter(i => i.status === 'done').length,
      favorite: allHistory.filter(i => i.favorite).length,
      wrong:    allHistory.filter(i => i.wrongCount > 0).length,
    };
    document.querySelectorAll('.filter-count[data-count]').forEach(el => {
      const n = counts[el.dataset.count];
      el.textContent = n !== undefined ? n : '';
    });
  }

  function buildFiltered() {
    let items = [...allHistory];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i =>
        i.text.toLowerCase().includes(q) || i.translation.toLowerCase().includes(q)
      );
    }
    if (currentFilter === 'favorite') items = items.filter(i => i.favorite);
    else if (currentFilter === 'wrong') items = items.filter(i => i.wrongCount > 0);
    else if (currentFilter !== 'all') items = items.filter(i => i.status === currentFilter);

    if (currentSort === 'frequency') items.sort((a, b) => b.count - a.count);
    else if (currentSort === 'alpha') items.sort((a, b) => a.text.localeCompare(b.text));
    return items;
  }

  function renderList() {
    const list  = document.getElementById('historyList');
    const empty = document.getElementById('emptyState');
    if (filtered.length === 0) {
      list.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    list.innerHTML = '';
    filtered.forEach(item => list.appendChild(buildItem(item)));
  }

  function buildItem(item) {
    const el = document.createElement('div');
    el.className = 'history-item';

    const isSingleWord = !item.text.trim().includes(' ');
    const verbForms = isSingleWord ? conjugate(item.text) : null;

    const hasBottom = verbForms || isSingleWord;
    const bottomHTML = hasBottom ? `
      <div class="item-bottom">
        ${verbForms ? buildVerbHTML(verbForms) : ''}
        ${isSingleWord ? `<div class="syn-row" data-word="${esc(item.text)}"><span class="extra-label">유의어</span><span class="syn-loading">…</span></div>` : ''}
      </div>` : '';

    el.innerHTML = `
      <div class="item-top">
        <div class="item-main">
          <div class="item-text">${esc(item.text)}${item.wrongCount > 0 ? `<span class="wrong-badge">오답 ${item.wrongCount}</span>` : ''}</div>
          <div class="item-trans-row"></div>
          ${item.context ? `<div class="item-context">"${esc(item.context)}"</div>` : ''}
          <div class="item-date">${fmtDate(item.lastSeen)}</div>
        </div>
        <div class="item-right">
          <div class="item-meta">
            <button class="btn-status status-${item.status}">${statusLabel[item.status]}</button>
            <button class="btn-icon btn-delete" title="삭제">×</button>
          </div>
          <div class="item-meta">
            <span class="item-count">×${item.count}</span>
            <button class="btn-icon btn-speak" title="발음 듣기">🔊</button>
            <button class="btn-icon btn-fav${item.favorite ? ' is-fav' : ''}" title="즐겨찾기">★</button>
          </div>
        </div>
      </div>
      ${bottomHTML}
    `;

    renderTransRow(el.querySelector('.item-trans-row'), item);

    el.addEventListener('click', (e) => {
      if (e.target.closest('.btn-icon, .btn-status')) return;
      openDetail(item);
    });

    el.querySelector('.btn-speak').addEventListener('click', (e) => {
      e.stopPropagation();
      speak(item.text, item.detectedLang);
    });

    el.querySelector('.btn-fav').addEventListener('click', (e) => {
      e.stopPropagation();
      item.favorite = !item.favorite;
      e.currentTarget.classList.toggle('is-fav', item.favorite);
      persist();
      if (currentFilter === 'favorite') update();
    });

    el.querySelector('.btn-status').addEventListener('click', (e) => {
      e.stopPropagation();
      item.status = statusNext[item.status];
      const btn = e.currentTarget;
      btn.className = `btn-status status-${item.status}`;
      btn.textContent = statusLabel[item.status];
      persist();
      if (currentFilter !== 'all' && currentFilter !== 'favorite') update();
    });

    el.querySelector('.btn-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = allHistory.findIndex(i => i.key === item.key);
      if (idx !== -1) {
        allHistory.splice(idx, 1);
        persist();
        update();
      }
    });

    if (isSingleWord) {
      fetchSynonyms(item.text).then(syns => {
        const synRow = el.querySelector('.syn-row');
        if (!synRow) return;
        if (syns.length === 0) { synRow.style.display = 'none'; return; }
        synRow.innerHTML = `<span class="extra-label">유의어</span>${syns.map(s => `<span class="chip">${esc(s)}</span>`).join('')}`;
      });
    }

    return el;
  }

  function buildVerbHTML(forms) {
    const rows = [
      ['원형', forms.base], ['3인칭', forms.third],
      ['현재분사', forms.ing], ['과거', forms.past], ['과거분사', forms.pp],
    ];
    const chips = rows.map(([label, val]) =>
      `<span class="verb-chip"><span class="verb-label">${label}</span>${esc(val)}</span>`
    ).join('');
    return `<div class="verb-row"><span class="extra-label">동사 활용</span>${chips}</div>`;
  }

  const detailModal    = document.getElementById('detailModal');
  const detailBackdrop = detailModal.querySelector('.detail-backdrop');
  const detailClose    = detailModal.querySelector('.detail-close');

  detailBackdrop.addEventListener('click', closeDetail);
  detailClose.addEventListener('click', closeDetail);

  function openDetail(item) {
    document.getElementById('detailText').textContent = item.text;
    const detailTransEl = document.getElementById('detailTrans');
    detailTransEl.textContent = item.translation;
    detailTransEl.style.cursor = 'text';
    detailTransEl.title = '클릭하여 번역 수정';
    detailTransEl.onclick = () => {
      const cur = item.translation;
      const input = document.createElement('input');
      input.type = 'text';
      input.value = cur;
      input.className = 'detail-trans-input';
      detailTransEl.replaceWith(input);
      input.focus();
      input.setSelectionRange(0, input.value.length);
      const finalize = () => {
        const newVal = input.value.trim();
        if (newVal && newVal !== cur) {
          item.translation = newVal;
          item.customTranslation = true;
          persist();
        }
        const restored = document.createElement('div');
        restored.id = 'detailTrans';
        restored.className = 'detail-trans';
        restored.textContent = item.translation;
        input.replaceWith(restored);
        openDetail(item);
      };
      input.addEventListener('blur', finalize);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { input.blur(); } if (e.key === 'Escape') { input.value = cur; input.blur(); } });
    };

    const ctxEl = document.getElementById('detailCtx');
    ctxEl.textContent = item.context ? `"${item.context}"` : '';
    ctxEl.style.display = item.context ? 'block' : 'none';

    const verbEl = document.getElementById('detailVerb');
    const isSingle = !item.text.trim().includes(' ');
    const forms = isSingle ? conjugate(item.text) : null;
    if (forms) {
      verbEl.innerHTML = buildVerbHTML(forms);
      verbEl.style.display = 'block';
    } else {
      verbEl.style.display = 'none';
    }

    const synEl = document.getElementById('detailSyn');
    synEl.innerHTML = `<span class="extra-label">유의어</span><span class="syn-loading">…</span>`;
    synEl.style.display = isSingle ? 'flex' : 'none';
    if (isSingle) {
      fetchSynonyms(item.text).then(syns => {
        if (syns.length === 0) { synEl.style.display = 'none'; return; }
        synEl.innerHTML = `<span class="extra-label">유의어</span>${syns.map(s => `<span class="chip">${esc(s)}</span>`).join('')}`;
      });
    }

    detailModal.style.display = 'flex';
  }

  function closeDetail() {
    detailModal.style.display = 'none';
  }

  const synCache = {};

  async function fetchSynonyms(word) {
    const key = word.toLowerCase();
    if (synCache[key] !== undefined) return synCache[key];
    try {
      const res  = await fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(key)}&max=8`);
      const json = await res.json();
      const words = json.map(r => r.word).filter(w => w !== key);
      synCache[key] = words;
      return words;
    } catch {
      synCache[key] = [];
      return [];
    }
  }

  function speak(text, lang) {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = langMap[lang] || lang || 'en-US';
    window.speechSynthesis.speak(utter);
  }

  document.getElementById('searchInput').addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    update();
  });

  document.getElementById('sortSelect').addEventListener('change', (e) => {
    currentSort = e.target.value;
    update();
  });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      update();
    });
  });

  document.getElementById('aiLearnBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('ai-learning.html') });
  });

  document.getElementById('clearBtn').addEventListener('click', () => {
    if (!confirm('번역 기록을 모두 삭제할까요?')) return;
    allHistory = [];
    chrome.storage.local.remove('translationHistory');
    update();
  });

  function persist() {
    chrome.storage.local.set({ translationHistory: allHistory });
  }

  let quizItems = [];
  let quizIdx   = 0;

  function isParagraph(text) {
    if (text.length > 200) return true;
    return (text.match(/[.!?。！？]/g) || []).length >= 3;
  }

  document.getElementById('quizBtn').addEventListener('click', () => {
    const deck = filtered.filter(i => i.status !== 'done' && !isParagraph(i.text));
    if (deck.length === 0) {
      alert('퀴즈할 단어가 없습니다.\n학습 상태가 완료가 아닌 단어가 필요합니다.');
      return;
    }
    quizItems = [...deck].sort(() => Math.random() - 0.5);
    quizIdx   = 0;
    showCard();
    document.getElementById('quizOverlay').style.display = 'flex';
  });

  document.getElementById('quizClose').addEventListener('click', closeQuiz);

  document.getElementById('quizFav').addEventListener('click', (e) => {
    e.stopPropagation();
    const item = quizItems[quizIdx];
    if (!item) return;
    item.favorite = !item.favorite;
    e.currentTarget.classList.toggle('is-fav', item.favorite);
    persist();
  });

  document.getElementById('quizCard').addEventListener('click', () => {
    const card = document.getElementById('quizCard');
    if (card.classList.contains('revealed')) return;
    card.classList.add('revealed');
  });

  document.getElementById('quizSpeak').addEventListener('click', (e) => {
    e.stopPropagation();
    const item = quizItems[quizIdx];
    if (item) speak(item.text, item.detectedLang);
  });

  document.getElementById('quizKnow').addEventListener('click',     (e) => { e.stopPropagation(); updateQuizItem('done'); });
  document.getElementById('quizDontKnow').addEventListener('click', (e) => { e.stopPropagation(); updateQuizItem('learning'); });
  document.getElementById('quizDelete').addEventListener('click',   (e) => {
    e.stopPropagation();
    const item = quizItems[quizIdx];
    if (!item) return;
    const idx = allHistory.findIndex(i => i.key === item.key);
    if (idx !== -1) { allHistory.splice(idx, 1); persist(); }
    quizItems.splice(quizIdx, 1);
    if (quizItems.length === 0) { closeQuiz(); update(); return; }
    if (quizIdx >= quizItems.length) quizIdx = quizItems.length - 1;
    showCard();
  });

  function updateQuizItem(status) {
    const item = quizItems[quizIdx];
    if (!item) return;
    item.status = status;
    persist();
    quizIdx++;
    if (quizIdx >= quizItems.length) {
      closeQuiz();
      update();
      alert(`퀴즈 완료! ${quizItems.length}개의 단어를 검토했습니다.`);
    } else {
      showCard();
    }
  }

  function showCard() {
    const item = quizItems[quizIdx];
    const card = document.getElementById('quizCard');
    card.classList.remove('revealed');

    document.getElementById('quizWord').textContent        = item.text;
    document.getElementById('quizTranslation').textContent = item.translation;
    const ctxEl = document.getElementById('quizCtx');
    ctxEl.textContent   = item.context ? `"${item.context}"` : '';
    ctxEl.style.display = item.context ? 'block' : 'none';
    document.getElementById('quizProgress').textContent = `${quizIdx + 1} / ${quizItems.length}`;
    document.getElementById('quizFav').classList.toggle('is-fav', !!item.favorite);
  }

  function closeQuiz() {
    window.speechSynthesis.cancel();
    document.getElementById('quizOverlay').style.display = 'none';
  }

  function renderTransRow(transRow, item) {
    transRow.innerHTML = `
      <div class="item-translation">${esc(item.translation)}${item.customTranslation ? '<span class="custom-badge">수정됨</span>' : ''}</div>
      <button class="btn-icon btn-edit-trans" title="번역 수정">✎</button>`;
    transRow.querySelector('.btn-edit-trans').addEventListener('click', (e) => {
      e.stopPropagation();
      const current = item.translation;
      transRow.innerHTML = `
        <input class="trans-edit-input" type="text" value="${esc(current)}">
        <button class="btn-trans-save">저장</button>
        <button class="btn-trans-cancel">취소</button>`;
      const input = transRow.querySelector('.trans-edit-input');
      input.focus();
      input.setSelectionRange(0, input.value.length);
      const commit = () => {
        const newVal = input.value.trim();
        if (newVal && newVal !== current) {
          item.translation = newVal;
          item.customTranslation = true;
          persist();
        }
        renderTransRow(transRow, item);
      };
      const cancel = () => renderTransRow(transRow, item);
      transRow.querySelector('.btn-trans-save').addEventListener('click', commit);
      transRow.querySelector('.btn-trans-cancel').addEventListener('click', cancel);
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') commit();
        if (ev.key === 'Escape') cancel();
      });
    });
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmtDate(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000)     return '방금';
    if (diff < 3600000)   return `${Math.floor(diff / 60000)}분 전`;
    if (diff < 86400000)  return `${Math.floor(diff / 3600000)}시간 전`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}일 전`;
    return new Date(ts).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  }
});
