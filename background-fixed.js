/*
 * 修复版背景脚本（service_worker）
 * 针对连接问题进行了优化
 */

console.log('XHS Background Script starting...');

const XHS_HOST = 'https://www.xiaohongshu.com';
const captured = new Set();

// Service Worker安装和启动事件
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(self.clients.claim());
});

/**
 * 确保存在搜索结果标签页，并返回其 tabId
 */
async function ensureSearchTab(keyword) {
  const urlSearch = `${XHS_HOST}/search_result?keyword=${encodeURIComponent(keyword)}`;
  
  try {
    // 尝试查找已打开的标签
    const tabs = await chrome.tabs.query({ url: '*://*.xiaohongshu.com/*search_result*' });
    if (tabs.length) {
      const tab = tabs[0];
      // 如果关键词不同可重新导航
      await chrome.tabs.update(tab.id, { url: urlSearch, active: false });
      await waitTabComplete(tab.id);
      return tab.id;
    }
    // 新建背景 tab
    const tab = await chrome.tabs.create({ url: urlSearch, active: false });
    await waitTabComplete(tab.id);
    return tab.id;
  } catch (error) {
    console.error('Error creating/finding tab:', error);
    throw error;
  }
}

function waitTabComplete(tabId) {
  return new Promise((resolve) => {
    function listener(id, changeInfo) {
      if (id === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
    
    // 超时保护
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 10000);
  });
}

function sendMessagePromise(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (resp) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(resp);
      }
    });
  });
}

async function downloadByKeyword(keyword, maxCount = 20) {
  try {
    console.log(`Starting download for keyword: ${keyword}, count: ${maxCount}`);
    const tabId = await ensureSearchTab(keyword);
    
    // 注入脚本确保存在
    try {
      await chrome.scripting.executeScript({ 
        target: { tabId }, 
        files: ['content.js'] 
      });
    } catch (injectError) {
      console.warn('Script injection failed:', injectError);
    }
    
    // 等待页面加载完成
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 直接让 content script 收集视频列表
    const { items } = await sendMessagePromise(tabId, { 
      type: 'collect-video-items', 
      maxCount, 
      keyword 
    });
    
    console.log(`Download completed, found ${items.length} items`);
    return items.length;
  } catch (error) {
    console.error('Download error:', error);
    throw new Error(`下载失败: ${error.message}`);
  }
}

// 注册webRequest监听器
try {
  chrome.webRequest.onCompleted.addListener(
    (details) => {
      if (!details.url.includes('/stream/')) return;
      if (captured.has(details.url)) return;
      captured.add(details.url);
      if (details.tabId < 0) return; // 无对应标签页
      
      chrome.tabs.sendMessage(
        details.tabId,
        { type: 'resource-captured', url: details.url },
        () => {
          if (chrome.runtime.lastError) {
            console.warn('Failed to send resource message:', chrome.runtime.lastError.message);
          }
        }
      );
    },
    { 
      urls: [
        "*://sns-video*.xhscdn.com/*",
        "*://*.xhscdn.com/stream/*"
      ], 
      types: ["media", "xmlhttprequest", "other"] 
    }
  );
  console.log('WebRequest listener registered successfully');
} catch (error) {
  console.error('Failed to register webRequest listener:', error);
}

// 消息监听器
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('Background received message:', msg.type, 'from:', sender.tab ? 'tab' : 'extension');
  
  // 处理ping消息
  if (msg.type === 'ping') {
    console.log('Responding to ping');
    sendResponse({ pong: true, timestamp: Date.now() });
    return true;
  }
  
  // 处理下载请求
  if (msg.type === 'xhs-download') {
    const { keyword, count } = msg.payload;
    console.log(`Processing download request: ${keyword}, ${count}`);
    
    downloadByKeyword(keyword, count)
      .then(total => {
        console.log(`Download completed successfully: ${total} items`);
        sendResponse({ ok: true, total });
      })
      .catch(err => {
        console.error('Download failed:', err);
        sendResponse({ ok: false, error: err.message });
      });
    
    return true; // 异步响应
  }
  
  return false;
});

console.log('XHS Background Script loaded successfully'); 