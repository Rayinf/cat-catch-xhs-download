function append(text){const el=document.getElementById('log');el.textContent+=text+'\n';el.scrollTop=el.scrollHeight;}

// 下载管理
const completedSet=new Set();
const skippedSet=new Set();
const titleMap={};
const listCompletedEl=document.getElementById('list-completed');
const listSkippedEl=document.getElementById('list-skipped');
const listKeywordDownloadedEl=document.getElementById('list-keyword-downloaded');

// 初始化
renderList();

// 从 URL 参数预填
const params=new URLSearchParams(location.search);
if(params.get('keyword')) document.getElementById('keyword').value = params.get('keyword');
if(params.get('count')) document.getElementById('count').value = params.get('count');
if(params.get('sort')) document.getElementById('sort').value = params.get('sort');

// 关键词输入监听
document.getElementById('keyword').addEventListener('input', function() {
  const keyword = this.value.trim();
  if(keyword) {
    loadKeywordHistory(keyword);
  } else {
    document.getElementById('keyword-history-section').style.display = 'none';
  }
});

// 加载关键词历史记录
async function loadKeywordHistory(keyword) {
  try {
    const tabs = await chrome.tabs.query({url: '*://*.xiaohongshu.com/*'});
    if(tabs.length === 0) {
      document.getElementById('keyword-history-section').style.display = 'none';
      return;
    }
    
    const response = await chrome.tabs.sendMessage(tabs[0].id, {
      type: 'get-downloaded-by-keyword',
      keyword: keyword
    });
    
    if(response && response.list) {
      document.getElementById('current-keyword-display').textContent = keyword;
      document.getElementById('keyword-downloaded-count').textContent = response.list.length;
      
      listKeywordDownloadedEl.innerHTML = response.list.map(id => {
        return `<div class="list-item"><a href="https://www.xiaohongshu.com/explore/${id}" target="_blank">${id}</a></div>`;
      }).join('');
      
      document.getElementById('keyword-history-section').style.display = response.list.length > 0 ? 'block' : 'none';
    }
  } catch(error) {
    console.log('无法获取关键词历史:', error);
    document.getElementById('keyword-history-section').style.display = 'none';
  }
}

// 清除关键词记录
document.getElementById('btn-clear-keyword').addEventListener('click', async function() {
  const keyword = document.getElementById('keyword').value.trim();
  if(!keyword) return;
  
  if(confirm(`确定要清除关键词"${keyword}"的所有下载记录吗？`)) {
    try {
      const tabs = await chrome.tabs.query({url: '*://*.xiaohongshu.com/*'});
      if(tabs.length > 0) {
        await chrome.tabs.sendMessage(tabs[0].id, {
          type: 'clear-downloaded-by-keyword',
          keyword: keyword
        });
        loadKeywordHistory(keyword); // 重新加载
        append(`已清除关键词"${keyword}"的下载记录`);
      }
    } catch(error) {
      append(`清除失败: ${error.message}`);
    }
  }
});

// 开始下载
document.getElementById('btn-start').addEventListener('click', () => {
  const keyword = document.getElementById('keyword').value.trim();
  const count = parseInt(document.getElementById('count').value, 10) || 20;
  const sort = document.getElementById('sort').value;
  if (!keyword) {
    alert('请输入关键词');
    return;
  }
  
  // 清空之前的结果
  completedSet.clear();
  skippedSet.clear();
  renderList();
  document.getElementById('log').textContent = '';
  
  append(`开始下载关键词：${keyword}，数量：${count}，排序：${sort}`);
  
  startDownload(keyword, count, sort);
  
  // 下载开始后重新加载关键词历史
  setTimeout(() => loadKeywordHistory(keyword), 1000);
});

// 下载选中的跳过视频
document.getElementById('btn-download-selected').addEventListener('click',()=>{
  const keyword = document.getElementById('keyword').value.trim();
  if (!keyword) {
    alert('请先输入关键词');
    return;
  }
  const checked=[...listSkippedEl.querySelectorAll('input[type="checkbox"]:checked')].map(el=>el.dataset.id);
  if(!checked.length){append('未选择任何跳过项');return;}
  chrome.runtime.sendMessage({type:'download-skipped',payload:{keyword,noteIds:checked}},resp=>{
    if(resp?.ok){append(`已提交 ${checked.length} 个跳过视频重新下载`);}else{append(`提交失败: ${resp?.error||'未知错误'}`);}  
  });
});

function renderList(){
  const completedArr=[...completedSet];
  const skippedArr=[...skippedSet];

  listCompletedEl.innerHTML=completedArr.map(id=>{
    const t=titleMap[id]||id;
    return `<div class="list-item"><a href="https://www.xiaohongshu.com/explore/${id}" target="_blank">${t}</a></div>`;
  }).join('');
  listSkippedEl.innerHTML=skippedArr.map(id=>{
    const t=titleMap[id]||id;
    return `<div class="list-item"><input type="checkbox" class="checkbox" data-id="${id}"/><a href="https://www.xiaohongshu.com/explore/${id}" target="_blank">${t}</a></div>`;
  }).join('');
  
  // 更新统计
  document.getElementById('stat-completed').textContent = completedSet.size;
  document.getElementById('stat-skipped').textContent = skippedSet.size;
  document.getElementById('stat-total').textContent = completedSet.size + skippedSet.size;
}

// 确保background script处于活跃状态
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
function sendMessageSafely(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

// 启动下载任务
async function startDownload(keyword, count, sort) {
  try {
    append('正在连接background script...');
    
    // 检查扩展环境
    if (!chrome.runtime || !chrome.runtime.sendMessage) {
      throw new Error('Chrome runtime API不可用');
    }
    
    await wakeUpBackground();
    append('连接成功，开始下载任务...');
    
    const resp = await sendMessageSafely({
      type: 'xhs-download',
      payload: { keyword, count, sort, offset: 0 }
    });
    
    if (resp?.ok) {
      append(`✅ 任务提交成功，共找到 ${resp.total} 条内容`);
    } else {
      append(`❌ 任务失败: ${resp?.error || '未知错误'}`);
    }
  } catch (error) {
    append(`❌ 连接失败: ${error.message}`);
    append('请尝试重新加载扩展或刷新页面');
  }
}

// 监听进度消息
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'progress') {
    // 过滤跳过重复提示，减少日志冗余
    if(!msg.skipped) append(msg.text);
    if(msg.noteId){
      if(msg.title){titleMap[msg.noteId]=msg.title;}
      if(msg.skipped){
        if(!completedSet.has(msg.noteId)) skippedSet.add(msg.noteId);
      }else if(msg.download||msg.forced){
        completedSet.add(msg.noteId);
        skippedSet.delete(msg.noteId);
      }
      renderList();
    }
    
  }
}); 