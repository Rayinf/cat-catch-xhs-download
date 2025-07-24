document.getElementById('btn-download').addEventListener('click', () => {
  const keyword = document.getElementById('keyword').value.trim();
  const count = parseInt(document.getElementById('count').value, 10) || 20;
  if (!keyword) return;
  const url = chrome.runtime.getURL(`progress.html?keyword=${encodeURIComponent(keyword)}&count=${count}`);
  chrome.tabs.create({ url });
  window.close();
}); 