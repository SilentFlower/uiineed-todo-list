# Todo List

一个极简设计的网页版待办清单。支持账号登录、图片附件、回收站与数据导入导出，可用 Docker 私有部署，数据完全存在自己的服务器上。

## 特性

- 🔐 **账号登录**：用户名 + 密码登录，账号不存在时自动创建；每个账号的待办与图片完全隔离
- 🖼 **图片附件**：`Ctrl / ⌘ + V` 直接粘贴图片，也可点按钮选择文件；点击缩略图看大图
- 📖 **长内容折叠**：内容较多的待办默认收起，点「展开全部」再看完整内容
- 🕒 **时间记录**：每条待办显示创建、更新与完成时间，鼠标悬停可看精确到秒的完整时间
- 🗑 **回收站**：删除先进回收站，可还原；也可对单条彻底删除或一键清空，关联图片会一并从磁盘清除
- 📦 **导入导出**：导出为自包含 JSON，图片以 base64 内嵌，换台机器导入即可还原
- ✏️ 双击标语和待办可编辑，拖拽可排序（PC），所有提交支持回车
- 🌏 中英文界面切换，语言选择跟随账号

## 快速开始

### 用 Docker Compose（推荐）

```bash
# 生成一个登录令牌密钥
export JWT_SECRET=$(openssl rand -hex 32)

docker compose up -d
```

打开 <http://localhost:3000>，输入任意用户名和密码（至少 6 位）即可创建账号。

### 用 docker run

```bash
docker run -d \
  --name todo \
  -p 3000:3000 \
  -e JWT_SECRET=$(openssl rand -hex 32) \
  -v todo-data:/data \
  ghcr.io/silentflower/uiineed-todo-list:latest
```

### 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 服务监听端口 |
| `DATA_DIR` | `/data` | 数据目录，存放 SQLite 数据库与上传的图片 |
| `JWT_SECRET` | 自动生成 | 签发登录令牌的密钥。不配置时会在数据目录生成并持久化一份随机密钥 |
| `COOKIE_SECURE` | `0` | 站点通过 HTTPS 对外提供时设为 `1`，让登录 Cookie 带上 `Secure` |

### 数据与备份

所有数据都在 `DATA_DIR` 下，直接打包这个目录即可备份：

```
/data
├── todo.db          # SQLite 数据库（用户、待办、图片元信息）
├── .jwt-secret      # 未配置 JWT_SECRET 时自动生成的密钥
└── uploads/<用户ID>/ # 图片原文件
```

## 本地开发

```bash
npm install
npm run dev
```

`npm run dev` 会同时起后端（3000）和 Vite 开发服务器（5173），前端的 `/api` 请求自动代理到后端。开发时数据默认写在项目下的 `./data`。

构建生产版本：

```bash
npm run build   # 前端产物输出到 dist/
npm start       # 由后端同时托管 dist/ 与 API
```

## 自动构建

`.github/workflows/docker.yml` 会在推送到 `main` 或打 `v*` 标签时，自动构建 `linux/amd64` 与 `linux/arm64` 双架构镜像并推送到 GitHub Container Registry。Pull Request 只做构建校验，不推送镜像。

镜像地址：`ghcr.io/<你的 GitHub 用户名>/<仓库名>`。首次推送后记得在仓库的 Packages 设置里把镜像可见性调成你需要的。

## 技术栈

- 前端：Vue 3 + Vite + Sass
- 后端：Node.js + Express + SQLite（better-sqlite3）
- 鉴权：scrypt 加盐哈希 + JWT（HttpOnly Cookie）

## 使用说明 💡

- ✔️ 所有提交操作支持 Enter 回车键提交
- ✔️ 拖拽 Todo 上下移动可排序（仅支持 PC）
- ✔️ 双击上面的标语和 Todo 可进行编辑
- ✔️ 右侧的小窗口是快捷操作
- 🖼 支持 Ctrl+V 直接粘贴图片到待办
- 🔒 数据按账号保存在你自己的服务器
- 📝 支持导出和导入，导入追加到当前序列

---

<div id="intro"></div>

# Todo List (English)

A minimalist web-based todo list with account login, image attachments, a trash bin and data import/export. Self-host it with Docker and keep all data on your own server.

## Features

- 🔐 **Account login** — sign in with a username and password; the account is created automatically on first use, and each account's todos and images are fully isolated
- 🖼 **Image attachments** — paste with `Ctrl / ⌘ + V`, or pick files with a button; click a thumbnail for the full-size view
- 📖 **Collapsible content** — long todos are collapsed by default, expand them with one click
- 🕒 **Timestamps** — every todo shows when it was created, updated and completed; hover for the exact time down to the second
- 🗑 **Trash bin** — deleted items go to the trash and can be restored, or permanently deleted one by one / all at once, which also removes their images from disk
- 📦 **Import & export** — export to a self-contained JSON with base64-embedded images, then import it anywhere
- ✏️ Double-click to edit the slogan and todos, drag to reorder (PC), press Enter to submit
- 🌏 Chinese / English interface, remembered per account

## Quick start

```bash
export JWT_SECRET=$(openssl rand -hex 32)
docker compose up -d
```

Open <http://localhost:3000> and sign in with any username and a password of at least 6 characters.

See the environment variable table above for configuration. All data lives under `DATA_DIR` (`/data` by default) — back up that directory and you have backed up everything.

## Local development

```bash
npm install
npm run dev     # backend on :3000, Vite dev server on :5173
```

## License

MIT. See [LICENSE](./LICENSE).

This project is a derivative of the open-source [uiineed-todo-list](https://github.com/ricocc/uiineed-todo-list), whose original MIT copyright notice is retained in `LICENSE` as the license requires.
