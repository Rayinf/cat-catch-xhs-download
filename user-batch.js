/*
 * user-batch.js - 用户主页批量下载功能
 */

// 日志函数 - 复用progress.js的风格
const DEBUG = false;
function append(text) {
  const el = document.getElementById('log');
  el.textContent += text + '\n';
  el.scrollTop = el.scrollHeight;
}

// 下载管理
const userRecords = new Map(); // UID -> user info (保留用于文件夹名称)

// 视频级别的下载记录管理（模仿progress.js）
const completedSet = new Set();
const skippedSet = new Set();
const titleMap = {};
let listCompletedEl;
let listSkippedEl;

// 统计数据
let stats = {
  totalUsers: 0,
  completedUsers: 0,
  totalNotes: 0,
  downloadedNotes: 0,
  skippedNotes: 0,
  failedNotes: 0
};

// 控制状态
let isRunning = false;
let currentUserIndex = 0;
let currentUsers = [];

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  initializeUI();
  renderLists();
});

function initializeUI() {
  // 初始化DOM元素引用
  listCompletedEl = document.getElementById('list-completed');
  listSkippedEl = document.getElementById('list-skipped');
  
  // 绑定事件处理器
  document.getElementById('btn-start').addEventListener('click', startBatchDownload);
  document.getElementById('uid-file').addEventListener('change', handleFileSelect);
  document.getElementById('btn-download-selected').addEventListener('click', downloadSelectedSkipped);
  document.getElementById('btn-clear-records').addEventListener('click', clearDownloadRecords);
  document.getElementById('btn-view-records').addEventListener('click', showDownloadRecords);
  document.getElementById('btn-close-records').addEventListener('click', hideDownloadRecords);
}

// 解析UID输入，支持多种格式
function parseUIDs(input) {
  const lines = input.split('\n').map(line => line.trim()).filter(line => line);
  const uids = [];
  
  for (const line of lines) {
    // 检查是否是完整的用户主页链接
    const urlMatch = line.match(/https?:\/\/www\.xiaohongshu\.com\/user\/profile\/([a-fA-F0-9]+)/);
    if (urlMatch) {
      uids.push(urlMatch[1]);
      continue;
    }
    
    // 检查是否是纯UID (24位十六进制字符)
    if (/^[a-fA-F0-9]{24}$/.test(line)) {
      uids.push(line);
      continue;
    }
    
    append(`警告: 无法识别的UID格式: ${line}`);
  }
  
  return [...new Set(uids)]; // 去重
}

// 文件导入处理
async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const content = await readFileAsText(file);
    const currentContent = document.getElementById('uid-input').value;
    const newContent = currentContent ? currentContent + '\n' + content : content;
    document.getElementById('uid-input').value = newContent;
    append(`成功导入文件: ${file.name}`);
  } catch (error) {
    append(`文件导入失败: ${error.message}`);
  }
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

// 确保background script处于活跃状态 - 复用progress.js逻辑
function wakeUpBackground() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 10;
    
    function tryPing() {
      attempts++;
      console.log(`Ping attempt ${attempts}/${maxAttempts}`);
      
      chrome.runtime.sendMessage({type: 'ping'}, (response) => {
        if (chrome.runtime.lastError) {
          console.log('Background script not responding, retrying...');
          if (attempts >= maxAttempts) {
            reject(new Error('Background script failed to respond after multiple attempts'));
          } else {
            setTimeout(tryPing, 500);
          }
        } else {
          console.log('Background script responded:', response);
          resolve();
        }
      });
    }
    
    tryPing();
  });
}

// 发送消息的安全包装函数
function sendMessageSafely(message, retries = 3) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    function tryMessage() {
      attempts++;
      if(DEBUG) append(`发送消息尝试 ${attempts}/${retries + 1}: ${message.type}`);
      
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          const error = chrome.runtime.lastError.message;
          append(`消息发送失败 (尝试 ${attempts}): ${error}`);
          
          if (attempts <= retries) {
            setTimeout(tryMessage, 1000 * attempts); // 递增延迟
          } else {
            reject(new Error(`消息发送失败，已重试 ${retries} 次: ${error}`));
          }
        } else {
          if(DEBUG) append(`消息发送成功 (尝试 ${attempts}): ${response ? 'ok' : 'failed'}`);
          resolve(response);
        }
      });
    }
    
    tryMessage();
  });
}

// 检查background script是否准备就绪
async function ensureBackgroundReady() {
  try {
    await wakeUpBackground();
    if(DEBUG) append('Background script已就绪');
    return true;
  } catch (error) {
    append(`Background script连接失败: ${error.message}`);
    return false;
  }
}

// 直接打开用户页面进行处理 - 类似progress.html的方式
async function openUserPageAndProcess(uid) {
  const userProfileUrl = `https://www.xiaohongshu.com/user/profile/${uid}`;
  
  append(`正在打开用户页面: ${userProfileUrl}`);
  
  // 后台打开用户页面
  const tab = await chrome.tabs.create({
    url: userProfileUrl,
    active: false // 后台打开
  });
  
  // 等待页面加载完成
  await sleep(5000);
  
  // 确保content script已注入并可用
  await ensureContentScriptReady(tab.id);
  
  return tab;
}

// 确保content script准备就绪
async function ensureContentScriptReady(tabId) {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    try {
      // 尝试ping content script
      const response = await sendMessageSafely({ type: 'ping' }, tabId);
      if (response && response.pong) {
        if(DEBUG) append(`Content script已就绪 (标签页 ${tabId})`);
        return true;
      }
    } catch (error) {
      // 如果失败，尝试注入content script
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        });
        if(DEBUG) append(`Content script已注入到标签页 ${tabId}`);
        await sleep(1000); // 等待注入完成
      } catch (injectError) {
        if(DEBUG) append(`注入content script失败: ${injectError.message}`);
      }
    }
    
    attempts++;
    await sleep(1000);
  }
  
  throw new Error(`Content script未能在标签页 ${tabId} 中准备就绪`);
}

// 开始批量下载
async function startBatchDownload() {
  if (isRunning) return;
  
  const input = document.getElementById('uid-input').value.trim();
  if (!input) {
    append('请输入至少一个用户UID');
    return;
  }
  
  currentUsers = parseUIDs(input);
  if (currentUsers.length === 0) {
    append('没有找到有效的UID');
    return;
  }
  
  isRunning = true;
  currentUserIndex = 0;
  
  // 重置统计
  completedSet.clear();
  skippedSet.clear();
  Object.keys(titleMap).forEach(key => delete titleMap[key]);
  userRecords.clear();
  
  stats = {
    totalUsers: currentUsers.length,
    completedUsers: 0,
    totalNotes: 0,
    downloadedNotes: 0,
    skippedNotes: 0,
    failedNotes: 0
  };
  
  renderLists();
  
  append(`开始批量下载 ${currentUsers.length} 个用户的内容`);
  
  try {
    append('正在连接background script...');
    
    // 确保background script准备就绪
    const backgroundReady = await ensureBackgroundReady();
    if (!backgroundReady) {
      throw new Error('Background script未就绪，请重新加载扩展');
    }
    
    append('连接成功，开始处理用户...');
    
    await processUsers();
  } catch (error) {
    append(`批量下载出错: ${error.message}`);
  } finally {
    isRunning = false;
  }
}

// 处理所有用户
async function processUsers() {
  for (let i = currentUserIndex; i < currentUsers.length; i++) {
    if (!isRunning) break;
    
    currentUserIndex = i;
    const uid = currentUsers[i];
    
    try {
      await processUser(uid);
      stats.completedUsers++;
    } catch (error) {
      append(`用户 ${uid} 处理失败: ${error.message}`);
      stats.failedNotes++;
    }
    
    updateStats();
    renderLists();
  }
  
  if(DEBUG) append('批量下载完成');
}

// 处理单个用户
async function processUser(uid) {
  append(`开始处理用户: ${uid}`);
  let userTab = null;
  
  try {
    // 直接打开用户页面 - 类似progress.html的方式
    userTab = await openUserPageAndProcess(uid);
    
    // 初始化用户记录（先用UID，后续会更新为真实用户名）
    const userInfo = {
      uid: uid,
      username: uid, // 先用UID作为用户名
      profileUrl: `https://www.xiaohongshu.com/user/profile/${uid}`
    };
    
    userRecords.set(uid, {
      ...userInfo,
      status: 'downloading',
      progress: 0,
      downloaded: 0,
      skipped: 0,
      failed: 0,
      lastUpdate: new Date().toLocaleString()
    });
    
    append(`用户页面已打开，开始收集笔记信息...`);
    
    // 延后获取用户名，在收集笔记信息时一起获取
    
    // 获取用户设置的下载数量
    const downloadCount = parseInt(document.getElementById('download-count').value) || 20;
    
    // 在用户页面上收集笔记信息 - 使用与progress.html相同的方式
    const notes = await new Promise((resolve, reject) => {
      // 给页面更多时间渲染
      setTimeout(() => {
        chrome.tabs.sendMessage(userTab.id, {
          type: 'collect-video-items',
          keyword: `user_${uid}`,
          maxCount: downloadCount,
          offset: 0,
          quiet: true
        }, (response) => {
          if (chrome.runtime.lastError) {
            append(`页面通信失败: ${chrome.runtime.lastError.message}`);
            resolve([]);
          } else if (response && response.items) {
            // 获取用户名（如果有）
            if (response.username && response.username !== uid) {
              const currentRecord = userRecords.get(uid);
              userRecords.set(uid, {
                ...currentRecord,
                username: response.username
              });
              append(`获取到用户名: ${response.username}`);
            }
            
            const noteList = response.items.map(item => ({
              id: item.noteId,
              title: item.title || item.noteId,
              type: 'user_note',
              url: item.url
            }));
            resolve(noteList);
          } else {
            append('未能获取笔记列表，尝试备用方法...');
            // 备用方法：直接收集note IDs
            chrome.tabs.sendMessage(userTab.id, {
              type: 'collect-note-ids',
              targetCount: 200
            }, (backupResponse) => {
              if (backupResponse && backupResponse.ids) {
                const noteList = backupResponse.ids.map(id => ({
                  id: id,
                  title: id,
                  type: 'user_note'
                }));
                resolve(noteList);
              } else {
                resolve([]);
              }
            });
          }
        });
      }, 5000); // 给更多时间让页面完全加载
    });
    
    append(`用户 ${uid} 共找到 ${notes.length} 个笔记`);
    
    if (notes.length === 0) {
      append(`用户 ${uid} 没有可下载的笔记，可能是私密账户`);
      const userRecord = userRecords.get(uid);
      userRecords.set(uid, {
        ...userRecord,
        status: 'completed',
        progress: 100
      });
      return;
    }
    
    stats.totalNotes += notes.length;
    
    // 更新用户记录中的总笔记数
    let currentUserRecord = userRecords.get(uid);
    userRecords.set(uid, {
      ...currentUserRecord,
      totalNotes: notes.length
    });
    
    // 直接下载收集到的视频流（模仿progress.html）
    let downloadedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    
    append(`开始下载用户 ${uid} 的 ${notes.length} 个视频...`);
    
    for (let j = 0; j < notes.length; j++) {
      if (!isRunning) break;
      

      
      const note = notes[j];
      
      try {
        // 检查是否已下载
        const alreadyDownloaded = await isNoteDownloaded(uid, note.id);
        
        if (alreadyDownloaded) {
          skippedCount++;
          stats.skippedNotes++;
          
          // 添加到视频级别记录
          if (note.title) titleMap[note.id] = note.title;
          skippedSet.add(note.id);
          
          append(`跳过已下载: ${note.title || note.id}`);
        } else if (note.url) {
          // 先尝试无水印下载（background.js -> getVideoUrlDirectly）
          try {
            const userRecord = userRecords.get(uid);
            const folderName = userRecord?.username || uid;
            const bgResp = await sendMessageSafely({
              type: 'xhs-download-single',
              noteId: note.id,
              title: note.title,
              uid: uid,
              username: folderName
            });
            if (bgResp && bgResp.ok) {
              // background 已完成下载（无水印）
              downloadedCount++;
              stats.downloadedNotes++;
              await markNoteDownloaded(uid, note.id);
              if (note.title) titleMap[note.id] = note.title;
              completedSet.add(note.id);
              append(`无水印下载: ${note.title || note.id}`);
            } else {
              // 无法获取无水印链接，静默跳过该视频
              failedCount++;
              stats.failedNotes++;
              if (note.title) titleMap[note.id] = note.title;
              skippedSet.add(note.id);
              // 不输出任何日志，静默跳过
            }
          } catch (downloadError) {
            failedCount++;
            stats.failedNotes++;
            if (note.title) titleMap[note.id] = note.title;
            skippedSet.add(note.id);
            // 静默处理下载异常，不输出日志
          }
        } else {
          // 没有URL的视频静默跳过
          failedCount++;
          stats.failedNotes++;
          
          // 添加到视频级别记录（失败的归入跳过）
          if (note.title) titleMap[note.id] = note.title;
          skippedSet.add(note.id);
          
          // 静默跳过无链接的视频
        }
      } catch (error) {
        failedCount++;
        stats.failedNotes++;
        append(`下载失败: ${note.id} - ${error.message}`);
      }
      
      // 更新用户进度
      const progress = Math.round(((j + 1) / notes.length) * 100);
      const userRecord = userRecords.get(uid);
      userRecords.set(uid, {
        ...userRecord,
        progress: progress,
        downloaded: downloadedCount,
        skipped: skippedCount,
        failed: failedCount,
        totalNotes: notes.length,
        lastUpdate: new Date().toLocaleString()
      });
      

      
      // 短暂延迟避免请求过于频繁
      await sleep(500);
    }
    
    // 标记用户完成
    currentUserRecord = userRecords.get(uid);
    userRecords.set(uid, {
      ...currentUserRecord,
      status: 'completed'
    });
    
    if(DEBUG) append(`用户 ${uid} 处理完成: 下载${downloadedCount}, 跳过${skippedCount}, 失败${failedCount}`);
    
  } catch (error) {
    append(`用户 ${uid} 处理出错: ${error.message}`);
    currentUserRecord = userRecords.get(uid);
    if (currentUserRecord) {
      userRecords.set(uid, {
        ...currentUserRecord,
        status: 'failed'
      });
    }
  } finally {
    // 确保关闭用户标签页
    if (userTab && userTab.id) {
      try {
        chrome.tabs.remove(userTab.id);
        if(DEBUG) append(`已关闭用户 ${uid} 的标签页`);
      } catch (closeError) {
        append(`关闭标签页失败: ${closeError.message}`);
      }
    }
  }
}

// 检查笔记是否已下载
async function isNoteDownloaded(uid, noteId) {
  return new Promise((resolve) => {
    chrome.storage.local.get(`downloaded_${uid}`, (result) => {
      const downloadedNotes = result[`downloaded_${uid}`] || [];
      resolve(downloadedNotes.includes(noteId));
    });
  });
}

// 标记笔记已下载
async function markNoteDownloaded(uid, noteId) {
  return new Promise((resolve) => {
    chrome.storage.local.get(`downloaded_${uid}`, (result) => {
      const downloadedNotes = result[`downloaded_${uid}`] || [];
      if (!downloadedNotes.includes(noteId)) {
        downloadedNotes.push(noteId);
        chrome.storage.local.set({[`downloaded_${uid}`]: downloadedNotes}, resolve);
      } else {
        resolve();
      }
    });
  });
}



// 更新统计信息
function updateStats() {
  document.getElementById('stat-users').textContent = stats.totalUsers;
  document.getElementById('stat-completed').textContent = stats.completedUsers;
  document.getElementById('stat-downloaded').textContent = completedSet.size;
  document.getElementById('stat-skipped').textContent = skippedSet.size;
}

// 渲染视频级别的下载记录（模仿progress.js）
function renderVideoLists() {
  if (!listCompletedEl || !listSkippedEl) return;
  
  const completedArr = [...completedSet];
  const skippedArr = [...skippedSet];

  listCompletedEl.innerHTML = completedArr.map(id => {
    const title = titleMap[id] || id;
    return `<div class="list-item"><a href="https://www.xiaohongshu.com/explore/${id}" target="_blank">${title}</a></div>`;
  }).join('');
  
  listSkippedEl.innerHTML = skippedArr.map(id => {
    const title = titleMap[id] || id;
    return `<div class="list-item"><input type="checkbox" class="checkbox" data-id="${id}"/><a href="https://www.xiaohongshu.com/explore/${id}" target="_blank">${title}</a></div>`;
  }).join('');
}

// 更新列表显示
function renderLists() {
  // 渲染视频级别记录
  renderVideoLists();
  
  updateStats();
}



// 下载选中的跳过视频
function downloadSelectedSkipped() {
  if (!listSkippedEl) return;
  
  const checked = [...listSkippedEl.querySelectorAll('input[type="checkbox"]:checked')].map(el => el.dataset.id);
  if (!checked.length) {
    append('未选择任何跳过项');
    return;
  }
  
  append(`开始重新下载 ${checked.length} 个跳过的视频...`);
  
  // 重新下载这些视频
  checked.forEach(async (noteId) => {
    try {
      // 从跳过列表移到下载中状态
      skippedSet.delete(noteId);
      
      // 发送下载请求到background
      const response = await sendMessageSafely({
        type: 'xhs-download-single',
        noteId: noteId,
        title: titleMap[noteId] || noteId,
        uid: 'retry', // 标记为重试下载
        username: '重新下载'
      });
      
      if (response && response.ok) {
        completedSet.add(noteId);
        append(`✅ 重新下载成功: ${titleMap[noteId] || noteId}`);
      } else {
        skippedSet.add(noteId); // 重新加回跳过列表
        append(`❌ 重新下载失败: ${titleMap[noteId] || noteId}`);
      }
      
      renderVideoLists();
    } catch (error) {
      skippedSet.add(noteId); // 重新加回跳过列表
      append(`❌ 重新下载出错: ${titleMap[noteId] || noteId} - ${error.message}`);
      renderVideoLists();
    }
  });
}

function getStatusText(status) {
  const statusMap = {
    'pending': '等待中',
    'downloading': '下载中',
    'completed': '已完成',
    'failed': '失败'
  };
  return statusMap[status] || '未知';
}



// 清除下载记录
async function clearDownloadRecords() {
  if (!confirm('确定要清除所有下载记录吗？这将允许重新下载之前已下载的内容。')) {
    return;
  }
  
  try {
    // 获取所有存储的key
    const allKeys = await new Promise((resolve) => {
      chrome.storage.local.get(null, (result) => {
        resolve(Object.keys(result));
      });
    });
    
    // 找出所有下载记录的key（格式为 downloaded_uid）
    const downloadKeys = allKeys.filter(key => key.startsWith('downloaded_'));
    
    if (downloadKeys.length > 0) {
      // 删除所有下载记录
      await new Promise((resolve) => {
        chrome.storage.local.remove(downloadKeys, resolve);
      });
      
      append(`已清除 ${downloadKeys.length} 个用户的下载记录`);
      
      // 清除内存中的记录
      completedSet.clear();
      skippedSet.clear();
      Object.keys(titleMap).forEach(key => delete titleMap[key]);
      userRecords.clear();
      
      // 清除content.js中的下载记录
      try {
        await sendMessageSafely({
          type: 'clear-all-downloaded-keywords'
        });
        append('已清除页面中的下载记录');
      } catch (error) {
        append(`清除页面记录失败: ${error.message}`);
      }
      
      // 重置统计
      stats.totalUsers = 0;
      stats.completedUsers = 0;
      stats.totalNotes = 0;
      stats.downloadedNotes = 0;
      stats.skippedNotes = 0;
      stats.failedNotes = 0;
      
      // 停止当前下载
      isRunning = false;
      currentUserIndex = 0;
      currentUsers = [];
      
      // 更新界面
      renderLists();
      
      // 清空日志
      const logEl = document.getElementById('log-content');
      if (logEl) {
        logEl.innerHTML = '';
      }
      
    } else {
      append('没有找到需要清除的下载记录');
    }
  } catch (error) {
    append(`清除下载记录失败: ${error.message}`);
  }
}

// 显示下载记录模态框
async function showDownloadRecords() {
  const modal = document.getElementById('records-modal');
  const content = document.getElementById('records-content');
  
  modal.style.display = 'block';
  content.innerHTML = '<p style="text-align:center;color:#666;padding:40px;">加载中...</p>';
  
  try {
    // 获取所有存储的key
    const allKeys = await new Promise((resolve) => {
      chrome.storage.local.get(null, (result) => {
        resolve(Object.keys(result));
      });
    });
    
    // 找出所有下载记录的key（格式为 downloaded_uid）
    const downloadKeys = allKeys.filter(key => key.startsWith('downloaded_'));
    
    if (downloadKeys.length === 0) {
      content.innerHTML = '<p style="text-align:center;color:#666;padding:40px;">暂无下载记录</p>';
      return;
    }
    
    // 获取所有下载记录
    const records = await new Promise((resolve) => {
      chrome.storage.local.get(downloadKeys, (result) => {
        resolve(result);
      });
    });
    
    // 构建HTML
    let html = '<div style="max-height:60vh;overflow:auto;">';
    
    for (const [key, noteIds] of Object.entries(records)) {
      const uid = key.replace('downloaded_', '');
      html += `
        <div style="margin-bottom:20px;border:1px solid #e9ecef;border-radius:6px;padding:15px;">
          <h3 style="margin:0 0 10px 0;color:#ff2c55;font-size:16px;">用户: ${uid}</h3>
          <p style="margin:0 0 10px 0;color:#666;font-size:14px;">已下载 ${noteIds.length} 个笔记</p>
          <div style="max-height:200px;overflow:auto;">
      `;
      
      noteIds.forEach((noteId, index) => {
        const title = titleMap[noteId] || noteId;
        html += `
          <div style="padding:5px 0;border-bottom:1px solid #f5f5f5;display:flex;align-items:center;">
            <span style="color:#666;margin-right:10px;font-size:12px;">${index + 1}.</span>
            <span style="flex:1;color:#333;">${title}</span>
            <span style="color:#999;font-size:12px;">${noteId}</span>
          </div>
        `;
      });
      
      html += '</div></div>';
    }
    
    html += '</div>';
    
    // 添加统计信息
    const totalNotes = Object.values(records).reduce((sum, noteIds) => sum + noteIds.length, 0);
    html = `
      <div style="background:#f8f9fa;padding:15px;border-radius:6px;margin-bottom:20px;">
        <h3 style="margin:0;color:#333;">下载记录统计</h3>
        <p style="margin:10px 0 0 0;color:#666;">
          共记录了 <strong>${downloadKeys.length}</strong> 个用户的下载记录，
          总计 <strong>${totalNotes}</strong> 个已下载笔记
        </p>
      </div>
    ` + html;
    
    content.innerHTML = html;
    
  } catch (error) {
    content.innerHTML = `<p style="text-align:center;color:#dc3545;padding:40px;">加载失败: ${error.message}</p>`;
  }
}

// 隐藏下载记录模态框
function hideDownloadRecords() {
  document.getElementById('records-modal').style.display = 'none';
}

// 添加模态框背景点击关闭功能
document.addEventListener('DOMContentLoaded', function() {
  const modal = document.getElementById('records-modal');
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        hideDownloadRecords();
      }
    });
  }
});

// 工具函数：延迟
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 监听background script的进度消息（模仿progress.js）
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'progress') {
    // 过滤跳过重复提示，减少日志冗余
    if (!msg.skipped) append(msg.text);
    
    if (msg.noteId) {
      if (msg.title) titleMap[msg.noteId] = msg.title;
      
      if (msg.skipped) {
        if (!completedSet.has(msg.noteId)) skippedSet.add(msg.noteId);
      } else if (msg.download || msg.forced) {
        completedSet.add(msg.noteId);
        skippedSet.delete(msg.noteId);
      }
      
      renderVideoLists();
    }
  }
});

