document.getElementById('btn-download').addEventListener('click', () => {
  const url = chrome.runtime.getURL('progress.html');
  chrome.tabs.create({ url });
  window.close();
});

document.getElementById('btn-user-batch').addEventListener('click', () => {
  const url = chrome.runtime.getURL('user-batch.html');
  chrome.tabs.create({ url });
  window.close();
}); 