import crypto from 'node:crypto'
import { db } from './db.js'
import { deleteImages } from './images.js'

/** 单条待办文本长度上限 */
const MAX_TITLE_LENGTH = 20000
/** 单个用户的待办条数上限，防止异常写入撑爆库 */
const MAX_TODOS = 5000

/**
 * 把数据库行转成前端使用的待办对象。
 * @param {object} row todos 表的一行
 * @returns {{id: string, title: string, images: object[], completed: boolean, removed: boolean, createdAt: number}} 待办对象
 */
function rowToTodo(row) {
    return {
        id: row.id,
        title: row.title,
        images: JSON.parse(row.images || '[]'),
        completed: !!row.completed,
        removed: !!row.removed,
        createdAt: row.created_at
    }
}

/**
 * 读取某个用户的全部待办（含回收站），按展示顺序排列。
 * @param {number} userId 用户 id
 * @returns {object[]} 待办列表
 */
export function listTodos(userId) {
    return db
        .prepare('SELECT * FROM todos WHERE user_id = ? ORDER BY position ASC')
        .all(userId)
        .map(rowToTodo)
}

/**
 * 清洗前端传来的待办数据，只保留合法字段。
 *
 * 图片引用必须校验归属：否则伪造一个别人的图片 id 就能越权读到他人图片。
 *
 * @param {number} userId 用户 id
 * @param {object} raw 前端传入的原始对象
 * @returns {object|null} 清洗后的待办，非法时返回 null
 */
function normalizeTodo(userId, raw) {
    if (!raw || typeof raw !== 'object') return null

    const title = String(raw.title ?? '').slice(0, MAX_TITLE_LENGTH)

    // 兼容两种写法：图片 id 字符串数组，或 {id,width,height} 对象数组
    const rawImages = Array.isArray(raw.images) ? raw.images : []
    const owns = db.prepare('SELECT width, height FROM images WHERE id = ? AND user_id = ?')
    const images = []
    for (const item of rawImages.slice(0, 20)) {
        const id = typeof item === 'string' ? item : item?.id
        if (typeof id !== 'string') continue
        const meta = owns.get(id, userId)
        if (!meta) continue
        images.push({ id, width: meta.width, height: meta.height })
    }

    if (!title.trim() && !images.length) return null

    return {
        id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 64) : crypto.randomUUID(),
        title,
        images,
        completed: !!raw.completed,
        removed: !!raw.removed,
        createdAt: Number(raw.createdAt) || Date.now()
    }
}

/**
 * 用前端提交的列表整体覆盖该用户的待办。
 *
 * 列表中不再出现的条目视为「彻底删除」：连同其独占的图片一并物理清除，
 * 这也是回收站里那个真删除按钮最终落到的地方。
 *
 * @param {number} userId 用户 id
 * @param {object[]} incoming 前端提交的完整待办列表
 * @returns {object[]} 落库后的待办列表
 */
export function replaceTodos(userId, incoming) {
    const normalized = incoming
        .slice(0, MAX_TODOS)
        .map((item) => normalizeTodo(userId, item))
        .filter(Boolean)

    const keepIds = new Set(normalized.map((todo) => todo.id))
    const stillUsed = new Set(normalized.flatMap((todo) => todo.images.map((image) => image.id)))

    const apply = db.transaction(() => {
        const previous = db.prepare('SELECT * FROM todos WHERE user_id = ?').all(userId)

        const orphanImages = []
        const dropTodo = db.prepare('DELETE FROM todos WHERE id = ? AND user_id = ?')
        for (const row of previous) {
            if (keepIds.has(row.id)) continue
            for (const image of JSON.parse(row.images || '[]')) {
                const id = typeof image === 'string' ? image : image?.id
                if (id && !stillUsed.has(id)) orphanImages.push(id)
            }
            dropTodo.run(row.id, userId)
        }
        deleteImages(userId, orphanImages)

        const now = Date.now()
        const upsert = db.prepare(
            `INSERT INTO todos (id, user_id, title, images, completed, removed, position, created_at, updated_at)
             VALUES (@id, @user_id, @title, @images, @completed, @removed, @position, @created_at, @updated_at)
             ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                images = excluded.images,
                completed = excluded.completed,
                removed = excluded.removed,
                position = excluded.position,
                updated_at = excluded.updated_at`
        )
        normalized.forEach((todo, index) => {
            upsert.run({
                id: todo.id,
                user_id: userId,
                title: todo.title,
                images: JSON.stringify(todo.images),
                completed: todo.completed ? 1 : 0,
                removed: todo.removed ? 1 : 0,
                position: index,
                created_at: todo.createdAt,
                updated_at: now
            })
        })
    })

    apply()
    return listTodos(userId)
}
