document.addEventListener('DOMContentLoaded', () => {
  const apiKeyEl        = document.getElementById('apiKey');
  const apiKeyChangeBtn = document.getElementById('apiKeyChange');
  const autohideEl      = document.getElementById('autohide');
  const themeEl         = document.getElementById('theme');
  const opacitySlider   = document.getElementById('opacitySlider');
  const opacityNum      = document.getElementById('opacityNum');
  const saveBtn         = document.getElementById('save');
  const statusEl        = document.getElementById('status');

  function applyTheme(theme) {
    document.documentElement.classList.remove('qt-dark', 'qt-light');
    if (theme === 'dark')  document.documentElement.classList.add('qt-dark');
    if (theme === 'light') document.documentElement.classList.add('qt-light');
  }

  themeEl.addEventListener('change', () => applyTheme(themeEl.value));

  opacitySlider.addEventListener('input', () => {
    opacityNum.value = opacitySlider.value;
  });
  opacityNum.addEventListener('input', () => {
    const v = Math.max(20, Math.min(100, parseInt(opacityNum.value) || 20));
    opacitySlider.value = v;
  });
  opacityNum.addEventListener('blur', () => {
    let v = parseInt(opacityNum.value);
    if (isNaN(v) || v < 20) v = 20;
    if (v > 100) v = 100;
    opacityNum.value = v;
    opacitySlider.value = v;
  });

  chrome.storage.sync.get(['apiKey', 'displayMode', 'autohideDuration', 'theme', 'opacity'], (data) => {
    if (data.apiKey) setMaskedState();

    const mode = data.displayMode || 'popup';
    const modeRadio = document.querySelector(`input[name="displayMode"][value="${mode}"]`);
    if (modeRadio) modeRadio.checked = true;

    autohideEl.value = String(data.autohideDuration !== undefined ? data.autohideDuration : 5000);

    const theme = data.theme || 'system';
    themeEl.value = theme;
    applyTheme(theme);

    const opacity = data.opacity !== undefined ? data.opacity : 100;
    opacitySlider.value = opacity;
    opacityNum.value = opacity;
  });

  function setMaskedState() {
    apiKeyEl.value = '';
    apiKeyEl.placeholder = '●●●●●●●●●●●● (저장됨)';
    apiKeyEl.disabled = true;
    apiKeyChangeBtn.style.display = 'inline-flex';
  }

  function setEditableState() {
    apiKeyEl.value = '';
    apiKeyEl.placeholder = 'AIzaSy...';
    apiKeyEl.disabled = false;
    apiKeyChangeBtn.style.display = 'none';
    apiKeyEl.focus();
  }

  apiKeyChangeBtn.addEventListener('click', setEditableState);

  document.getElementById('openHistory').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('history.html') });
  });

  saveBtn.addEventListener('click', () => {
    const newKey           = apiKeyEl.value.trim();
    const displayMode      = document.querySelector('input[name="displayMode"]:checked')?.value || 'popup';
    const autohideDuration = parseInt(autohideEl.value, 10);
    const theme            = themeEl.value || 'system';
    const opacity          = Math.max(20, Math.min(100, parseInt(opacitySlider.value) || 100));
    const updates          = { displayMode, autohideDuration, theme, opacity };
    if (newKey) updates.apiKey = newKey;

    chrome.storage.sync.set(updates, () => {
      if (newKey) setMaskedState();
      statusEl.textContent = '저장됨 ✓';
      statusEl.classList.add('visible');
      setTimeout(() => statusEl.classList.remove('visible'), 2000);
    });
  });
});
