import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

/** 数据根目录，Docker 中挂载为数据卷 */
export const DATA_DIR = path.resolve(process.env.DATA_DIR || './data')
/** 图片文件存放目录，按用户分子目录 */
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads')

fs.mkdirSync(UPLOAD_DIR, { recursive: true })

export const db = new Database(path.join(DATA_DIR, 'todo.db'))

// WAL 模式让读写并发更顺滑，单文件部署下也便于备份
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    slogan        TEXT    NOT NULL DEFAULT '',
    lang          TEXT    NOT NULL DEFAULT 'zh',
    created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS todos (
    id         TEXT    PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT    NOT NULL DEFAULT '',
    images     TEXT    NOT NULL DEFAULT '[]',
    completed  INTEGER NOT NULL DEFAULT 0,
    removed    INTEGER NOT NULL DEFAULT 0,
    priority   INTEGER NOT NULL DEFAULT 2,
    position   INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_todos_user ON todos(user_id, position);

CREATE TABLE IF NOT EXISTS images (
    id         TEXT    PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mime       TEXT    NOT NULL,
    ext        TEXT    NOT NULL,
    width      INTEGER NOT NULL DEFAULT 0,
    height     INTEGER NOT NULL DEFAULT 0,
    size       INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_images_user ON images(user_id);
`)

/**
 * 增量迁移：给已存在的表补上后来新增的列。
 *
 * 上面的 CREATE TABLE IF NOT EXISTS 只对全新的库生效，已经在跑的库不会被改动，
 * 所以新增字段必须在这里显式 ALTER，否则升级后旧库会因缺列而报错。
 *
 * @returns {void}
 */
function migrate() {
    const columns = db.prepare('PRAGMA table_info(todos)').all().map((column) => column.name)

    // 优先级：0=P0 最高，1=P1，2=P2。存量待办统一按 P2 处理
    if (!columns.includes('priority')) {
        db.exec('ALTER TABLE todos ADD COLUMN priority INTEGER NOT NULL DEFAULT 2')
    }
}

migrate()

/**
 * 拼出某张图片在磁盘上的绝对路径。
 * @param {number} userId 图片归属用户
 * @param {{id: string, ext: string}} image 图片记录
 * @returns {string} 绝对路径
 */
export function imagePath(userId, image) {
    return path.join(UPLOAD_DIR, String(userId), `${image.id}.${image.ext}`)
}

/**
 * 清理未被任何待办引用的孤儿图片。
 *
 * 之所以要留一个宽限期：用户可能先上传了图片、还没点提交，此时图片尚未被任何
 * 待办引用；若立刻回收，正在编辑的内容就会丢图。超过宽限期仍无人引用的，
 * 才认定是彻底删除待办后遗留的垃圾。
 *
 * @param {number} [graceMs=3600000] 宽限期，默认 1 小时
 * @returns {number} 实际清理掉的图片数量
 */
export function sweepOrphanImages(graceMs = 60 * 60 * 1000) {
    const referenced = new Set()
    for (const row of db.prepare('SELECT images FROM todos').all()) {
        for (const image of JSON.parse(row.images || '[]')) {
            referenced.add(typeof image === 'string' ? image : image?.id)
        }
    }

    const deadline = Date.now() - graceMs
    const candidates = db.prepare('SELECT * FROM images WHERE created_at < ?').all(deadline)
    const drop = db.prepare('DELETE FROM images WHERE id = ?')

    let removed = 0
    for (const image of candidates) {
        if (referenced.has(image.id)) continue
        fs.rmSync(imagePath(image.user_id, image), { force: true })
        drop.run(image.id)
        removed++
    }
    return removed
}
