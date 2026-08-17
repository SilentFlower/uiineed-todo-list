/**
 * 时间格式化工具：把毫秒时间戳转成待办卡片上展示的文本。
 *
 * 一律输出数字格式，中英文界面通用，不必再走一遍 i18n。
 */

/**
 * 补足两位数字。
 * @param {number} value 数值
 * @returns {string} 两位字符串
 */
function pad(value) {
    return String(value).padStart(2, '0')
}

/**
 * 格式化成卡片上展示的短时间。
 *
 * 今年内的时间省掉年份、精确到分钟（`08-17 14:30`），跨年的则只保留日期
 * （`2025-12-01`）—— 半年前某条待办具体几点几分建完并无意义，年份才是。
 *
 * @param {number|null} ms 毫秒时间戳
 * @returns {string} 短时间文本，无效时间返回空串
 */
export function formatStamp(ms) {
    if (!ms) return ''

    const date = new Date(ms)
    if (Number.isNaN(date.getTime())) return ''

    if (date.getFullYear() !== new Date().getFullYear()) {
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    }
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * 格式化成完整时间，用于鼠标悬停时的补充提示。
 * @param {number|null} ms 毫秒时间戳
 * @returns {string} `YYYY-MM-DD HH:mm:ss`，无效时间返回空串
 */
export function formatFull(ms) {
    if (!ms) return ''

    const date = new Date(ms)
    if (Number.isNaN(date.getTime())) return ''

    const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
