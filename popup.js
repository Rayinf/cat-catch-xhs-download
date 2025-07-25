document.getElementById('btn-download').addEventListener('click', () => {
  const keyword = document.getElementById('keyword').value.trim();
  const count = parseInt(document.getElementById('count').value, 10) || 20;
  const offset = parseInt(document.getElementById('offset').value, 10) || 0;
  if (!keyword) return;
  const url = chrome.runtime.getURL(`progress.html?keyword=${encodeURIComponent(keyword)}&count=${count}&offset=${offset}`);
  chrome.tabs.create({ url });
  window.close();
}); 