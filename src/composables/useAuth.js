import { ref } from 'vue'
import { api } from '../api.js'
import { setLocale, t } from '../i18n.js'
import { showAlert } from './useDialog.js'

/** 当前登录用户，null 表示未登录 */
export const user = ref(null)
/** 是否还在做首次登录态探测，用于避免登录页一闪而过 */
export const authChecking = ref(true)

/**
 * 启动时检查是否已有有效登录态。
 * @returns {Promise<void>}
 */
export async function restoreSession() {
    try {
        const { user: current } = await api.me()
        user.value = current
        if (current.lang) setLocale(current.lang)
    } catch {
        user.value = null
    } finally {
        authChecking.value = false
    }
}

/**
 * 登录，账号不存在时后端自动创建。
 *
 * 新账号的欢迎提示放在这里而不是登录组件里：设置 user 之后，
 * 登录页会立刻被卸载，组件内 await 之后的事件已经没人接收了。
 *
 * @param {string} username 用户名
 * @param {string} password 密码
 * @returns {Promise<boolean>} 是否为本次新建的账号
 */
export async function login(username, password) {
    const { user: current, created } = await api.login(username, password)
    user.value = current
    if (created) showAlert(t('welcomeNew', current.username))
    return created
}

/**
 * 退出登录并清空本地用户态。
 * @returns {Promise<void>}
 */
export async function logout() {
    await api.logout()
    user.value = null
}
