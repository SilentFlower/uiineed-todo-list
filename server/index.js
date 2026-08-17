import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cookieParser from 'cookie-parser'

import { db, imagePath, sweepOrphanImages } from './db.js'
import { COOKIE_NAME, cookieOptions, loginOrRegister, requireAuth, signToken } from './auth.js'
import { deleteImages, imageToDataUrl, saveImage } from './images.js'
import { listTodos, replaceTodos } from './todos.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.join(__dirname, '..', 'dist')
const PORT = Number(process.env.PORT) || 3000

const app = express()
app.disable('x-powered-by')
// 图片以 base64 随 JSON 一起提交，因此请求体上限放宽到 25MB
app.use(express.json({ limit: '25mb' }))
app.use(cookieParser())

/**
 * 把用户实体裁剪成可以安全返回给前端的形状。
 * @param {object} user users 表的一行
 * @returns {{id: number, username: string, slogan: string, lang: string}} 公开用户信息
 */
function publicUser(user) {
    return { id: user.id, username: user.username, slogan: user.slogan, lang: user.lang }
}

/* ------------------------------------------------------------------ 鉴权 */

// 容器健康检查用，不需要登录态
app.get('/api/health', (req, res) => res.json({ ok: true }))

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body || {}
    const result = loginOrRegister(username, password)
    if (!result.ok) return res.status(400).json({ error: result.error })

    res.cookie(COOKIE_NAME, signToken(result.user), cookieOptions())
    res.json({ user: publicUser(result.user), created: result.created })
})

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME, cookieOptions())
    res.json({ ok: true })
})

app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ user: publicUser(req.user) })
})

/* ------------------------------------------------------------- 待办与设置 */

app.get('/api/todos', requireAuth, (req, res) => {
    res.json({ todos: listTodos(req.user.id), user: publicUser(req.user) })
})

app.put('/api/todos', requireAuth, (req, res) => {
    const { todos } = req.body || {}
    if (!Array.isArray(todos)) return res.status(400).json({ error: 'INVALID_PAYLOAD' })

    res.json({ todos: replaceTodos(req.user.id, todos) })
})

app.put('/api/settings', requireAuth, (req, res) => {
    const { slogan, lang } = req.body || {}
    if (typeof slogan === 'string') {
        db.prepare('UPDATE users SET slogan = ? WHERE id = ?').run(slogan.slice(0, 200), req.user.id)
    }
    if (lang === 'zh' || lang === 'en') {
        db.prepare('UPDATE users SET lang = ? WHERE id = ?').run(lang, req.user.id)
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
    res.json({ user: publicUser(user) })
})

/* --------------------------------------------------------------------- 图片 */

app.post('/api/images', requireAuth, (req, res) => {
    const { dataUrl, width, height } = req.body || {}
    const image = saveImage(req.user.id, dataUrl, { width, height })
    if (!image) return res.status(400).json({ error: 'INVALID_IMAGE' })

    res.json({ image })
})

app.get('/api/images/:id', requireAuth, (req, res) => {
    const image = db.prepare('SELECT * FROM images WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id)
    if (!image) return res.status(404).end()

    const file = imagePath(req.user.id, image)
    if (!fs.existsSync(file)) return res.status(404).end()

    // 图片内容不可变，长缓存；private 避免被公共代理缓存后泄露给其他用户
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable')
    res.type(image.mime).sendFile(file)
})

app.delete('/api/images/:id', requireAuth, (req, res) => {
    deleteImages(req.user.id, [req.params.id])
    res.json({ ok: true })
})

/* --------------------------------------------------------------- 导出与导入 */

app.get('/api/export', requireAuth, (req, res) => {
    const todos = listTodos(req.user.id)

    // 导出结果要能脱离服务端单独还原，因此图片一律内嵌成 base64
    const payload = {
        version: 2,
        exportedAt: new Date().toISOString(),
        slogan: req.user.slogan,
        todos: todos.map((todo) => ({
            ...todo,
            images: todo.images
                .map((image) => imageToDataUrl(req.user.id, image.id))
                .filter(Boolean)
        }))
    }

    res.setHeader('Content-Disposition', `attachment; filename="todos-${Date.now()}.json"`)
    res.json(payload)
})

app.post('/api/import', requireAuth, (req, res) => {
    const body = req.body || {}
    // v2 是本项目导出的结构；旧版本导出的是裸数组，这里一并兼容
    const incoming = Array.isArray(body) ? body : Array.isArray(body.todos) ? body.todos : null
    if (!incoming) return res.status(400).json({ error: 'INVALID_PAYLOAD' })

    const restored = []
    for (const item of incoming.slice(0, 2000)) {
        if (!item || typeof item !== 'object') continue

        // 导入的图片是 base64，需要重新落盘换成本用户名下的新 id
        const images = []
        for (const image of Array.isArray(item.images) ? item.images.slice(0, 20) : []) {
            if (typeof image?.dataUrl !== 'string') continue
            const saved = saveImage(req.user.id, image.dataUrl, image)
            if (saved) images.push({ id: saved.id, width: saved.width, height: saved.height })
        }

        restored.push({
            title: String(item.title ?? ''),
            images,
            completed: !!item.completed,
            removed: !!item.removed,
            priority: item.priority,
            createdAt: Number(item.createdAt) || Date.now(),
            // 导入的都是新行，这两个时间会被原样保留，历史记录才不会在导入后被抹平
            updatedAt: Number(item.updatedAt) || 0,
            completedAt: Number(item.completedAt) || 0
        })
    }

    // 追加到现有序列前面，与旧版「导入追加到当前序列」的行为保持一致
    const merged = [...restored, ...listTodos(req.user.id)]
    res.json({ todos: replaceTodos(req.user.id, merged), imported: restored.length })
})

/* ------------------------------------------------------------------ 静态资源 */

if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR))
    // 前端是单页应用，非 /api 的路由一律回落到 index.html
    app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')))
}

app.listen(PORT, () => {
    console.log(`[todo] 服务已启动: http://localhost:${PORT}`)
})

// 启动时清一次孤儿图片，之后每 6 小时再清一次
sweepOrphanImages()
setInterval(sweepOrphanImages, 6 * 60 * 60 * 1000).unref()
