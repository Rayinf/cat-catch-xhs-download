// 简化的背景脚本测试
console.log('Test Background Script loaded!');

// 监听安装事件
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed/updated');
});

// 监听启动事件
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension startup');
});

// 简单的消息监听器
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('Received message:', msg);
  
  if (msg.type === 'ping') {
    console.log('Pong!');
    sendResponse({ success: true, message: 'pong' });
    return true;
  }
  
  if (msg.type === 'test') {
    sendResponse({ success: true, message: 'Test successful!' });
    return true;
  }
  
  return false;
}); 