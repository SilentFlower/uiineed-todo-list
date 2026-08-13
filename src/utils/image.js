/**
 * 图片处理工具：把用户粘贴或选择的文件转成适合上传的 data URL。
 */

/** 上传前的最长边限制，超出则等比缩放 */
const MAX_EDGE = 1600
/** 原图直接透传的体积上限，超过则重新编码压缩 */
const RECOMPRESS_THRESHOLD = 400 * 1024
/** 上传体积硬上限，与服务端保持一致 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

/**
 * 判断一个文件是否为受支持的图片。
 * @param {File} file 文件
 * @returns {boolean} 是否支持
 */
export function isSupportedImage(file) {
    return /^image\/(png|jpeg|webp|gif)$/.test(file?.type || '')
}

/**
 * 从剪贴板事件中提取图片文件，用于 Ctrl+V 粘贴。
 * @param {ClipboardEvent} event 粘贴事件
 * @returns {File[]} 图片文件列表
 */
export function imagesFromClipboard(event) {
    const items = Array.from(event.clipboardData?.items || [])
    return items
        .filter((item) => item.kind === 'file')
        .map((item) => item.getAsFile())
        .filter((file) => file && isSupportedImage(file))
}

/**
 * 读取文件为 data URL。
 * @param {File} file 文件
 * @returns {Promise<string>} data URL
 */
function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
    })
}

/**
 * 把图片文件转成可上传的 data URL，并顺带取出像素尺寸。
 *
 * GIF 不做重编码，否则动图会被压成一帧；其余格式在超过阈值时
 * 统一缩放并转成 JPEG，避免截图动辄几 MB 占满数据库。
 *
 * @param {File} file 图片文件
 * @returns {Promise<{dataUrl: string, width: number, height: number}>} 上传所需数据
 * @throws {Error} 文件过大或解码失败时抛出
 */
export async function prepareImage(file) {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error('IMAGE_TOO_LARGE')

    const original = await readAsDataUrl(file)
    const bitmap = await loadImage(original)

    const needsResize = Math.max(bitmap.width, bitmap.height) > MAX_EDGE
    const passthrough = file.type === 'image/gif' || (!needsResize && file.size <= RECOMPRESS_THRESHOLD)
    if (passthrough) {
        return { dataUrl: original, width: bitmap.width, height: bitmap.height }
    }

    const scale = needsResize ? MAX_EDGE / Math.max(bitmap.width, bitmap.height) : 1
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    // 透明区域在 JPEG 下会变黑，先铺一层白底
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(bitmap, 0, 0, width, height)

    return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), width, height }
}

/**
 * 把 data URL 解码成可绘制的图片对象。
 * @param {string} src data URL
 * @returns {Promise<HTMLImageElement>} 图片对象
 */
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'))
        image.src = src
    })
}
