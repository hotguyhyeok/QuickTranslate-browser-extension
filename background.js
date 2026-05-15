async function updateIcon(enabled) {
  if (enabled) {
    chrome.action.setIcon({
      path: { '16': 'icons/icon16.png', '48': 'icons/icon48.png', '128': 'icons/icon128.png' }
    });
    return;
  }

  const imageData = {};
  for (const size of [16, 48, 128]) {
    const resp = await fetch(chrome.runtime.getURL(`icons/icon${size}.png`));
    const blob = await resp.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    const img = ctx.getImageData(0, 0, size, size);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      d[i] = d[i + 1] = d[i + 2] = g;
    }
    imageData[size] = img;
  }
  chrome.action.setIcon({ imageData });
}

async function syncIcon() {
  const data = await chrome.storage.local.get(['qtEnabled']);
  updateIcon(data.qtEnabled !== false);
}

chrome.runtime.onInstalled.addListener(syncIcon);
chrome.runtime.onStartup.addListener(syncIcon);

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-enabled') return;
  const data = await chrome.storage.local.get(['qtEnabled']);
  const next = data.qtEnabled !== false ? false : true;
  chrome.storage.local.set({ qtEnabled: next });
  updateIcon(next);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'translate') return false;

  chrome.storage.sync.get(['apiKey'], async (data) => {
    const apiKey = data.apiKey;

    if (!apiKey) {
      sendResponse({
        error: 'API 키가 설정되지 않았습니다. 확장 프로그램 아이콘을 클릭해 설정 페이지에서 입력해주세요.'
      });
      return;
    }

    try {
      const res = await fetch(
        `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: message.text, target: 'ko', format: 'text' })
        }
      );

      const json = await res.json();

      if (json.error) {
        sendResponse({ error: json.error.message });
        return;
      }

      const { translatedText, detectedSourceLanguage } = json.data.translations[0];
      sendResponse({ translation: translatedText, detectedLang: detectedSourceLanguage });
    } catch (err) {
      sendResponse({ error: err.message });
    }
  });

  return true; // keep channel open for async response
});
