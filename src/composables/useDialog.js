import { reactive } from 'vue'
import { t } from '../i18n.js'

/** 全局对话框状态，由 App.vue 中的 AppDialog 组件统一渲染 */
export const dialogState = reactive({
    visible: false,
    mode: 'alert',
    title: '',
    message: '',
    resolve: null
})

/**
 * 打开对话框并等待用户操作。
 * @param {'alert'|'confirm'} mode 对话框类型
 * @param {string} message 正文
 * @param {string} [title] 标题，缺省时按类型取默认标题
 * @returns {Promise<boolean>} confirm 返回用户是否点了确定，alert 恒为 true
 */
function open(mode, message, title) {
    dialogState.mode = mode
    dialogState.message = message
    dialogState.title = title || (mode === 'confirm' ? t('confirmTitle') : t('dialogTitle'))
    dialogState.visible = true

    return new Promise((resolve) => {
        dialogState.resolve = resolve
    })
}

/**
 * 关闭对话框并回传结果。
 * @param {boolean} result 用户选择
 * @returns {void}
 */
export function closeDialog(result) {
    dialogState.visible = false
    dialogState.resolve?.(result)
    dialogState.resolve = null
}

/**
 * 提示框，仅有一个确定按钮。
 * @param {string} message 正文
 * @param {string} [title] 标题
 * @returns {Promise<boolean>} 关闭后 resolve
 */
export const showAlert = (message, title) => open('alert', message, title)

/**
 * 确认框，有确定与取消。
 * @param {string} message 正文
 * @param {string} [title] 标题
 * @returns {Promise<boolean>} 用户是否确认
 */
export const showConfirm = (message, title) => open('confirm', message, title)
