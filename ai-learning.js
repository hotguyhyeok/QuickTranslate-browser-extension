document.addEventListener('DOMContentLoaded', () => {

  // ── System Prompt ──────────────────────────────────────────────────────────
  const SYSTEM_PROMPT = `You are an English tutor embedded in a browser extension. Help the user practice and understand English words and expressions from their learning history.

## Rules
1. Explain in Korean; use English for language examples only.
2. Match difficulty and tone to the user's level inferred from their history. Don't over-explain to advanced users.
3. One learning objective per response. Never combine modes unless explicitly asked.
4. Use only natural, standard English. Never invent expressions.
5. Correct errors gently with a brief explanation.

## Modes

**REVIEW** — Select N words (least-recently-seen first). For each: word + part of speech / Korean definition (1–2 sentences) / one natural example sentence.

**SYNONYMS** — For the target word: 2–4 synonyms with Korean nuance notes and one example sentence each. Note which is most natural in everyday speech.

**EXAMPLES** — For the target word: 3 sentences varying in register (formal/informal), type (statement/question/negative), or context (work/daily/academic). Add a one-line Korean note per sentence.

**QUIZ** — Present ONE question at a time. Never reveal the answer before the user responds.
- words[] items → Fill-in-the-blank or Korean→English
- sentences[] items → Sentence Translation (EN→KO) or Error Correction
- If one array is empty, use only its applicable types. Distribute types evenly.
- Fill-in-the-blank: remove one word, show as ________. Add Korean hint if needed.
- Korean→English: give Korean definition + usage hint, ask for the English word.
- Sentence Translation: full sentence, evaluate overall Korean comprehension.
- Error Correction: one grammatical/vocabulary error; ask user to identify and rewrite.
After each answer → ✓ Correct: reinforce usage / △ Partial (Translation only): note correct meaning, suggest natural phrasing / ✗ Incorrect: gentle correction + Korean explanation.

**CHAT** — Free tutoring. Reference vocabulary when relevant; broader questions welcome.
First message: {"mode":"CHAT","vocabulary":[...],"message":"..."}. After that: plain text.

## Request Format
{"mode":"REVIEW"|"SYNONYMS"|"EXAMPLES"|"QUIZ"|"CHAT","target":"word","count":N,"history":[...],"words":[...],"sentences":[...]}
Parse this and respond only in the format for the given mode.`;

  // ── Model constants ────────────────────────────────────────────────────────
  const MODELS = [
    { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B' },
    { id: 'llama-3.3-70b-versatile',                   label: 'Llama 3.3 70B' },
    { id: 'qwen/qwen3-32b',                            label: 'Qwen3 32B' },
    { id: 'groq/compound',                             label: 'Compound' },
    { id: 'groq/compound-mini',                        label: 'Compound Mini' },
    { id: 'openai/gpt-oss-120b',                       label: 'GPT-OSS 120B' },
    { id: 'openai/gpt-oss-20b',                        label: 'GPT-OSS 20B' },
    { id: 'llama-3.1-8b-instant',                      label: 'Llama 3.1 8B' },
    { id: 'allam-2-7b',                                label: 'Allam 2 7B' },
    { id: 'meta-llama/llama-prompt-guard-2-22m',       label: 'Prompt Guard 22M' },
    { id: 'meta-llama/llama-prompt-guard-2-86m',       label: 'Prompt Guard 86M' },
    { id: 'openai/gpt-oss-safeguard-20b',              label: 'GPT-OSS Safeguard 20B' },
  ];

  const FALLBACK_CHAIN = [
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'llama-3.3-70b-versatile',
    'qwen/qwen3-32b',
    'groq/compound',
    'groq/compound-mini',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'llama-3.1-8b-instant',
    'allam-2-7b',
  ];

  // ── State ──────────────────────────────────────────────────────────────────
  let currentMode         = 'REVIEW';
  let conversationHistory = [];
  let isQuizActive        = false;
  let studyItems          = [];
  let groqApiKey          = '';
  let preferredModel      = FALLBACK_CHAIN[0];
  let currentModel        = preferredModel;
  let quizSessionWords    = [];

  // ── Elements ───────────────────────────────────────────────────────────────
  const executeBtn          = document.getElementById('executeBtn');
  const executeBtnWord      = document.getElementById('executeBtnWord');
  const submitAnswerBtn     = document.getElementById('submitAnswer');
  const countInputEl        = document.getElementById('countInput');
  const wordSelectEl        = document.getElementById('wordSelect');
  const answerInputEl       = document.getElementById('answerInput');
  const responseContentEl   = document.getElementById('responseContent');
  const responsePlaceholder = document.getElementById('responsePlaceholder');
  const answerArea          = document.getElementById('answerArea');
  const resetArea           = document.getElementById('resetArea');

  // ── Init ───────────────────────────────────────────────────────────────────
  chrome.storage.sync.get(['theme', 'groqApiKey', 'preferredModel'], (data) => {
    applyTheme(data.theme || 'system');
    groqApiKey     = data.groqApiKey || '';
    preferredModel = data.preferredModel || FALLBACK_CHAIN[0];
    currentModel   = preferredModel;
    if (groqApiKey) setCollapsedState();
    renderModelSelect();
  });

  chrome.storage.local.get(['translationHistory'], (data) => {
    const all = data.translationHistory || [];
    studyItems = all.filter(i => !isParagraph(i.text));
    populateWordSelect();
  });

  function applyTheme(theme) {
    document.documentElement.classList.remove('qt-dark', 'qt-light');
    if (theme === 'dark')  document.documentElement.classList.add('qt-dark');
    if (theme === 'light') document.documentElement.classList.add('qt-light');
  }

  function isParagraph(text) {
    return text.length > 200 || (text.match(/[.!?。！？]/g) || []).length >= 3;
  }

  function isWord(text) {
    return text.trim().split(/\s+/).length <= 2;
  }

  function populateWordSelect() {
    const items = [...studyItems]
      .filter(i => isWord(i.text))
      .sort((a, b) => a.text.localeCompare(b.text));
    wordSelectEl.innerHTML = items.length
      ? items.map(i => `<option value="${esc(i.text)}">${esc(i.text)} — ${esc(i.translation)}</option>`).join('')
      : '<option value="" disabled>단어가 없습니다</option>';
  }

  function renderModelSelect() {
    const sel = document.getElementById('modelSelect');
    if (!sel) return;
    sel.innerHTML = MODELS.map(m =>
      `<option value="${m.id}"${m.id === preferredModel ? ' selected' : ''}>${m.label}</option>`
    ).join('');
  }

  document.getElementById('modelSelect')?.addEventListener('change', (e) => {
    preferredModel = e.target.value;
    currentModel   = preferredModel;
    chrome.storage.sync.set({ preferredModel });
    document.getElementById('modelStatus').textContent = '';
  });

  // ── Navigation ─────────────────────────────────────────────────────────────
  document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = chrome.runtime.getURL('history.html');
  });

  // ── API Key ────────────────────────────────────────────────────────────────
  document.getElementById('apiKeySave').addEventListener('click', () => {
    const key = document.getElementById('apiKeyInput').value.trim();
    if (!key) return;
    groqApiKey = key;
    chrome.storage.sync.set({ groqApiKey: key }, setCollapsedState);
  });

  document.getElementById('changeKeyBtn').addEventListener('click', () => {
    document.getElementById('setupCollapsed').style.display = 'none';
    document.getElementById('setupExpanded').style.display  = 'block';
    const input = document.getElementById('apiKeyInput');
    input.value       = '';
    input.placeholder = 'gsk_...';
    input.disabled    = false;
    document.getElementById('apiKeySave').disabled    = false;
    document.getElementById('apiKeySave').textContent = '저장';
    input.focus();
  });

  function setCollapsedState() {
    document.getElementById('setupExpanded').style.display  = 'none';
    document.getElementById('setupCollapsed').style.display = 'flex';
  }

  // ── Mode Tabs ──────────────────────────────────────────────────────────────
  const MODE_CONFIG = {
    REVIEW:   { btnText: '복습 시작',   showCount: true,  showWord: false, freeChat: false },
    SYNONYMS: { btnText: '유의어 분석', showCount: false, showWord: true,  freeChat: false },
    EXAMPLES: { btnText: '예문 생성',   showCount: false, showWord: true,  freeChat: false },
    QUIZ:     { btnText: '퀴즈 시작',   showCount: true,  showWord: false, freeChat: false },
    FREECHAT: { btnText: null,          showCount: false, showWord: false, freeChat: true  },
  };

  document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentMode = tab.dataset.mode;
      applyModeUI();
      resetSession();
    });
  });

  function applyModeUI() {
    const cfg = MODE_CONFIG[currentMode];
    document.getElementById('configCount').style.display = cfg.showCount ? 'block' : 'none';
    document.getElementById('configWord').style.display  = cfg.showWord  ? 'block' : 'none';

    if (cfg.freeChat) {
      document.getElementById('executeRow').style.display = 'none';
      answerArea.style.display  = 'flex';
      answerInputEl.placeholder = '무엇이든 물어보세요...';
    } else {
      document.getElementById('executeRow').style.display = '';
      executeBtn.textContent     = cfg.btnText;
      executeBtnWord.textContent = cfg.btnText;
      answerInputEl.placeholder  = currentMode === 'QUIZ' ? '답변을 입력하세요...' : '궁금한 점을 물어보세요...';
    }
  }

  // ── Execute ────────────────────────────────────────────────────────────────
  executeBtn.addEventListener('click', startLearning);
  executeBtnWord.addEventListener('click', startLearning);

  async function startLearning() {
    if (currentMode === 'FREECHAT') return;
    if (!groqApiKey) { promptApiKeySetup(); return; }

    conversationHistory = [];
    isQuizActive = currentMode === 'QUIZ';

    let payload;

    if (currentMode === 'REVIEW') {
      payload = buildReviewHistory();
      if (payload.length === 0) {
        const hint = getScope() === 'all'
          ? '번역 기록에 항목이 없습니다.'
          : '번역 기록에서 단어 상태를 “새 단어” 또는 “학습중”으로 설정하거나, 범위를 “전체”로 바꿔보세요.';
        showInitial(`<div class=”response-error”>학습할 단어가 없습니다.<br><small>${hint}</small></div>`);
        return;
      }
    } else if (currentMode === 'QUIZ') {
      payload = buildQuizHistory();
      if (payload.words.length + payload.sentences.length === 0) {
        const hint = getScope() === 'all'
          ? '번역 기록에 항목이 없습니다.'
          : '번역 기록에서 단어 상태를 “새 단어” 또는 “학습중”으로 설정하거나, 범위를 “전체”로 바꿔보세요.';
        showInitial(`<div class=”response-error”>학습할 단어가 없습니다.<br><small>${hint}</small></div>`);
        return;
      }
    } else {
      if (!wordSelectEl.value) {
        showInitial('<div class=”response-error”>단어를 선택해주세요.</div>');
        return;
      }
      payload = null;
    }

    const request = buildRequest(payload);
    await callAI(JSON.stringify(request, null, 2), true);

    answerArea.style.display = 'flex';
    resetArea.style.display  = 'block';
  }

  function buildRequest(payload) {
    const count = getCount();
    switch (currentMode) {
      case 'REVIEW':
        return { mode: 'REVIEW', count: isFinite(count) ? count : payload.length, history: payload };
      case 'SYNONYMS':
        return { mode: 'SYNONYMS', target: wordSelectEl.value };
      case 'EXAMPLES':
        return { mode: 'EXAMPLES', target: wordSelectEl.value };
      case 'QUIZ':
        return {
          mode: 'QUIZ',
          count: isFinite(count) ? count : payload.words.length + payload.sentences.length,
          words: payload.words,
          sentences: payload.sentences,
          critical_instructions: [
            'Show ONLY Q1 in this response. Never output Q2 or beyond in the same message.',
            'Do NOT include the answer or explanation when presenting a question.',
            'Leave the answer blank. Wait for the user to respond first.'
          ]
        };
    }
  }

  function getScope() {
    return document.getElementById('scopeSelect')?.value || 'active';
  }

  function buildReviewHistory() {
    const scopeAll = getScope() === 'all';
    const count = getCount();
    return [...studyItems]
      .filter(i => scopeAll || i.status !== 'done')
      .sort((a, b) => a.lastSeen - b.lastSeen)
      .slice(0, isFinite(count) ? count * 3 : undefined)
      .map(i => i.text);
  }

  function buildQuizHistory() {
    const scopeAll = getScope() === 'all';
    const count = getCount();
    const pool = [...studyItems]
      .filter(i => scopeAll || i.status !== 'done')
      .sort(() => Math.random() - 0.5)
      .slice(0, isFinite(count) ? count * 4 : undefined);
    quizSessionWords = pool.map(i => i.text);
    return {
      words:     pool.filter(i =>  isWord(i.text)).map(i => i.text),
      sentences: pool.filter(i => !isWord(i.text)).map(i => i.text)
    };
  }

  function buildFreeChatVocabulary() {
    return studyItems
      .filter(i => i.status === 'new' || i.status === 'learning')
      .map(i => i.text);
  }


  document.getElementById('countAllBtn').addEventListener('click', () => {
    const btn = document.getElementById('countAllBtn');
    const isAll = btn.classList.toggle('active');
    countInputEl.disabled = isAll;
  });

  function getCount() {
    if (document.getElementById('countAllBtn')?.classList.contains('active')) return Infinity;
    return Math.max(1, Math.min(20, parseInt(countInputEl.value) || 5));
  }

  // ── Groq API ───────────────────────────────────────────────────────────────
  function isQuotaError(status, message) {
    if (status === 401 || status === 403) return false; // 인증 오류 — API 키 문제, 폴백 불가
    if (status === 400 || status === 413 || status === 429) return true;
    if (status >= 500) return true; // 서버 오류
    const m = (message || '').toLowerCase();
    return m.includes('quota')
        || m.includes('rate limit')
        || m.includes('too many')
        || m.includes('too large')
        || m.includes('context_length')
        || m.includes('tokens per minute')
        || m.includes('tpm');
  }

  function tryFallback() {
    let idx = FALLBACK_CHAIN.indexOf(currentModel);
    // FALLBACK_CHAIN에 없는 모델(prompt-guard 등)은 체인 시작점(0)에서 시작
    if (idx < 0) idx = 0;
    if (idx >= FALLBACK_CHAIN.length - 1) return false;
    currentModel = FALLBACK_CHAIN[idx + 1];
    const label = MODELS.find(m => m.id === currentModel)?.label || currentModel;
    const statusEl = document.getElementById('modelStatus');
    if (statusEl) statusEl.textContent = `${label} (한도 초과로 전환됨)`;
    const sel = document.getElementById('modelSelect');
    if (sel) sel.value = currentModel;
    return true;
  }

  async function callAI(userMessage, isFirst = false, retryCount = 0) {
    if (retryCount === 0) {
      conversationHistory.push({ role: 'user', content: userMessage });
      setBusy(true, isFirst);
    }

    let reply = null;
    let errorMsg = null;

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqApiKey}`
        },
        body: JSON.stringify({
          model: currentModel,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...conversationHistory
          ],
          temperature: 0.7,
          max_tokens: 1500
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err?.error?.message || `HTTP ${res.status}`;
        if (isQuotaError(res.status, msg) && retryCount < FALLBACK_CHAIN.length && tryFallback()) {
          return callAI(userMessage, isFirst, retryCount + 1);
        }
        errorMsg = msg;
      } else {
        const data = await res.json();
        reply = data.choices?.[0]?.message?.content || '';
      }
    } catch (e) {
      errorMsg = e.message;
    }

    setBusy(false);

    if (reply !== null) {
      conversationHistory.push({ role: 'assistant', content: reply });
      if (isFirst) showInitial(renderAI(reply));
      else         appendBlock(renderAI(reply));
    } else {
      // 실패 시 추가했던 user 메시지 롤백 → 다음 입력에 토큰 누적 방지
      conversationHistory.pop();
      const errHtml = `<div class="response-error">오류: ${esc(errorMsg)}<br><small>API 키를 확인하거나 잠시 후 다시 시도해주세요.</small></div>`;
      if (isFirst) showInitial(errHtml);
      else         appendBlock(errHtml);
    }
  }

  // ── Quiz Answer ────────────────────────────────────────────────────────────
  submitAnswerBtn.addEventListener('click', submitAnswer);
  answerInputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      submitAnswer();
    }
  });
  answerInputEl.addEventListener('input', () => {
    answerInputEl.style.height = 'auto';
    answerInputEl.style.height = Math.min(answerInputEl.scrollHeight, 120) + 'px';
  });

  async function submitAnswer() {
    const answer = answerInputEl.value.trim();
    if (!answer || submitAnswerBtn.disabled) return;
    answerInputEl.value = '';
    answerInputEl.style.height = 'auto';

    const bubble = document.createElement('div');
    bubble.className   = 'user-bubble';
    bubble.textContent = answer;
    responseContentEl.appendChild(bubble);
    bubble.scrollIntoView({ behavior: 'smooth', block: 'end' });

    if (currentMode === 'FREECHAT' && conversationHistory.length === 0) {
      const req = { mode: 'CHAT', vocabulary: buildFreeChatVocabulary(), message: answer };
      resetArea.style.display = 'block';
      await callAI(JSON.stringify(req, null, 2), true);
    } else {
      await callAI(answer);
    }
  }

  // ── Display ────────────────────────────────────────────────────────────────
  function showInitial(html) {
    responsePlaceholder.style.display = 'none';
    responseContentEl.innerHTML = html;
  }

  function appendBlock(html) {
    document.getElementById('loadingEl')?.remove();
    const wrapper = document.createElement('div');
    wrapper.className = 'append-block';
    wrapper.innerHTML = html;
    responseContentEl.appendChild(wrapper);
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  function setBusy(on, isFirst = false) {
    [executeBtn, executeBtnWord, submitAnswerBtn].forEach(b => b.disabled = on);
    answerInputEl.disabled = on;

    if (on) {
      const el = document.createElement('div');
      el.id        = 'loadingEl';
      el.className = 'response-loading';
      el.textContent = '생성 중...';
      if (isFirst) {
        responsePlaceholder.style.display = 'none';
        responseContentEl.innerHTML = '';
      }
      responseContentEl.appendChild(el);
    } else {
      document.getElementById('loadingEl')?.remove();
    }
  }

  function renderAI(text) {
    const escape = s => s
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const inline = raw => {
      let s = escape(raw);
      s = s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/\*(.*?)\*/g, '<em>$1</em>');
      s = s.replace(/_(.*?)_/g, '<em>$1</em>');
      s = s.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');
      return s;
    };

    const lines = text.split('\n');
    let html = '';
    let inCode = false;
    let codeLines = [];
    let inUl = false;
    let inOl = false;
    let tableBuf = [];

    const closeList = () => {
      if (inUl) { html += '</ul>'; inUl = false; }
      if (inOl) { html += '</ol>'; inOl = false; }
    };

    const flushTable = () => {
      if (!tableBuf.length) return;
      const parseRow = r => r.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim());
      const isSep   = r => /^[\s|:\-]+$/.test(r);
      const headers  = parseRow(tableBuf[0]);
      const dataRows = tableBuf.length > 2 ? tableBuf.slice(2) : [];
      let t = '<table class="md-table"><thead><tr>';
      headers.forEach(c => { t += `<th>${inline(c)}</th>`; });
      t += '</tr></thead>';
      if (dataRows.length) {
        t += '<tbody>';
        dataRows.forEach(row => {
          t += '<tr>';
          parseRow(row).forEach(c => { t += `<td>${inline(c)}</td>`; });
          t += '</tr>';
        });
        t += '</tbody>';
      }
      t += '</table>';
      html += t;
      tableBuf = [];
    };

    for (const line of lines) {
      if (/^```/.test(line)) {
        if (!inCode) {
          closeList(); flushTable();
          inCode = true; codeLines = [];
        } else {
          inCode = false;
          html += `<pre class="md-pre"><code>${escape(codeLines.join('\n'))}</code></pre>`;
          codeLines = [];
        }
        continue;
      }
      if (inCode) { codeLines.push(line); continue; }

      if (/^\s*\|/.test(line)) {
        closeList();
        tableBuf.push(line);
        continue;
      } else {
        flushTable();
      }

      const isList = /^[-*] /.test(line) || /^\d+\. /.test(line);
      if (!isList) closeList();

      if      (/^### /.test(line))          html += `<h3>${inline(line.slice(4))}</h3>`;
      else if (/^## /.test(line))           html += `<h2>${inline(line.slice(3))}</h2>`;
      else if (/^# /.test(line))            html += `<h1>${inline(line.slice(2))}</h1>`;
      else if (/^-{3,}$/.test(line.trim())) html += '<hr class="ai-divider">';
      else if (/^> /.test(line))            html += `<blockquote>${inline(line.slice(2))}</blockquote>`;
      else if (/^[-*] /.test(line)) {
        if (!inUl) { html += '<ul>'; inUl = true; }
        html += `<li>${inline(line.slice(2))}</li>`;
      }
      else if (/^\d+\. /.test(line)) {
        if (!inOl) { html += '<ol>'; inOl = true; }
        html += `<li>${inline(line.replace(/^\d+\. /, ''))}</li>`;
      }
      else if (/^→ /.test(line))   html += `<div class="ai-arrow">→ ${inline(line.slice(2))}</div>`;
      else if (line.trim() === '')  html += '<br>';
      else                          html += `<p>${inline(line)}</p>`;
    }
    closeList(); flushTable();
    if (inCode) html += `<pre class="md-pre"><code>${escape(codeLines.join('\n'))}</code></pre>`;

    return `<div class="ai-response">${html}</div>`;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function promptApiKeySetup() {
    document.getElementById('setupExpanded').style.display  = 'block';
    document.getElementById('setupCollapsed').style.display = 'none';
    document.getElementById('setupCard').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('apiKeyInput').focus();
  }

  function resetSession() {
    conversationHistory  = [];
    isQuizActive         = false;
    quizSessionWords     = [];
    currentModel         = preferredModel;
    responseContentEl.innerHTML = '';
    responsePlaceholder.style.display = '';
    resetArea.style.display = 'none';
    answerInputEl.value = '';
    answerInputEl.style.height = 'auto';
    const statusEl = document.getElementById('modelStatus');
    if (statusEl) statusEl.textContent = '';
    const sel = document.getElementById('modelSelect');
    if (sel) sel.value = preferredModel;

    if (MODE_CONFIG[currentMode]?.freeChat) {
      answerArea.style.display = 'flex';
    } else {
      answerArea.style.display = 'none';
    }
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Reset ──────────────────────────────────────────────────────────────────
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (isQuizActive && quizSessionWords.length > 0) {
      showWrongModal();
    } else {
      resetSession();
    }
  });

  // ── Wrong Answer Modal ─────────────────────────────────────────────────────
  function showWrongModal() {
    const list = document.getElementById('wrongList');
    list.innerHTML = quizSessionWords.map(w => `
      <label class="wrong-item">
        <input type="checkbox" value="${esc(w)}">
        <span>${esc(w)}</span>
      </label>`).join('');
    document.getElementById('wrongModal').style.display = 'flex';
  }

  document.getElementById('wrongConfirm').addEventListener('click', () => {
    const checked = [...document.querySelectorAll('#wrongList input:checked')].map(i => i.value);
    if (checked.length > 0) {
      chrome.storage.local.get(['translationHistory'], (data) => {
        const history = data.translationHistory || [];
        checked.forEach(word => {
          const item = history.find(i => i.text === word);
          if (item) item.wrongCount = (item.wrongCount || 0) + 1;
        });
        chrome.storage.local.set({ translationHistory: history });
      });
    }
    document.getElementById('wrongModal').style.display = 'none';
    resetSession();
  });

  document.getElementById('wrongSkip').addEventListener('click', () => {
    document.getElementById('wrongModal').style.display = 'none';
    resetSession();
  });

});
