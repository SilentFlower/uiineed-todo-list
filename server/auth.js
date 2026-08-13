import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { db, DATA_DIR } from './db.js'

/** 登录态 Cookie 名 */
export const COOKIE_NAME = 'todo_token'
/** 登录态有效期：30 天 */
const TOKEN_TTL = '30d'
const SCRYPT_KEYLEN = 64

/**
 * 取得签发 JWT 用的密钥。
 * 优先读环境变量；未配置时在数据目录生成一份随机密钥并持久化，
 * 这样容器重启后已登录用户不会被强制登出。
 * @returns {string} 密钥
 */
function resolveSecret() {
    if (process.env.JWT_SECRET) return process.env.JWT_SECRET

    const secretFile = path.join(DATA_DIR, '.jwt-secret')
    if (!fs.existsSync(secretFile)) {
        fs.writeFileSync(secretFile, crypto.randomBytes(48).toString('hex'), { mode: 0o600 })
    }
    return fs.readFileSync(secretFile, 'utf8').trim()
}

const SECRET = resolveSecret()

/**
 * 用 scrypt 对密码做加盐哈希。
 * @param {string} password 明文密码
 * @returns {string} `scrypt$<salt>$<hash>` 格式的哈希串
 */
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex')
    return `scrypt$${salt}$${hash}`
}

/**
 * 校验密码是否与哈希串匹配，使用定长时间比较避免时序侧信道。
 * @param {string} password 明文密码
 * @param {string} stored 数据库中存的哈希串
 * @returns {boolean} 是否匹配
 */
function verifyPassword(password, stored) {
    const [scheme, salt, hash] = String(stored).split('$')
    if (scheme !== 'scrypt' || !salt || !hash) return false

    const expected = Buffer.from(hash, 'hex')
    const actual = crypto.scryptSync(password, salt, expected.length)
    return crypto.timingSafeEqual(expected, actual)
}

/**
 * 登录，账号不存在时自动注册。
 * @param {string} username 用户名
 * @param {string} password 密码
 * @returns {{ok: true, user: object, created: boolean} | {ok: false, error: string}} 结果
 */
export function loginOrRegister(username, password) {
    const name = String(username || '').trim()
    const pass = String(password || '')

    if (name.length < 2 || name.length > 32) return { ok: false, error: 'INVALID_USERNAME' }
    if (pass.length < 6) return { ok: false, error: 'PASSWORD_TOO_SHORT' }

    const existing = db.prepare('SELECT * FROM users WHERE username = ?').get(name)
    if (existing) {
        if (!verifyPassword(pass, existing.password_hash)) return { ok: false, error: 'BAD_CREDENTIALS' }
        return { ok: true, user: existing, created: false }
    }

    const info = db
        .prepare('INSERT INTO users (username, password_hash, slogan, created_at) VALUES (?, ?, ?, ?)')
        .run(name, hashPassword(pass), '', Date.now())
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid)
    return { ok: true, user, created: true }
}

/**
 * 为用户签发登录令牌。
 * @param {{id: number, username: string}} user 用户
 * @returns {string} JWT
 */
export function signToken(user) {
    return jwt.sign({ uid: user.id, name: user.username }, SECRET, { expiresIn: TOKEN_TTL })
}

/**
 * Express 中间件：校验 Cookie 中的登录态，并把用户挂到 req.user。
 * @param {import('express').Request} req 请求
 * @param {import('express').Response} res 响应
 * @param {import('express').NextFunction} next 下一个中间件
 */
export function requireAuth(req, res, next) {
    const token = req.cookies?.[COOKIE_NAME]
    if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' })

    try {
        const payload = jwt.verify(token, SECRET)
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid)
        if (!user) return res.status(401).json({ error: 'UNAUTHORIZED' })

        req.user = user
        next()
    } catch {
        res.status(401).json({ error: 'UNAUTHORIZED' })
    }
}

/**
 * 统一的 Cookie 写入选项。生产环境走 HTTPS 时可通过 COOKIE_SECURE=1 开启 Secure。
 * @returns {object} cookie 选项
 */
export function cookieOptions() {
    return {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.COOKIE_SECURE === '1',
        maxAge: 30 * 24 * 60 * 60 * 1000
    }
}
