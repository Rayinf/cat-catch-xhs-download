# 猫抓·小红书批量下载 🐱

[![GitHub release](https://img.shields.io/github/release/YOUR_USERNAME/cat-catch-xhs-download.svg)](https://github.com/YOUR_USERNAME/cat-catch-xhs-download/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

基于猫抓资源嗅探技术，实现小红书按关键词批量下载视频的开源工具。

## ✨ 功能特色

- 🎯 **智能搜索**: 按关键词搜索并自动下载小红书视频
- 🚀 **批量下载**: 支持一次性下载多个视频文件
- 💧 **无水印**: 自动获取并下载无水印原始视频
- 📁 **分类保存**: 按关键词自动创建文件夹分类保存
- ⚡ **实时监控**: 自动捕获页面中的视频资源
- 🔄 **去重机制**: 避免重复下载相同视频

## 📖 使用说明

### 基础使用
1. 安装扩展后，浏览器工具栏会出现猫抓图标
2. 点击图标打开弹窗界面
3. 输入搜索关键词（如：美食、旅行、摄影等）
4. 设置下载数量（默认20个）
5. 点击"开始下载"按钮

### 高级功能
- **自动分类**: 下载的视频会按关键词自动分类到不同文件夹
- **进度监控**: 实时查看下载进度和状态
- **批量操作**: 支持同时下载多个关键词的视频

### 使用提示
- 首次使用建议先测试少量下载（1-3个）
- 确保有足够的磁盘空间存储视频文件
- 网络状况会影响下载速度和成功率
- 建议在网络稳定时使用

## 🔧 技术原理

本扩展基于以下技术实现：

1. **资源嗅探**: 使用 `webRequest` API 监听网络请求
2. **URL匹配**: 识别小红书视频资源链接模式
3. **自动下载**: 调用浏览器下载 API 执行下载
4. **内容脚本**: 在页面中注入脚本获取视频信息
5. **消息通信**: Background与Content Script间的消息传递

## 📝 更新日志

### v0.1.3 (2025-07-24)
- 🐛 修复URL模式匹配错误
- ✨ 优化下载去重机制
- 🔧 改进错误处理和重试逻辑
- 📱 增强Service Worker稳定性

### v0.1.2 (2025-07-24)
- ✨ 新增自动下载功能
- 🛠️ 修复消息通道连接问题
- 📊 添加详细的下载进度显示

### v0.1.0 (2025-07-24)
- 🎉 首个版本发布
- 🎯 支持关键词搜索下载
- 💧 无水印视频获取

## ⚠️ 使用须知

1. **法律合规**: 请遵守相关法律法规，仅下载自己拥有版权或已获授权的内容
2. **个人使用**: 本工具仅供个人学习和研究使用
3. **尊重版权**: 请尊重原创作者的版权，不得用于商业用途
4. **网站政策**: 使用时请遵守小红书的用户协议和服务条款

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🔗 相关链接

- [小红书官网](https://www.xiaohongshu.com/)
- [问题反馈](https://github.com/YOUR_USERNAME/cat-catch-xhs-download/issues)

## 📞 联系方式

如果你有任何问题或建议，请通过以下方式联系：

- 📧 Email: xxlmxx21@gmail.com
- 💬 GitHub Issues: [提交问题](https://github.com/YOUR_USERNAME/cat-catch-xhs-download/issues)

---

⭐ 如果这个项目对你有帮助，请给它一个星标！ 

## 💖 致谢

本项目基于 [原版猫抓](https://github.com/xifangczy/cat-catch) 的资源嗅探技术进行开发，感谢 [@xifangczy](https://github.com/xifangczy) 及其团队的开源贡献。

原版猫抓是一个优秀的浏览器资源嗅探扩展，为广大开发者提供了强大的资源捕获功能。本项目在其基础上专注于小红书视频的批量下载功能。

- 原项目地址：https://github.com/xifangczy/cat-catch
- 原项目文档：https://cat-catch.bmmmd.com/ 
