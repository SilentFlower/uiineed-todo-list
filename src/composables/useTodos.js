import { computed, ref } from 'vue'
import { api } from '../api.js'
import { t } from '../i18n.js'
import { showAlert } from './useDialog.js'
import { user } from './useAuth.js'

/** 全量待办（含回收站），顺序即展示顺序 */
export const todos = ref([])
/** 当前筛选：all / ongoing / completed / removed */
export const intention = ref('all')
/** 是否正在与服务端同步 */
export const syncing = ref(false)

let saveTimer = null
let pendingSave = false

/** 未删除的待办 */
export const activeTodos = computed(() => todos.value.filter((todo) => !todo.removed))
/** 未完成的待办 */
export const leftTodos = computed(() => activeTodos.value.filter((todo) => !todo.completed))
/** 已完成的待办 */
export const completedTodos = computed(() => activeTodos.value.filter((todo) => todo.completed))
/** 回收站中的待办 */
export const recycleBin = computed(() => todos.value.filter((todo) => todo.removed))

/** 当前筛选下应展示的列表 */
export const filteredTodos = computed(() => {
    if (intention.value === 'ongoing') return leftTodos.value
    if (intention.value === 'completed') return completedTodos.value
    if (intention.value === 'removed') return recycleBin.value
    return activeTodos.value
})

/**
 * 从服务端拉取当前用户的待办。
 * @returns {Promise<void>}
 */
export async function loadTodos() {
    const { todos: list, user: current } = await api.fetchTodos()
    todos.value = list
    user.value = current
}

/**
 * 立即把完整列表写回服务端。
 * @returns {Promise<void>}
 */
async function flush() {
    syncing.value = true
    try {
        const { todos: saved } = await api.saveTodos(todos.value)
        // 以服务端结果为准，补齐新建条目的 id
        todos.value = saved
    } catch {
        showAlert(t('saveFailed'), t('errorTitle'))
    } finally {
        syncing.value = false
        pendingSave = false
    }
}

/**
 * 延迟保存。连续操作（如拖拽排序、连点完成）只会触发一次请求。
 * @returns {void}
 */
export function persist() {
    pendingSave = true
    clearTimeout(saveTimer)
    saveTimer = setTimeout(flush, 400)
}

/**
 * 页面关闭前若仍有未落盘的改动，立刻同步一次。
 * @returns {void}
 */
export function flushIfPending() {
    if (!pendingSave) return
    clearTimeout(saveTimer)
    flush()
}

/**
 * 新增一条待办，插入到列表最前面。
 * @param {string} title 文本内容
 * @param {object[]} images 已上传的图片列表
 * @returns {void}
 */
export function addTodo(title, images = []) {
    todos.value.unshift({
        id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        images,
        completed: false,
        removed: false,
        createdAt: Date.now()
    })
    persist()
}

/**
 * 设置某条待办的完成状态。
 * @param {object} todo 待办
 * @param {boolean} completed 目标状态
 * @returns {void}
 */
export function setCompleted(todo, completed) {
    todo.completed = completed
    persist()
}

/**
 * 把待办移入回收站（可还原）。
 * @param {object} todo 待办
 * @returns {void}
 */
export function moveToTrash(todo) {
    todo.removed = true
    persist()
}

/**
 * 从回收站还原待办。
 * @param {object} todo 待办
 * @returns {void}
 */
export function restoreTodo(todo) {
    todo.removed = false
    persist()
}

/**
 * 彻底删除一条待办。从列表中移除后，服务端会连同其图片一并物理删除。
 * @param {object} todo 待办
 * @returns {void}
 */
export function deleteForever(todo) {
    const index = todos.value.indexOf(todo)
    if (index > -1) todos.value.splice(index, 1)
    persist()
}

/**
 * 清空回收站，永久删除其中全部待办。
 * @returns {void}
 */
export function emptyTrash() {
    todos.value = todos.value.filter((todo) => !todo.removed)
    persist()
}

/**
 * 把所有未完成的待办标记为已完成。
 * @returns {void}
 */
export function markAllCompleted() {
    activeTodos.value.forEach((todo) => { todo.completed = true })
    persist()
}

/**
 * 把已完成的待办移入回收站。
 * @returns {void}
 */
export function clearCompleted() {
    completedTodos.value.forEach((todo) => { todo.removed = true })
    persist()
}

/**
 * 把全部待办移入回收站。
 * @returns {void}
 */
export function clearAll() {
    activeTodos.value.forEach((todo) => { todo.removed = true })
    persist()
}

/**
 * 拖拽排序：把待办从一个位置挪到另一个位置。
 *
 * 视图上拖的是筛选后的子集，落库的却是全量列表，因此需要把子集内的
 * 相对位置换算成全量列表中的真实下标。
 *
 * @param {number} from 拖起位置在当前筛选列表中的下标
 * @param {number} to 目标位置在当前筛选列表中的下标
 * @returns {void}
 */
export function moveTodo(from, to) {
    const view = filteredTodos.value
    const source = view[from]
    const target = view[to]
    if (!source || !target || source === target) return

    const list = todos.value
    const sourceIndex = list.indexOf(source)
    const targetIndex = list.indexOf(target)
    if (sourceIndex < 0 || targetIndex < 0) return

    list.splice(sourceIndex, 1)
    list.splice(targetIndex, 0, source)
    persist()
}
