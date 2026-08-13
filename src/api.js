/**
 * 后端接口封装。
 * 全部请求都带 Cookie，登录态由服务端的 HttpOnly Cookie 维持。
 */

/**
 * 统一的请求方法，负责序列化、带 Cookie 与错误抛出。
 * @param {string} url 接口路径
 * @param {object} [options] fetch 选项，body 传对象即可
 * @returns {Promise<any>} 解析后的响应体
 * @throws {Error} 请求失败时抛出，error.code 为后端返回的错误码
 */
async function request(url, options = {}) {
    const { body, ...rest } = options
    const response = await fetch(url, {
        credentials: 'include',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        ...rest
    })

    if (!response.ok) {
        const detail = await response.json().catch(() => ({}))
        const error = new Error(detail.error || `HTTP_${response.status}`)
        error.code = detail.error || `HTTP_${response.status}`
        error.status = response.status
        throw error
    }

    return response.json()
}

export const api = {
    /**
     * 登录，账号不存在时后端会自动创建。
     * @param {string} username 用户名
     * @param {string} password 密码
     * @returns {Promise<{user: object, created: boolean}>} 用户信息与是否为新建账号
     */
    login: (username, password) =>
        request('/api/auth/login', { method: 'POST', body: { username, password } }),

    /** @returns {Promise<{ok: boolean}>} 登出结果 */
    logout: () => request('/api/auth/logout', { method: 'POST' }),

    /** @returns {Promise<{user: object}>} 当前登录用户 */
    me: () => request('/api/auth/me'),

    /** @returns {Promise<{todos: object[], user: object}>} 待办列表与用户信息 */
    fetchTodos: () => request('/api/todos'),

    /**
     * 整体覆盖保存待办列表，顺序即为展示顺序。
     * @param {object[]} todos 完整待办列表
     * @returns {Promise<{todos: object[]}>} 落库后的列表
     */
    saveTodos: (todos) => request('/api/todos', { method: 'PUT', body: { todos } }),

    /**
     * 保存用户偏好设置。
     * @param {{slogan?: string, lang?: string}} settings 待保存的设置项
     * @returns {Promise<{user: object}>} 更新后的用户信息
     */
    saveSettings: (settings) => request('/api/settings', { method: 'PUT', body: settings }),

    /**
     * 上传一张图片。
     * @param {string} dataUrl 图片 data URL
     * @param {number} width 像素宽
     * @param {number} height 像素高
     * @returns {Promise<{image: object}>} 图片记录
     */
    uploadImage: (dataUrl, width, height) =>
        request('/api/images', { method: 'POST', body: { dataUrl, width, height } }),

    /** @returns {Promise<object>} 含 base64 图片的完整导出数据 */
    exportData: () => request('/api/export'),

    /**
     * 导入数据，追加到当前列表前面。
     * @param {object|object[]} payload 导出文件内容，兼容旧版裸数组
     * @returns {Promise<{todos: object[], imported: number}>} 导入结果
     */
    importData: (payload) => request('/api/import', { method: 'POST', body: payload })
}

/**
 * 拼出图片的访问地址。
 * @param {string} imageId 图片 id
 * @returns {string} 图片 URL
 */
export function imageUrl(imageId) {
    return `/api/images/${imageId}`
}
