/*
 * content.js - 注入到小红书页面，用于在站内环境收集笔记 ID 并获取视频直链。
 */

if (window.__xhs_down_loader_injected) {
  console.log('xhs downloader already injected');
} else {
  window.__xhs_down_loader_injected = true;
// --- BEGIN main logic ---

// 全局变量保存当前关键词
let CURRENT_KEYWORD = '';

// 提取卡片标题
function getNoteTitleFromAnchor(anchor){
  if(!anchor) return '';
  // 首选同卡片内的标题
  try{
    const card = anchor.closest('section.note-item, div.note-item');
    if(card){
      // 常见结构：<div class="footer"><a class="title"><span>标题</span></a></div>
      const sel=['div.footer a.title span','a.title span','div.footer a.title','a.title','.title span','.title'];
      for(const s of sel){
        const el=card.querySelector(s);
        if(el && el.textContent && el.textContent.trim()) return el.textContent.trim();
      }
    }
  }catch{}
  // 退化到 anchor 本身
  const t=(anchor.getAttribute('title')||anchor.innerText||anchor.textContent||'').trim();
  return t;
}

function safeSend(message){
  if(globalThis.__COLLECT_QUIET__ && message.type==='progress'){return;}
  chrome.runtime.sendMessage(message, ()=>void chrome.runtime.lastError);
}

// === 新增：已下载记录持久化 ===
const DOWNLOADED_BY_KEYWORD_KEY = 'downloadedByKeyword';
let downloadedByKeyword = {};
let currentKeywordSet = new Set();
// 初始化时读取已下载列表
chrome.storage.local.get(DOWNLOADED_BY_KEYWORD_KEY, res => {
  downloadedByKeyword = res[DOWNLOADED_BY_KEYWORD_KEY] || {};
});
// 设置当前关键词并更新Set
function setCurrentKeyword(keyword) {
  CURRENT_KEYWORD = keyword;
  const list = downloadedByKeyword[keyword] || [];
  currentKeywordSet = new Set(list);
}
// 记录新下载
function markDownloaded(noteId){
  if(!noteId || !CURRENT_KEYWORD || currentKeywordSet.has(noteId)) return;
  currentKeywordSet.add(noteId);
  downloadedByKeyword[CURRENT_KEYWORD] = Array.from(currentKeywordSet);
  chrome.storage.local.set({ [DOWNLOADED_BY_KEYWORD_KEY]: downloadedByKeyword });
}
// === 新增结束 ===

// ---- Hook fetch & XHR to capture /stream/ mp4 requests ----
(function(){
  const sent=new Set();
  function handle(url){
    if(!/\/stream\/.+\.mp4/.test(url)) return;
    if(sent.has(url)) return;
    sent.add(url);
    chrome.runtime.sendMessage({type:'resource-captured',url});
  }

  const origFetch=window.fetch;
  window.fetch=function(input,init){
    try{const u=typeof input==='string'?input:input.url;handle(u);}catch{}
    return origFetch.apply(this,arguments);
  };

  const origOpen=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(method,url){
    try{handle(url);}catch{}
    return origOpen.apply(this,arguments);
  };
})();

/**
 * 获取当前页面已渲染的笔记 ID 列表
 */
function collectNoteIds() {
  const anchors = Array.from(document.querySelectorAll('a[href*="/explore/"]'));
  const ids = new Set();
  anchors.forEach(a => {
    const m = a.href.match(/\/explore\/([0-9a-fA-F]+)/);
    if (m) ids.add(m[1]);
  });
  return Array.from(ids);
}

/**
 * 尝试滚动加载更多内容，直到收集到足够数量或触底
 */
async function gatherEnoughIds(targetCount) {
  let ids = collectNoteIds();
  let prevHeight = 0;
  let retries = 0;
  while (ids.length < targetCount && retries < 10) {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    await new Promise(r => setTimeout(r, 1200));
    ids = collectNoteIds();
    if (document.body.scrollHeight === prevHeight) retries += 1;
    else prevHeight = document.body.scrollHeight;
  }
  return ids.slice(0, targetCount);
}

/**
 * 从笔记详情 HTML 提取视频直链
 */
async function fetchVideoUrl(noteId) {
  try {
    const html = await fetch(`/explore/${noteId}`).then(r => r.text());
    // 搜索 mp4 直链
    const match = html.match(/https?:\/\/sns-video[^"']+\.mp4/);
    if (match) {
      return match[0];
    }
  } catch (e) {
    console.error('fetchVideoUrl error', noteId, e);
  }
  return null;
}

/** 切换到“视频”标签 */
function switchToVideoTab() {
  const tabs = Array.from(document.querySelectorAll('div, span, a'));
  const videoTab = tabs.find(el => el.innerText?.trim() === '视频');
  if (videoTab) {
    videoTab.click();
    return true;
  }
  return false;
}

/** 在详情页提取视频直链 */
function extractVideoFromDetail() {
  // 1. 先尝试 video 标签
  const v = document.querySelector('video');
  if (v?.src) return v.src;
  // 2. 搜索页面源码中的 sns-video mp4
  const html = document.documentElement.innerHTML;
  // 优先匹配无水印 /stream/ 链接
  let m = html.match(/https?:\/\/sns-video[^"']+\/stream[^"']+\.mp4/);
  if (m) return m[0];
  m = html.match(/https?:\/\/sns-video[^"']+\.mp4/);
  return m ? m[0] : null;
}

/**
 * 收集视频直链
 */
async function collectVideoItems(maxCount) {
  // 确保在视频标签
  switchToVideoTab();
  await new Promise(r => setTimeout(r, 1200));

  const ids = await gatherEnoughIds(maxCount);
  const items = [];
  for (const id of ids) {
    const url = await fetchVideoUrl(id);
    if (url) items.push({ noteId: id, url });
    if (items.length >= maxCount) break;
  }
  return items;
}

/** 等待条件成立工具 */
function waitFor(fn, timeout = 8000, interval = 200) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      try {
        const res = fn();
        if (res) {
          clearInterval(timer);
          resolve(res);
        } else if (Date.now() - start > timeout) {
          clearInterval(timer);
          reject(new Error('waitFor timeout'));
        }
      } catch (e) {
        clearInterval(timer);
        reject(e);
      }
    }, interval);
  });
}

async function fetchVideoUrlFromAnchor(anchor, noteId) {
  const detailUrl = anchor.getAttribute('href');
  if (!detailUrl) return null;
  try {
    const resp = await fetch(detailUrl, { credentials: 'include' });
    if (!resp.ok) throw new Error('detail fetch '+resp.status);
    const html = await resp.text();
    const mp4s = [...html.matchAll(/https?:\/\/sns-video[^"' ]+\.mp4/g)].map(m=>m[0]);
    const noMark = mp4s.find(u=>/stream/.test(u)&&!/(wm|mark)/i.test(u)) || mp4s.find(u=>!/(wm|mark)/i.test(u));
    if (noMark) return noMark;
  } catch(e){ console.warn('detail parse failed',e.message); }

  // fallback to feed api
  try {
    const api = `/api/sns/web/v1/feed?note_id=${noteId}`;
    const r = await fetch(api,{credentials:'include'});
    if(r.ok){
      const j = await r.json();
      const url = j?.data?.note?.video?.url;
      if(url) return url;
    }
  }catch{}
  return null;
}

function getCardAnchors() {
  const list = Array.from(document.querySelectorAll('section.note-item a.cover[href]'));
  return list.sort((a, b) => {
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    if (Math.abs(ra.top - rb.top) < 5) {
      return ra.left - rb.left;
    }
    return ra.top - rb.top;
  });
}

async function waitForStream(timeout=8000){
  return new Promise((resolve,reject)=>{
    const t=setTimeout(()=>{chrome.runtime.onMessage.removeListener(handler);reject('timeout');},timeout);
    function handler(msg){
      if(msg.type==='resource-captured'&&msg.url.includes('/stream/')){
        clearTimeout(t);
        chrome.runtime.onMessage.removeListener(handler);
        resolve(msg.url);
      }
    }
    chrome.runtime.onMessage.addListener(handler);
  });
}

async function clickPlayAndDownload(anchor, keyword){
  anchor.scrollIntoView({behavior:'smooth',block:'center'});
  await new Promise(r=>setTimeout(r,400));
  anchor.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));

  let url=null;
  try{url=await waitForStream(2500);}catch{}

  if(!url){
    const href=anchor.getAttribute('href');
    let noteId;
    try{noteId=new URL(href,location.origin).pathname.split('/').pop();}catch{noteId=href;}
    url=await fetchVideoUrlFromAnchor(anchor,noteId);
  }

  const closeBtn=document.querySelector('div.close-box,[class*="close-box"],svg[class*="close" i]');
  if(closeBtn) closeBtn.click();

  if(url){
    safeSend({type:'progress',text:`捕获到流 ${url.split('/').pop()}`});
    // 首先尝试使用前台 fetch+blob 携带正确 Referer 下载，避免被禁止
    try{
      await downloadBlob(url, `${noteId||Date.now()}.mp4`);
    }catch(err){
      console.warn('blob download failed',err);
      // fallback: 再次等待新的 /stream/ 流出现
      try{
        const stream2 = await waitForStream(5000);
        if(stream2){
          safeSend({type:'progress',text:`二次捕获 ${stream2.split('/').pop()}`});
          try{await downloadBlob(stream2, `${noteId||Date.now()}_2.mp4`);}catch(e){
            chrome.runtime.sendMessage({type:'resource-captured',url:stream2});
          }
          return stream2;
        }
      }catch{}
      // 最终交由 background 下载
      chrome.runtime.sendMessage({type:'resource-captured',url});
    }
    return url;
  }
  return null;
}

async function collectVideoItemsByClick(maxCount, keyword, offset=0){
  // 静默收集，不输出进度信息
  await new Promise(r=>setTimeout(r,600));

  const items=[];
  const processed=new Set();
  const loggedSkipped=new Set();
  let skipRemain=offset;
  let idleRounds=0;

  while(items.length<maxCount && idleRounds<40){
    const anchors=getCardAnchors();
    let gotNew=false;

    for(const a of anchors){
      const href=a.getAttribute('href');
      if(!href) continue;
      let noteId;
      try{noteId=new URL(href,location.origin).pathname.split('/').pop();}catch{noteId=href;}
      const noteTitle=getNoteTitleFromAnchor(a);
      // 新增：已下载检测(静默跳过)
      if(currentKeywordSet.has(noteId)) {
        continue;
      }
      if(processed.has(noteId)) continue;
      processed.add(noteId);

      gotNew=true;
      const stream=await clickPlayAndDownload(a,keyword);
      if(stream){
        // 新增：记录已下载
        markDownloaded(noteId);
        if(skipRemain>0){
          skipRemain--;
        } else {
          items.push({noteId,url:stream,title:noteTitle});
        }
      }
      break;
    }

    if(gotNew){
      idleRounds=0;
    } else {
      idleRounds++;
      window.scrollBy({top:window.innerHeight*0.9,behavior:'smooth'});
      await new Promise(r=>setTimeout(r,800));
    }
  }

  return items;
}

async function downloadBlob(url, filename) {
  let resp = await fetch(url,{credentials:'include'});
  if(!resp.ok){
    // 第二次尝试，不带凭证
    resp = await fetch(url);
    if(!resp.ok){
      throw new Error(resp.status);
    }
  }
  const blob = await resp.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objUrl;
  // 使用关键词创建文件夹路径
  const folderName = CURRENT_KEYWORD ? `小红书下载-${CURRENT_KEYWORD}-` : '';
  a.download = folderName + filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objUrl);
  safeSend({type:'progress',text:`保存完成 ${folderName}${filename}`});
}

/** 切换排序依据 */
function applySort(sortLabel){
  console.log('[applySort] start:', sortLabel);

  return new Promise(resolve=>{
    const filterBtn=document.querySelector('div.filter');
    if(!filterBtn){console.warn('[applySort] filter button not found');resolve(false);return;}

    // helper to open panel
    function openPanel(){
      filterBtn.click();
      return waitFor(()=>document.querySelector('div.tag-container'),3000,100);
    }

    function clickOption(container){
      const tags=Array.from(container.querySelectorAll('div.tags, .tags'));
      const target=tags.find(el=>{
        const span=el.querySelector('span');
        return (span?span.innerText:el.innerText).trim()===sortLabel;
      });
      if(!target){
        console.warn('[applySort] target option not found', sortLabel);
        return false;
      }
      target.click();
      return true;
    }

    async function run(){
      try{
        const container=await openPanel();
        if(!clickOption(container)) return resolve(false);
        // 关闭面板并等待页面内容刷新
        filterBtn.click();
        setTimeout(()=>resolve(true),800); // 给予足够时间让列表按新排序渲染
      }catch(e){
        console.error('[applySort] error',e);
        resolve(false);
      }
    }
    run();
  });
}

// === 新增：强制下载指定 noteId 列表 ===
async function forceDownloadNoteIds(list){
  for(const noteId of list){
    if(!noteId) continue;
    currentKeywordSet.delete(noteId); // 允许重新下载
    try{
      const url = await fetchVideoUrl(noteId);
      if(url){
        safeSend({type:'progress',text:`强制下载 ${noteId}`,noteId,title:noteId,forced:true});
        chrome.runtime.sendMessage({type:'resource-captured',url}); // 交由 background 下载
        markDownloaded(noteId);
      }else{
        safeSend({type:'progress',text:`未获取到链接 ${noteId}`,noteId,title:noteId,error:true});
      }
    }catch(e){
      safeSend({type:'progress',text:`下载失败 ${noteId} ${e.message}`,noteId,title:noteId,error:true});
    }
  }
}
// --- END main logic ---
// 监听 background 发送的请求
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('Content script received message:', msg.type);

  if (msg.type === 'ping') {
    sendResponse({ pong: true });
    return true;
  }

  if (msg.type === 'collect-video-items') {
    CURRENT_KEYWORD = msg.keyword || 'xhs';
    setCurrentKeyword(CURRENT_KEYWORD); // 更新当前关键词
    globalThis.__COLLECT_QUIET__ = !!msg.quiet;
    collectVideoItemsByClick(msg.maxCount || 20, CURRENT_KEYWORD, msg.offset||0).finally(()=>{globalThis.__COLLECT_QUIET__=false;})
      .then(items => sendResponse({ items }))
      .catch(error => sendResponse({ items: [], error: error.message }));
    return true;
  }

  if (msg.type === 'switch-to-video-tab') {
    const ok = switchToVideoTab();
    sendResponse({ ok });
    return true;
  }
  if (msg.type === 'collect-note-ids') {
    gatherEnoughIds(msg.targetCount).then(ids => sendResponse({ ids }));
    return true;
  }
  if (msg.type === 'get-video-url') {
    const url = extractVideoFromDetail();
    sendResponse({ url });
    return true;
  }
  if (msg.type === 'fetch-video-url') {
    const { noteId } = msg;
    fetchVideoUrl(noteId).then(url => sendResponse({ url }));
    return true;
  }
  if (msg.type === 'apply-sort') {
    Promise.resolve(applySort(msg.sortLabel)).then(ok=>sendResponse({ok}));
    return true; // 异步响应
  }
  if(msg.type==='force-download-note-ids'){
    forceDownloadNoteIds(msg.noteIds||[]).then(()=>sendResponse({ok:true}));
    return true;
  }
  // 获取指定关键词的已下载记录
  if(msg.type==='get-downloaded-by-keyword'){
    const keyword = msg.keyword;
    const list = downloadedByKeyword[keyword] || [];
    sendResponse({list});
    return true;
  }
  // 获取所有关键词的下载记录
  if(msg.type==='get-all-downloaded-keywords'){
    sendResponse({data: downloadedByKeyword});
    return true;
  }
  // 清除指定关键词的已下载记录
  if(msg.type==='clear-downloaded-by-keyword'){
    const keyword = msg.keyword;
    if(downloadedByKeyword[keyword]){
      delete downloadedByKeyword[keyword];
      chrome.storage.local.set({ [DOWNLOADED_BY_KEYWORD_KEY]: downloadedByKeyword });
      // 如果是当前关键词，也清空Set
      if(keyword === CURRENT_KEYWORD){
        currentKeywordSet.clear();
      }
    }
    sendResponse({ok:true});
    return true;
  }
  
  // 清除所有关键词的已下载记录
  if(msg.type==='clear-all-downloaded-keywords'){
    downloadedByKeyword = {};
    currentKeywordSet.clear();
    chrome.storage.local.set({ [DOWNLOADED_BY_KEYWORD_KEY]: downloadedByKeyword });
    sendResponse({ok:true});
    return true;
  }
  
  // === 用户主页批量下载相关功能 ===
  // 获取用户信息
  if(msg.type === 'getUserInfo'){
    getUserInfo(msg.uid)
      .then(data => sendResponse({success: true, data}))
      .catch(error => sendResponse({success: false, error: error.message}));
    return true;
  }
  
  // 获取用户笔记列表
  if(msg.type === 'getUserNotes'){
    getUserNotes(msg.uid)
      .then(data => sendResponse({success: true, data}))
      .catch(error => sendResponse({success: false, error: error.message}));
    return true;
  }
  
  // 下载笔记
  if(msg.type === 'downloadNote'){
    downloadNoteFromUser(msg.uid, msg.note)
      .then(data => sendResponse({success: true, data}))
      .catch(error => sendResponse({success: false, error: error.message}));
    return true;
  }
});

// 下载捕获的无水印资源
chrome.runtime.onMessage.addListener((msg)=>{
  if(msg.type==='resource-captured' && msg.url){
    safeSend({type:'progress',text:`已捕获 ${msg.url.split('/').pop()}`});
  }
});

// === 用户主页批量下载功能实现 ===

/**
 * 获取用户信息
 */
async function getUserInfo(uid) {
  try {
    const userProfileUrl = `https://www.xiaohongshu.com/user/profile/${uid}`;
    
    // 如果当前不在用户页面，通过API获取或导航到用户页面
    if (!window.location.href.includes(`/user/profile/${uid}`)) {
      // 尝试通过API获取用户信息
      try {
        const apiResponse = await fetch('/api/sns/web/v1/user/otherinfo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({
            target_user_id: uid
          })
        });
        
        if (apiResponse.ok) {
          const data = await apiResponse.json();
          if (data.success && data.data) {
            return {
              uid: uid,
              username: data.data.basic_info?.nickname || uid,
              profileUrl: userProfileUrl
            };
          }
        }
      } catch (apiError) {
        console.log('API获取用户信息失败，尝试页面导航方式');
      }
      
      // API失败时，返回基本信息，不进行页面导航（避免消息端口关闭）
      return {
        uid: uid,
        username: uid, // 使用UID作为用户名
        profileUrl: userProfileUrl
      };
    }
    
    // 如果已经在用户页面，尝试提取用户名
    let username = uid; // 默认使用UID作为用户名
    const userNameSelectors = [
      '.user-name',
      '.username',
      '[class*="user-name"]',
      '[class*="username"]',
      '.user-info .name',
      '.profile-info .name',
      '[class*="nickname"]',
      '[class*="display-name"]'
    ];
    
    for (const selector of userNameSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        username = element.textContent.trim();
        break;
      }
    }
    
    return {
      uid: uid,
      username: username,
      profileUrl: userProfileUrl
    };
  } catch (error) {
    // 即使出错也返回基本信息
    return {
      uid: uid,
      username: uid,
      profileUrl: `https://www.xiaohongshu.com/user/profile/${uid}`
    };
  }
}

/**
 * 获取用户的所有笔记
 */
async function getUserNotes(uid) {
  try {
    // 优先使用API方式获取，避免页面导航
    return await fetchUserNotesFromAPI(uid);
  } catch (error) {
    console.log('API获取失败，尝试其他方式:', error);
    // API失败时返回空数组，而不是抛出错误
    return [];
  }
}

/**
 * 从API获取用户笔记数据
 */
async function fetchUserNotesFromAPI(uid) {
  const notes = [];
  let cursor = '';
  let hasMore = true;
  let attempts = 0;
  const maxAttempts = 3;
  
  while (hasMore && notes.length < 500 && attempts < maxAttempts) { // 限制数量和尝试次数
    try {
      attempts++;
      
      // 尝试多个API端点
      const apiEndpoints = [
        '/api/sns/web/v1/user_posted',
        '/api/sns/web/v2/user_posted',
        '/api/sns/web/v1/user/notes'
      ];
      
      let response = null;
      let data = null;
      
      for (const endpoint of apiEndpoints) {
        try {
          response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              user_id: uid,
              target_user_id: uid,
              cursor: cursor,
              num: 20
            })
          });
          
          if (response.ok) {
            data = await response.json();
            if (data.success || data.code === 0) {
              break;
            }
          }
        } catch (apiError) {
          console.log(`API端点 ${endpoint} 失败:`, apiError);
          continue;
        }
      }
      
      if (!data || (!data.success && data.code !== 0)) {
        throw new Error('所有API端点都失败了');
      }
      
      const noteData = data.data?.notes || data.data?.feeds || [];
      
      if (noteData.length > 0) {
        for (const note of noteData) {
          const noteId = note.note_id || note.id;
          const title = note.display_title || note.title || '无标题';
          
          if (noteId) {
            notes.push({
              id: noteId,
              title: title,
              type: note.type || 'normal',
              imageUrls: note.image_list?.map(img => img.url_default || img.url) || [],
              videoUrl: note.video?.consumer?.origin_video_key || note.video_url || null
            });
          }
        }
        
        cursor = data.data?.cursor || '';
        hasMore = data.data?.has_more || false;
      } else {
        hasMore = false;
      }
      
      // 添加延迟避免请求过快
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.warn(`API获取失败 (尝试 ${attempts}/${maxAttempts}):`, error);
      
      if (attempts >= maxAttempts) {
        // 所有API尝试都失败了，尝试页面抓取
        if (window.location.href.includes(`/user/profile/${uid}`)) {
          return await collectUserNotesFromPage();
        } else {
          // 不在用户页面，返回空数组
          return [];
        }
      }
      
      // 短暂延迟后重试
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  return notes;
}

/**
 * 从当前页面收集用户笔记
 */
async function collectUserNotesFromPage() {
  const notes = [];
  const maxScrollAttempts = 50; // 最大滚动次数
  let scrollAttempts = 0;
  let previousNoteCount = 0;
  let stableCount = 0;
  
  while (scrollAttempts < maxScrollAttempts) {
    // 收集当前页面的笔记链接
    const noteLinks = document.querySelectorAll('a[href*="/explore/"]');
    const currentNotes = new Set();
    
    noteLinks.forEach(link => {
      const match = link.href.match(/\/explore\/([0-9a-fA-F]+)/);
      if (match) {
        const noteId = match[1];
        if (!currentNotes.has(noteId)) {
          currentNotes.add(noteId);
          
          // 尝试获取笔记标题
          let title = '无标题';
          const titleElement = link.querySelector('.title, [class*="title"]') || 
                              link.closest('.note-item, [class*="note"]')?.querySelector('.title, [class*="title"]');
          if (titleElement) {
            title = titleElement.textContent.trim();
          }
          
          notes.push({
            id: noteId,
            title: title,
            type: 'unknown', // 页面抓取时类型未知
            link: link.href
          });
        }
      }
    });
    
    // 检查是否有新内容加载
    if (notes.length === previousNoteCount) {
      stableCount++;
      if (stableCount >= 3) {
        // 连续3次没有新内容，可能已经到底了
        break;
      }
    } else {
      stableCount = 0;
      previousNoteCount = notes.length;
    }
    
    // 滚动到页面底部
    window.scrollTo(0, document.body.scrollHeight);
    
    // 等待新内容加载
    await new Promise(resolve => setTimeout(resolve, 2000));
    scrollAttempts++;
  }
  
  // 去重
  const uniqueNotes = [];
  const seenIds = new Set();
  
  for (const note of notes) {
    if (!seenIds.has(note.id)) {
      seenIds.add(note.id);
      uniqueNotes.push(note);
    }
  }
  
  return uniqueNotes;
}

/**
 * 下载用户的单个笔记
 */
async function downloadNoteFromUser(uid, note) {
  try {
    // 获取笔记详细信息和下载链接
    const noteUrl = await fetchVideoUrl(note.id);
    
    if (noteUrl) {
      // 发送下载请求到background script
      chrome.runtime.sendMessage({
        type: 'resource-captured',
        url: noteUrl,
        filename: `${uid}_${note.id}_${note.title}`.replace(/[^\w\-_]/g, '_')
      });
      
      return {
        noteId: note.id,
        title: note.title,
        downloadUrl: noteUrl,
        status: 'downloaded'
      };
    } else {
      throw new Error('无法获取下载链接');
    }
  } catch (error) {
    throw new Error(`下载笔记失败: ${error.message}`);
  }
}

/**
 * 等待元素出现
 */
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }
    
    const observer = new MutationObserver((mutations) => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`元素 ${selector} 未找到`));
    }, timeout);
  });
}

// --- END main logic ---
} 