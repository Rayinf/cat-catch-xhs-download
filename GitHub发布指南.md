# GitHub发布指南

## 📋 准备工作

### 1. 创建GitHub仓库
1. 登录GitHub账号
2. 点击"New repository"
3. 填写仓库信息：
   - **Repository name**: `cat-catch-xhs-download`
   - **Description**: `🐱 基于猫抓技术的小红书视频批量下载Chrome扩展`
   - **Public/Private**: 选择Public
   - **Add README**: 不勾选（我们已有README.md）

### 2. 本地Git初始化
```bash
cd cat-catch-xhs-download
git init
git add .
git commit -m "🎉 Initial commit: 猫抓·小红书批量下载扩展"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/cat-catch-xhs-download.git
git push -u origin main
```

## 🏷️ 创建Release版本

### 步骤1：准备发布文件
1. 创建发布用的干净文件夹
2. 排除不必要的文件：
   ```
   排除文件：
   - .git/
   - node_modules/
   - *.md 文档文件（除README.md外）
   - 测试文件
   - 开发工具文件
   ```

### 步骤2：打包发布版本
```bash
# 创建发布文件夹
mkdir release
cp -r cat-catch-xhs-download release/

# 清理不必要的文件
cd release/cat-catch-xhs-download
rm -rf .git
rm -f *.md
cp ../../README.md .
rm -f test-*.js test-*.json test.html

# 创建ZIP包
cd ..
zip -r cat-catch-xhs-download-v0.1.3.zip cat-catch-xhs-download/
```

### 步骤3：创建GitHub Release
1. 访问GitHub仓库页面
2. 点击"Releases" → "Create a new release"
3. 填写发布信息：

**Tag version**: `v0.1.3`

**Release title**: `🐱 猫抓·小红书批量下载 v0.1.3`

**Release notes**:
```markdown
## 🎉 新功能
- ✨ 基于猫抓技术的视频资源嗅探
- 🎯 按关键词智能搜索下载
- 💧 自动获取无水印原始视频
- 📁 按关键词自动分类保存
- 🚀 支持批量下载操作

## 🔧 技术特性
- 🛡️ Manifest V3 兼容
- ⚡ Service Worker 架构
- 🔄 智能去重机制
- 📊 实时下载进度
- 🔗 webRequest API 资源捕获

## 📦 安装方法

### Chrome扩展商店（推荐）
即将上线...

### 手动安装
1. 下载下方的 `cat-catch-xhs-download-v0.1.3.zip`
2. 解压到本地文件夹
3. 打开Chrome浏览器，访问 `chrome://extensions/`
4. 开启"开发者模式"
5. 点击"加载已解压的扩展程序"，选择解压后的文件夹

## 📖 使用说明
1. 安装扩展后点击浏览器工具栏图标
2. 输入搜索关键词（如：美食、旅行等）
3. 设置下载数量
4. 点击"开始下载"

## ⚠️ 重要提醒
- 请遵守相关法律法规
- 仅下载拥有版权或已获授权的内容
- 本工具仅供个人学习研究使用
- 请尊重原创作者的版权

## 🔒 隐私保护
- 不收集任何个人信息
- 所有数据仅存储在本地设备
- 不向第三方传输任何数据

## 🐛 问题反馈
如果遇到问题，请通过以下方式反馈：
- [GitHub Issues](https://github.com/YOUR_USERNAME/cat-catch-xhs-download/issues)
- Email: your.email@example.com

---
感谢使用！如果觉得有用，请给个⭐️
```

4. 上传ZIP文件作为附件
5. 勾选"Set as the latest release"
6. 点击"Publish release"

## 📝 仓库优化

### 1. 添加标签
在仓库页面右侧添加Topics标签：
- `chrome-extension`
- `video-downloader`
- `xiaohongshu`
- `batch-download`
- `javascript`
- `manifest-v3`

### 2. 创建Issues模板
创建 `.github/ISSUE_TEMPLATE/` 文件夹：

**bug_report.md**:
```markdown
---
name: Bug报告
about: 报告功能异常或错误
title: '[BUG] '
labels: bug
assignees: ''
---

## 🐛 问题描述
简要描述遇到的问题

## 🔄 复现步骤
1. 打开扩展
2. 点击...
3. 出现错误...

## 🎯 预期行为
描述你期望的正确行为

## 📱 环境信息
- 操作系统: [如 Windows 11]
- 浏览器: [如 Chrome 120.0]
- 扩展版本: [如 v0.1.3]

## 📷 截图
如果适用，请添加截图说明问题
```

**feature_request.md**:
```markdown
---
name: 功能建议
about: 建议新功能或改进
title: '[FEATURE] '
labels: enhancement
assignees: ''
---

## 🚀 功能描述
描述你希望添加的功能

## 💡 使用场景
说明这个功能的使用场景和必要性

## 🎨 实现建议
如果有实现想法，请简要说明

## 📋 替代方案
描述你考虑过的其他解决方案
```

### 3. 设置GitHub Pages（可选）
如果想要项目主页，可以：
1. 在仓库设置中启用GitHub Pages
2. 选择source为"main branch"
3. GitHub会自动使用README.md作为主页

## 🌟 推广策略

### 1. 社区分享
- 发布到相关技术论坛
- 在开发者社群分享
- 写技术博客介绍

### 2. SEO优化
- 完善README.md关键词
- 添加详细的使用说明
- 提供清晰的截图演示

### 3. 持续维护
- 及时处理Issues
- 定期发布更新版本
- 收集用户反馈改进

## 📊 监控指标

关注以下数据：
- ⭐ Star数量
- 🍴 Fork数量
- 👁️ Watch数量
- 📥 Release下载量
- 🐛 Issues数量

定期分析这些数据，了解项目受欢迎程度和用户需求。 