# GitHub手动上传更新指导文档

## 📋 目录
- [快速概览](#快速概览)
- [准备工作](#准备工作)
- [方法一：使用Git命令行（推荐）](#方法一使用git命令行推荐)
- [方法二：使用GitHub Desktop](#方法二使用github-desktop)
- [方法三：使用GitHub网页版](#方法三使用github网页版)
- [发布新版本](#发布新版本)
- [常见问题处理](#常见问题处理)

## 🎯 快速概览

您的GitHub仓库地址：[https://github.com/Rayinf/cat-catch-xhs-download](https://github.com/Rayinf/cat-catch-xhs-download)

**最新更新（v0.3.0）包含的新功能：**
- ✨ 新增用户主页批量下载功能
- 🎨 全新的双栏布局设计
- 📱 完整的下载记录管理
- 🔧 增强的错误处理和重试机制

---

## 🛠 准备工作

### 1. 确认Git配置
```bash
# 检查当前Git用户信息
git config --global user.name
git config --global user.email

# 如果需要设置用户信息
git config --global user.name "您的用户名"
git config --global user.email "您的邮箱"
```

### 2. 确认远程仓库连接
```bash
# 检查远程仓库地址
git remote -v

# 如果需要重新设置远程仓库
git remote set-url origin https://github.com/Rayinf/cat-catch-xhs-download.git
```

---

## 💻 方法一：使用Git命令行（推荐）

### 步骤1：检查项目状态
```bash
# 进入项目目录
cd /Volumes/PortableSSD/Azune/forfun-xhs

# 查看当前状态
git status
```

### 步骤2：添加和提交更改
```bash
# 添加所有更改的文件
git add .

# 查看将要提交的文件
git status

# 提交更改（使用详细的提交信息）
git commit -m "v0.3.0: 新增用户主页批量下载功能

✨ 新功能:
- 新增用户主页批量下载页面 (user-batch.html/js)
- 支持通过UID列表批量下载用户主页内容
- 支持手动输入和文件导入UID列表
- 按用户名创建文件夹组织下载内容
- 自定义下载数量控制

🎨 界面优化:
- 采用与progress.html一致的双栏布局设计
- 已完成下载和已跳过视频的详细列表显示
- 支持选择跳过视频重新下载
- 清除下载记录功能

🔧 技术改进:
- 增强的消息重试机制和错误处理
- 详细的调试日志和状态验证
- 优化的标签页管理和资源清理
- 改进的API调用和备用方案处理"
```

### 步骤3：推送到GitHub
```bash
# 推送到主分支
git push origin main

# 如果出现权限问题，可能需要重新认证
# 使用GitHub令牌或SSH密钥
```

---

## 🖥 方法二：使用GitHub Desktop

### 步骤1：安装GitHub Desktop
- 下载地址：[https://desktop.github.com/](https://desktop.github.com/)
- 安装并登录您的GitHub账户

### 步骤2：克隆仓库（如果还未克隆）
1. 打开GitHub Desktop
2. 点击 "Clone a repository from the Internet"
3. 输入仓库URL：`https://github.com/Rayinf/cat-catch-xhs-download`
4. 选择本地路径

### 步骤3：提交和推送
1. GitHub Desktop会自动检测文件更改
2. 在左侧面板查看更改的文件
3. 在底部输入提交信息：
   - Summary: `v0.3.0: 新增用户主页批量下载功能`
   - Description: 添加详细的功能描述
4. 点击 "Commit to main"
5. 点击 "Push origin" 推送到GitHub

---

## 🌐 方法三：使用GitHub网页版

### 适用情况
- 小量文件修改
- 无法使用命令行的情况
- 临时快速修改

### 操作步骤
1. 访问：[https://github.com/Rayinf/cat-catch-xhs-download](https://github.com/Rayinf/cat-catch-xhs-download)
2. 点击要编辑的文件
3. 点击编辑按钮（铅笔图标）
4. 进行修改
5. 滚动到底部，填写提交信息
6. 点击 "Commit changes"

### 上传新文件
1. 在仓库主页点击 "Add file" → "Upload files"
2. 拖拽或选择要上传的文件
3. 填写提交信息
4. 点击 "Commit changes"

---

## 🎁 发布新版本

### 创建Release
1. 访问仓库页面：[https://github.com/Rayinf/cat-catch-xhs-download](https://github.com/Rayinf/cat-catch-xhs-download)
2. 点击右侧 "Releases" → "Create a new release"
3. 填写版本信息：

```
Tag version: v0.3.0
Release title: 🐱 猫抓·小红书批量下载 v0.3.0 - 用户主页批量下载

描述内容：
## ✨ 新功能
- 🎯 **用户主页批量下载**: 支持通过UID列表批量下载用户主页的所有内容
- 📁 **智能文件夹**: 按用户名自动创建文件夹组织下载内容
- 📊 **数量控制**: 自定义每个用户的下载笔记数量
- 📂 **文件导入**: 支持导入UID列表文件

## 🎨 界面优化
- 💫 **双栏布局**: 采用与搜索下载一致的专业界面设计
- 📝 **标题显示**: 显示笔记真实标题而非ID
- ✅ **下载记录**: 完整的已完成下载和已跳过视频列表
- 🔄 **重新下载**: 支持选择跳过的视频重新下载

## 🔧 技术改进
- ⚡ **重试机制**: 增强的消息重试和错误处理
- 🐛 **调试增强**: 详细的调试日志和状态验证
- 🧹 **资源管理**: 优化的标签页管理和资源清理
- 🛡️ **稳定性**: 改进的API调用和备用方案处理

## 📖 使用说明
1. 点击扩展图标，选择"用户批量下载"
2. 输入小红书用户UID列表（每行一个）
3. 设置下载数量和导入文件（可选）
4. 点击"开始批量下载"开始下载

**UID获取方法**: 用户主页URL的最后部分即为UID
例如：`https://www.xiaohongshu.com/user/profile/61c4a427000000001000d7c4`
UID为：`61c4a427000000001000d7c4`

## 🔗 下载链接
[Chrome扩展包 (.crx)](https://github.com/Rayinf/cat-catch-xhs-download/releases/download/v0.3.0/cat-catch-xhs-download.crx)
```

4. 上传扩展包文件（.crx文件）
5. 点击 "Publish release"

### 更新扩展包
1. 在项目目录中生成新的.crx文件
2. 将新版本的.crx文件添加到Release

---

## ❗ 常见问题处理

### 1. 推送被拒绝 (push rejected)
```bash
# 先拉取远程更改
git pull origin main

# 解决冲突后重新推送
git push origin main
```

### 2. 认证失败
- **HTTPS方式**: 使用GitHub Personal Access Token
  - GitHub Settings → Developer settings → Personal access tokens
  - 生成新令牌，复制并在命令行中使用
- **SSH方式**: 配置SSH密钥
  ```bash
  ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
  # 将生成的公钥添加到GitHub SSH Keys
  ```

### 3. 文件过大
- GitHub单文件限制100MB
- 大文件需要使用Git LFS
- 或将大文件放到其他云存储服务

### 4. 分支冲突
```bash
# 查看分支状态
git branch -a

# 切换到main分支
git checkout main

# 强制推送（谨慎使用）
git push origin main --force
```

### 5. 提交信息修改
```bash
# 修改最后一次提交信息
git commit --amend -m "新的提交信息"

# 如果已经推送，需要强制推送
git push origin main --force
```

---

## 📝 最佳实践

### 1. 提交信息规范
```
类型(范围): 简短描述

详细描述（可选）

- 功能点1
- 功能点2
- 修复问题
```

### 2. 分支管理
- `main`: 主分支，稳定版本
- `develop`: 开发分支
- `feature/功能名`: 功能分支

### 3. 版本号规范
- `vX.Y.Z`: 主版本.次版本.修订版本
- 主版本：不兼容的API修改
- 次版本：向下兼容的功能性新增
- 修订版本：向下兼容的问题修正

### 4. Release说明
- 清晰的版本说明
- 功能特性列表
- 已知问题说明
- 使用指导

---

## 🔄 自动化建议

### GitHub Actions自动发布
创建 `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - name: Create Release
      uses: actions/create-release@v1
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      with:
        tag_name: ${{ github.ref }}
        release_name: Release ${{ github.ref }}
        draft: false
        prerelease: false
```

---

## 📞 获取帮助

- **GitHub文档**: [https://docs.github.com/](https://docs.github.com/)
- **Git教程**: [https://git-scm.com/book](https://git-scm.com/book)
- **问题反馈**: 在GitHub仓库中创建Issue

---

**✅ 恭喜！您已成功将v0.3.0版本推送到GitHub！**

项目地址：[https://github.com/Rayinf/cat-catch-xhs-download](https://github.com/Rayinf/cat-catch-xhs-download)