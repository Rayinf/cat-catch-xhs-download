document.getElementById('btn-download').addEventListener('click', () => {
  const url = chrome.runtime.getURL('progress.html');
  chrome.tabs.create({ url });
  window.close();
}); 