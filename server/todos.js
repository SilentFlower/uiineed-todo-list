import crypto from 'node:crypto'
import { db } from './db.js'
import { deleteImages } from './images.js'

/** 单条待办文本长度上限 */
const MAX_TITLE_LENGTH = 20000
/** 单个用户的待办条数上限，防止异常写入撑爆库 */
const MAX_TODOS = 5000

/** 优先级取值：0=P0 最高，1=P1，2=P2 最低 */
const PRIORITIES = [0, 1, 2]
/** 未指定优先级时的默认档位 */
const DEFAULT_PRIORITY = 2

/**
 * 把数据库行转成前端使用的待办对象。
 * @param {object} row todos 表的一行
 * @returns {{id: string, title: string, images: object[], completed: boolean, removed: boolean, priority: number, createdAt: number, updatedAt: number, completedAt: number|null}} 待办对象
 */
function rowToTodo(row) {
    return {
        id: row.id,
        title: row.title,
        images: JSON.parse(row.images || '[]'),
        completed: !!row.completed,
        removed: !!row.removed,
        priority: row.priority,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at ?? null
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
        priority: PRIORITIES.includes(Number(raw.priority)) ? Number(raw.priority) : DEFAULT_PRIORITY,
        createdAt: Number(raw.createdAt) || Date.now(),
        // 这两个时间戳只在新建行（即导入历史数据）时被采信，已入库的待办一律以库中记录为准，
        // 详见 replaceTodos 中的推算逻辑。0 表示「前端没给」
        updatedAt: Number(raw.updatedAt) || 0,
        completedAt: Number(raw.completedAt) || 0
    }
}

/**
 * 判断待办内容相对于库中旧行是否发生了实质变化。
 *
 * 前端每次保存都是整表覆盖，若无条件把 updated_at 刷成当前时间，那么随便动一条待办，
 * 所有待办的「更新时间」都会跟着跳变，这个字段也就失去了意义，所以这里逐字段比对。
 * 拖拽排序只改变展示顺序、不算内容变更，因此 position 不参与比较。
 *
 * @param {object} before todos 表中的旧行
 * @param {object} todo 清洗后的新待办
 * @param {string} imagesJson 新待办图片列表序列化后的结果
 * @returns {boolean} 内容是否变化
 */
function isContentChanged(before, todo, imagesJson) {
    return (
        before.title !== todo.title ||
        before.images !== imagesJson ||
        !!before.completed !== todo.completed ||
        !!before.removed !== todo.removed ||
        before.priority !== todo.priority
    )
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
        const previousById = new Map(previous.map((row) => [row.id, row]))

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
            `INSERT INTO todos (id, user_id, title, images, completed, removed, priority, position, created_at, updated_at, completed_at)
             VALUES (@id, @user_id, @title, @images, @completed, @removed, @priority, @position, @created_at, @updated_at, @completed_at)
             ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                images = excluded.images,
                completed = excluded.completed,
                removed = excluded.removed,
                priority = excluded.priority,
                position = excluded.position,
                updated_at = excluded.updated_at,
                completed_at = excluded.completed_at`
        )
        normalized.forEach((todo, index) => {
            const before = previousById.get(todo.id)
            const images = JSON.stringify(todo.images)

            // 新建的待办把更新时间对齐到创建时间，看起来才不像「刚建好就被改过」；
            // 导入的历史数据则尊重文件里带来的值
            let updatedAt
            if (!before) updatedAt = todo.updatedAt || todo.createdAt
            else updatedAt = isContentChanged(before, todo, images) ? now : before.updated_at

            // 完成时间以服务端为准：取消完成即清空，重新完成就是新的时刻，
            // 只有「本来就是完成态」才沿用旧值，避免每次保存都把它刷新一遍
            let completedAt = null
            if (todo.completed) {
                if (before?.completed && before.completed_at) completedAt = before.completed_at
                else if (!before) completedAt = todo.completedAt || now
                else completedAt = now
            }

            upsert.run({
                id: todo.id,
                user_id: userId,
                title: todo.title,
                images,
                completed: todo.completed ? 1 : 0,
                removed: todo.removed ? 1 : 0,
                priority: todo.priority,
                position: index,
                created_at: todo.createdAt,
                updated_at: updatedAt,
                completed_at: completedAt
            })
        })
    })

    apply()
    return listTodos(userId)
}
