import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { db, UPLOAD_DIR, imagePath } from './db.js'

/** 允许上传的图片类型及其落盘扩展名 */
const ALLOWED_MIME = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif'
}

/** 单张图片体积上限：10MB */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

/**
 * 解析 data URL，取出 MIME 与二进制内容。
 * @param {string} dataUrl 形如 `data:image/png;base64,xxx` 的字符串
 * @returns {{mime: string, ext: string, buffer: Buffer} | null} 解析结果，非法时返回 null
 */
export function parseDataUrl(dataUrl) {
    const matched = /^data:([\w/+.-]+);base64,([\s\S]+)$/.exec(String(dataUrl || ''))
    if (!matched) return null

    const mime = matched[1].toLowerCase()
    const ext = ALLOWED_MIME[mime]
    if (!ext) return null

    const buffer = Buffer.from(matched[2], 'base64')
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) return null

    return { mime, ext, buffer }
}

/**
 * 将一张 data URL 图片落盘并登记到数据库。
 * @param {number} userId 归属用户
 * @param {string} dataUrl 图片 data URL
 * @param {{width?: number, height?: number}} [size] 客户端上报的像素尺寸，用于前端占位
 * @returns {{id: string, mime: string, width: number, height: number, size: number} | null} 图片记录，非法时返回 null
 */
export function saveImage(userId, dataUrl, size = {}) {
    const parsed = parseDataUrl(dataUrl)
    if (!parsed) return null

    const id = crypto.randomUUID()
    const record = {
        id,
        user_id: userId,
        mime: parsed.mime,
        ext: parsed.ext,
        width: Number(size.width) || 0,
        height: Number(size.height) || 0,
        size: parsed.buffer.length,
        created_at: Date.now()
    }

    fs.mkdirSync(path.join(UPLOAD_DIR, String(userId)), { recursive: true })
    fs.writeFileSync(imagePath(userId, record), parsed.buffer)

    db.prepare(
        `INSERT INTO images (id, user_id, mime, ext, width, height, size, created_at)
         VALUES (@id, @user_id, @mime, @ext, @width, @height, @size, @created_at)`
    ).run(record)

    return { id, mime: record.mime, width: record.width, height: record.height, size: record.size }
}

/**
 * 把已存储的图片读回 data URL，供导出时内嵌进 JSON。
 * @param {number} userId 归属用户
 * @param {string} imageId 图片 id
 * @returns {{id: string, dataUrl: string, width: number, height: number} | null} 图片数据，缺失时返回 null
 */
export function imageToDataUrl(userId, imageId) {
    const image = db.prepare('SELECT * FROM images WHERE id = ? AND user_id = ?').get(imageId, userId)
    if (!image) return null

    const file = imagePath(userId, image)
    if (!fs.existsSync(file)) return null

    const base64 = fs.readFileSync(file).toString('base64')
    return {
        id: image.id,
        dataUrl: `data:${image.mime};base64,${base64}`,
        width: image.width,
        height: image.height
    }
}

/**
 * 彻底删除若干张图片（磁盘文件 + 数据库记录）。
 * @param {number} userId 归属用户
 * @param {string[]} imageIds 待删除的图片 id 列表
 * @returns {void}
 */
export function deleteImages(userId, imageIds) {
    if (!imageIds?.length) return

    const find = db.prepare('SELECT * FROM images WHERE id = ? AND user_id = ?')
    const drop = db.prepare('DELETE FROM images WHERE id = ? AND user_id = ?')

    for (const imageId of imageIds) {
        const image = find.get(imageId, userId)
        if (!image) continue
        fs.rmSync(imagePath(userId, image), { force: true })
        drop.run(imageId, userId)
    }
}
