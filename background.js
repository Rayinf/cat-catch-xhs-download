/*
 * 背景脚本（service_worker）
 * 参考猫抓的资源捕获逻辑，简化为针对小红书视频批量下载
 * 仅做演示用途，正式使用请自行维护 API 与解析逻辑
 */

// Service Worker启动日志
console.log('XHS Background Script loaded at:', new Date().toISOString());

const XHS_HOST = 'https://www.xiaohongshu.com';

/**
 * 确保存在搜索结果标签页，并返回其 tabId
 */
async function ensureSearchTab(keyword) {
  const urlSearch = `${XHS_HOST}/search_result?keyword=${encodeURIComponent(keyword)}`;
  // 尝试查找已打开的标签
  const tabs = await chrome.tabs.query({ url: '*://*.xiaohongshu.com/*search_result*' });
  if (tabs.length) {
    const tab = tabs[0];
    // 如果关键词不同可重新导航
    chrome.tabs.update(tab.id, { url: urlSearch, active: false });
    await waitTabComplete(tab.id);
    return tab.id;
  }
  // 新建背景 tab
  const tab = await chrome.tabs.create({ url: urlSearch, active: false });
  await waitTabComplete(tab.id);
  return tab.id;
}

function waitTabComplete(tabId) {
  return new Promise(resolve => {
    function listener(id, changeInfo) {
      if (id === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

function sendMessagePromise(tabId, message) {
  return new Promise((resolve, reject) => {
    // 添加超时保护
    const timeout = setTimeout(() => {
      reject(new Error('消息响应超时'));
    }, 100000);
    
    chrome.tabs.sendMessage(tabId, message, resp => {
      clearTimeout(timeout);
      if (chrome.runtime.lastError) {
        const error = chrome.runtime.lastError.message;
        if (error.includes('message channel closed') || error.includes('Receiving end does not exist')) {
          reject(new Error('页面脚本未响应，可能页面正在加载或脚本注入失败'));
        } else {
          reject(new Error(error));
        }
      } else {
        resolve(resp);
      }
    });
  });
}

async function downloadByKeyword(keyword, maxCount = 20, sortLabel = '综合', offset=0) {
  try {
    console.log(`Starting download for keyword: ${keyword}, count: ${maxCount}`);
    const tabId = await ensureSearchTab(keyword);
    
    // 多次尝试注入脚本
    let injectionSuccess = false;
    for (let i = 0; i < 3; i++) {
      try {
        await chrome.scripting.executeScript({ 
          target: { tabId }, 
          files: ['content.js'] 
        });
        injectionSuccess = true;
        console.log('Script injection successful');
        break;
      } catch (injectError) {
        console.warn(`Script injection attempt ${i + 1} failed:`, injectError);
        if (i < 2) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    if (!injectionSuccess) {
      throw new Error('脚本注入失败，请刷新小红书页面后重试');
    }
    
    // 等待页面和脚本完全加载
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 验证content script是否响应并切换视频标签
    try {
      await sendMessagePromise(tabId, { type: 'switch-to-video-tab' });
      // 应用排序
      if (sortLabel && sortLabel !== '综合') {
        await sendMessagePromise(tabId, { type: 'apply-sort', sortLabel });
        // 等待页面内容重新加载
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('Applied sort', sortLabel);
      }
      console.log('Content script responding');
    } catch (pingError) {
      throw new Error('页面脚本未响应，请刷新页面后重试');
    }
    
    // 收集视频列表
    const { items } = await sendMessagePromise(tabId, { 
      type: 'collect-video-items', 
      maxCount, 
      keyword,
      offset
    });
    
    console.log(`Download completed, found ${items.length} items`);
    return items.length;
  } catch (error) {
    console.error('Download error:', error);
    throw error; // 直接抛出原始错误，不再包装
  }
}

// 捕获无水印 stream mp4
const captured = new Set();

// helper
function safeDownload(url){
  let name=url.split('/').pop().split('?')[0].split('#')[0]||`video_${Date.now()}.mp4`;
  // windows 禁止字符
  name=name.replace(/[<>:"/\\|?*]/g,'_');
  try{
    chrome.downloads.download({url,filename:name,conflictAction:'uniquify'});
  }catch(e){
    console.warn('downloads.download failed',e);
    try{chrome.downloads.download({url,conflictAction:'uniquify'});}catch{}
  }
}

// 注册webRequest监听器
try {
  chrome.webRequest.onCompleted.removeListener && chrome.webRequest.onCompleted.removeListener(() => {}); // 清理旧监听器
  chrome.webRequest.onCompleted.addListener(
    (details) => {
      if (!details.url.includes('/stream/')) return;
      if (captured.has(details.url)) return;
      captured.add(details.url);
      // 触发下载
      safeDownload(details.url);
      // 向内容脚本广播
      if (details.tabId >= 0) {
        chrome.tabs.sendMessage(details.tabId, { type: 'resource-captured', url: details.url }, () => void chrome.runtime.lastError);
      }
    },
    {
      urls: [
        "*://*/*.mp4*"
      ],
      types: ["media", "xmlhttprequest", "other"]
    }
  );
  console.log('WebRequest listener registered successfully');
} catch (error) {
  console.error('Failed to register webRequest listener:', error);
}

// 监听来自内容脚本的捕获消息，执行下载
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'resource-captured' && msg.url) {
    const url = msg.url;
    if (!captured.has(url)) {
      captured.add(url);
      safeDownload(url);
    }
    // 不需要异步响应
    sendResponse && sendResponse({ ok: true });
    return true;
  }
  
  // 处理ping消息，用于唤醒service worker
  if (msg.type === 'ping') {
    console.log('Responding to ping');
    sendResponse({ pong: true });
    return true;
  }
  
  if (msg.type === 'xhs-download') {
    const { keyword, count, sort, offset } = msg.payload;
    downloadByKeyword(keyword, count, sort, offset)
      .then(total => sendResponse({ ok: true, total }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    // 返回 true 表示异步响应
    return true;
  }
  // 重新下载跳过的视频
  if(msg.type==='download-skipped'){
    const { keyword, noteIds } = msg.payload||{};
    if(!keyword || !Array.isArray(noteIds)||!noteIds.length){
      sendResponse({ok:false,error:'参数缺失'});
      return true;
    }
    (async ()=>{
      try{
        const tabId = await ensureSearchTab(keyword);
        // 确保脚本注入
        try{await chrome.scripting.executeScript({target:{tabId},files:['content.js']});}catch{}
        await sendMessagePromise(tabId,{type:'force-download-note-ids',noteIds});
        sendResponse({ok:true});
      }catch(e){
        sendResponse({ok:false,error:e.message});
      }
    })();
    return true; // 异步
  }
}); 