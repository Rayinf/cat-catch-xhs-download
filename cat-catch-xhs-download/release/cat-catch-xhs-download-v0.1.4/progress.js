function append(text){const el=document.getElementById('log');el.textContent+=text+'\n';el.scrollTop=el.scrollHeight;}
const params=new URLSearchParams(location.search);
const keyword=params.get('keyword')||'';
const count=parseInt(params.get('count'),10)||20;

document.getElementById('title').textContent=`下载关键词：${keyword} (目标 ${count})`;
append('初始化...');

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
async function startDownload() {
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
      payload: { keyword, count }
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

// 监听progress消息
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'progress') {
    append(msg.text);
  }
});

// 启动下载
startDownload(); 