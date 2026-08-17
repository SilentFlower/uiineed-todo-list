<script setup>
/**
 * 主界面：标语、新增框、待办列表、侧边快捷操作。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import TodoItem from './TodoItem.vue'
import UserNav from './UserNav.vue'
import ImageLightbox from './ImageLightbox.vue'
import { api, imageUrl } from '../api.js'
import { t } from '../i18n.js'
import { showAlert, showConfirm } from '../composables/useDialog.js'
import { uploadImages, uploading } from '../composables/useImageUpload.js'
import { user } from '../composables/useAuth.js'
import { imagesFromClipboard } from '../utils/image.js'
import {
    activeTodos,
    clearAll,
    clearCompleted,
    completedTodos,
    DEFAULT_PRIORITY,
    emptyTrash,
    filteredTodos,
    flushIfPending,
    intention,
    leftTodos,
    loadTodos,
    markAllCompleted,
    moveTodo,
    PRIORITY_LEVELS,
    priorityFilter,
    recycleBin,
    sortByPriority,
    todos,
    toggleSortByPriority
} from '../composables/useTodos.js'
import { addTodo } from '../composables/useTodos.js'

/* 新增框 */
const newTodoTitle = ref('')
const pendingImages = ref([])
const newTodoPriority = ref(DEFAULT_PRIORITY)
const checkEmpty = ref(false)
const composeInput = ref(null)
const fileInput = ref(null)

/* 标语 */
const sloganDraft = ref('')
const editingSlogan = ref(false)
const sloganInput = ref(null)

/* 侧边栏与拖拽 */
const sidebarOpen = ref(false)
const dragIndex = ref(-1)

/* 图片预览 */
const preview = ref(null)

const slogan = computed(() => user.value?.slogan || t('defaultSlogan'))
const emptyChecked = computed(() => !newTodoTitle.value.length && checkEmpty.value)
const showEmptyTips = computed(() => !filteredTodos.value.length && intention.value !== 'removed')
const canSubmit = computed(() => newTodoTitle.value.trim().length > 0 || pendingImages.value.length > 0)

/**
 * 让新增框随内容自动增高，避免长文本只能在一行里滚动。
 * @returns {void}
 */
function autoGrow() {
    const el = composeInput.value
    if (!el) return

    el.style.height = 'auto'
    // 全站是 border-box，height 含边框，而 scrollHeight 不含。
    // 直接把 scrollHeight 赋给 height 会矮上下边框那 4px，末行底部就被 overflow 切掉了
    const border = el.offsetHeight - el.clientHeight
    el.style.height = `${Math.min(el.scrollHeight + border, 240)}px`
}

/**
 * 提交新待办。文字与图片至少要有一项。
 * @returns {void}
 */
function submitTodo() {
    if (!canSubmit.value) {
        checkEmpty.value = true
        return
    }

    addTodo(newTodoTitle.value.trim(), pendingImages.value, newTodoPriority.value)
    newTodoTitle.value = ''
    pendingImages.value = []
    // 优先级不重置：连续录入同一批任务时通常档位相同，保留上次选择更省事
    checkEmpty.value = false
    nextTick(autoGrow)
}

/**
 * 在新增框里粘贴图片（Ctrl+V），直接进入待提交的图片列表。
 * @param {ClipboardEvent} event 粘贴事件
 * @returns {Promise<void>}
 */
async function onComposePaste(event) {
    const files = imagesFromClipboard(event)
    if (!files.length) return

    event.preventDefault()
    pendingImages.value.push(...(await uploadImages(files)))
}

/**
 * 通过文件选择框添加图片。
 * @param {Event} event change 事件
 * @returns {Promise<void>}
 */
async function onPickFiles(event) {
    pendingImages.value.push(...(await uploadImages(event.target.files)))
    event.target.value = ''
}

/**
 * 移除一张待提交的图片。
 * @param {number} index 图片下标
 * @returns {void}
 */
function removePendingImage(index) {
    pendingImages.value.splice(index, 1)
}

/* ------------------------------------------------------------------ 标语 */

/**
 * 双击标语进入编辑。
 * @returns {void}
 */
function startEditSlogan() {
    sloganDraft.value = slogan.value
    editingSlogan.value = true
    nextTick(() => sloganInput.value?.focus())
}

/**
 * 保存标语到当前账号。
 * @returns {Promise<void>}
 */
async function saveSlogan() {
    editingSlogan.value = false
    const { user: updated } = await api.saveSettings({ slogan: sloganDraft.value })
    user.value = updated
}

/* ------------------------------------------------------------ 批量与数据 */

/**
 * 一键完成全部待办。
 * @returns {Promise<void>}
 */
async function handleMarkAll() {
    if (!(await showConfirm(t('confirmMarkAll')))) return
    markAllCompleted()
}

/**
 * 把已完成的待办移入回收站。
 * @returns {Promise<void>}
 */
async function handleClearCompleted() {
    if (!(await showConfirm(t('confirmClearCompleted')))) return
    clearCompleted()
}

/**
 * 把全部待办移入回收站。
 * @returns {Promise<void>}
 */
async function handleClearAll() {
    if (!(await showConfirm(t('confirmClearAll')))) return
    clearAll()
}

/**
 * 清空回收站，永久删除其中内容。
 * @returns {Promise<void>}
 */
async function handleEmptyTrash() {
    if (!(await showConfirm(t('confirmEmptyTrash')))) return
    emptyTrash()
}

/**
 * 导出全部数据。图片由服务端内嵌成 base64，导出文件可脱离服务单独保存。
 * @returns {Promise<void>}
 */
async function handleExport() {
    const payload = await api.exportData()
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = `todos-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

/**
 * 导入数据文件，内容追加到当前列表前面。
 * @param {Event} event change 事件
 * @returns {Promise<void>}
 */
async function handleImport(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return showAlert(t('noFileSelected'), t('errorTitle'))

    try {
        const payload = JSON.parse(await file.text())
        const { todos: saved, imported } = await api.importData(payload)
        todos.value = saved
        showAlert(t('importSuccess', imported))
    } catch {
        showAlert(t('importFailed'), t('errorTitle'))
    }
}

/* -------------------------------------------------------------------- 拖拽 */

/**
 * 记录拖拽起点。
 * @param {number} index 起点下标
 * @returns {void}
 */
function onDragStart(index) {
    dragIndex.value = index
}

/**
 * 拖动经过某项时实时换位。
 * @param {number} index 目标下标
 * @returns {void}
 */
function onDragEnter(index) {
    if (dragIndex.value < 0 || dragIndex.value === index) return
    moveTodo(dragIndex.value, index)
    dragIndex.value = index
}

/* -------------------------------------------------------------------- 生命周期 */

/**
 * 打开图片大图预览。
 * @param {object[]} images 该待办的全部图片
 * @param {number} index 起始下标
 * @returns {void}
 */
function openPreview(images, index) {
    preview.value = { images, index }
}

onMounted(async () => {
    await loadTodos()
    // 窄屏默认收起侧边快捷操作，给列表让出空间
    sidebarOpen.value = window.innerWidth >= 768
    window.addEventListener('beforeunload', flushIfPending)
})

onBeforeUnmount(() => window.removeEventListener('beforeunload', flushIfPending))
</script>

<template>
    <div class="todo-wrapper">
        <div class="todo-app">
            <!-- 顶部：标题与新增框 -->
            <div class="container header">
                <div class="todo-input">
                    <h1 class="title">
                        <img src="/img/todo.svg" alt="Todo" class="title-1" draggable="false" />
                        <div class="ani-vector"><span></span><span></span></div>
                        <div class="pendulums">
                            <div class="pendulum">
                                <div class="bar"></div>
                                <div class="motion">
                                    <div class="string"></div>
                                    <div class="weight"></div>
                                </div>
                            </div>
                        </div>
                    </h1>

                    <div class="add-content-wrapper">
                        <!-- 输入框与提交按钮绑成一组：按钮靠绝对定位贴住输入框右侧，
                             单独包一层才能让它跟着输入框长高，而不会盖到下面的工具栏 -->
                        <div class="compose-field">
                            <textarea
                                ref="composeInput"
                                v-model="newTodoTitle"
                                rows="1"
                                class="add-content"
                                :class="{ empty: emptyChecked }"
                                :placeholder="t('addPlaceholder')"
                                @input="autoGrow"
                                @paste="onComposePaste"
                                @keydown.enter.exact.prevent="submitTodo"></textarea>

                            <button type="button" class="btn submit-btn" @click="submitTodo">{{ t('submit') }}</button>
                        </div>

                        <transition name="tips">
                            <div v-if="emptyChecked" class="tips" style="color:red">{{ t('emptyTip') }}</div>
                        </transition>

                        <div class="compose-tools">
                            <div class="priority-picker">
                                <button
                                    v-for="level in PRIORITY_LEVELS"
                                    :key="level"
                                    type="button"
                                    class="priority-chip"
                                    :class="[`priority-p${level}`, { active: newTodoPriority === level }]"
                                    :title="t('priorityNames')[level]"
                                    @click="newTodoPriority = level">P{{ level }}</button>
                            </div>
                            <button type="button" class="btn-add-image" :disabled="uploading" @click="fileInput.click()">
                                🖼 {{ t('addImage') }}
                            </button>
                            <span class="compose-hint">Ctrl / ⌘ + V</span>
                            <input
                                ref="fileInput"
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/gif"
                                multiple
                                hidden
                                @change="onPickFiles" />
                        </div>

                        <div v-if="pendingImages.length" class="compose-images">
                            <div v-for="(image, index) in pendingImages" :key="image.id" class="todo-image">
                                <img :src="imageUrl(image.id)" alt="" draggable="false" />
                                <button
                                    type="button"
                                    class="todo-image-remove"
                                    :title="t('removeImage')"
                                    @click="removePendingImage(index)">✕</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 主体：列表与侧边栏 -->
            <div class="container main">
                <div class="todo-list-box">
                    <div class="bar-message">
                        <input
                            v-if="activeTodos.length || recycleBin.length"
                            type="button"
                            class="btn btn-label btn-allFinish"
                            :value="t('markAllDone')"
                            @click="handleMarkAll" />
                        <div>
                            <div v-if="!editingSlogan" class="bar-message-text" @dblclick="startEditSlogan">
                                {{ slogan }}
                            </div>
                            <div v-else>
                                <input
                                    ref="sloganInput"
                                    v-model="sloganDraft"
                                    class="slogan-input"
                                    @keyup.enter="saveSlogan"
                                    @keyup.esc="editingSlogan = false" />
                                <div class="todo-btn btn-edit-submit slogan-btn" @click="saveSlogan">
                                    <img src="/img/check.svg" :alt="t('submit')" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <ul v-if="showEmptyTips" class="empty-tips">
                        <li>{{ t('emptyTitle') }}</li>
                        <li>{{ t('usageTitle') }}</li>
                        <li v-for="tip in t('usage')" :key="tip">{{ tip }}</li>
                    </ul>

                    <transition-group name="drag" class="todo-list" tag="ul">
                        <TodoItem
                            v-for="(todo, index) in filteredTodos"
                            :key="todo.id"
                            :todo="todo"
                            :index="index"
                            @preview="openPreview"
                            @dragstart="onDragStart"
                            @dragenter="onDragEnter" />
                    </transition-group>

                    <div class="bar-message bar-bottom">
                        <div class="bar-message-text">
                            <span v-if="leftTodos.length">{{ t('remaining', leftTodos.length) }}</span>
                            <span v-else-if="completedTodos.length">{{ t('allDone') }}</span>
                        </div>
                    </div>
                </div>

                <!-- 侧边快捷操作 -->
                <div class="footer side-bar">
                    <!-- .fold 表示收起：CSS 里靠它隐藏后面的 .todo-footer-box -->
                    <div class="side-shortcut" :class="{ fold: !sidebarOpen }" @click="sidebarOpen = !sidebarOpen">
                        <div class="shortcut-switch">
                            <span class="shortcut-title">{{ sidebarOpen ? t('open') : t('close') }}</span>
                            <span class="shortcut-name">{{ t('quickActions') }}</span>
                        </div>
                    </div>

                    <div class="todo-footer-box">
                        <ul class="todo-func-list filter">
                            <li>
                                <input
                                    type="button"
                                    class="btn-small action-showAll"
                                    :class="{ selected: intention === 'all' }"
                                    :value="t('filterAll')"
                                    @click="intention = 'all'" />
                            </li>
                            <li v-if="completedTodos.length && leftTodos.length">
                                <input
                                    type="button"
                                    class="btn-small action-progress"
                                    :class="{ selected: intention === 'ongoing' }"
                                    :value="t('filterOngoing')"
                                    @click="intention = 'ongoing'" />
                            </li>
                            <li v-if="completedTodos.length">
                                <input
                                    type="button"
                                    class="btn-small action-completed"
                                    :class="{ selected: intention === 'completed' }"
                                    :value="t('filterCompleted')"
                                    @click="intention = 'completed'" />
                            </li>
                            <li v-if="recycleBin.length">
                                <input
                                    type="button"
                                    class="btn-small action-deleted"
                                    :class="{ selected: intention === 'removed' }"
                                    :value="t('filterTrash')"
                                    @click="intention = 'removed'" />
                            </li>
                        </ul>

                        <ul class="todo-func-list priority-filter">
                            <li v-for="level in PRIORITY_LEVELS" :key="level">
                                <!-- 再点一次已选中的档位即可取消筛选，不必额外放个「全部」按钮 -->
                                <input
                                    type="button"
                                    class="btn-small priority-filter-btn"
                                    :class="[`priority-p${level}`, { selected: priorityFilter === level }]"
                                    :value="`P${level}`"
                                    :title="t('priorityNames')[level]"
                                    @click="priorityFilter = priorityFilter === level ? null : level" />
                            </li>
                        </ul>

                        <ul class="todo-func-list sort-switch">
                            <li>
                                <input
                                    type="button"
                                    class="btn-small action-sort"
                                    :class="{ selected: sortByPriority }"
                                    :value="`⇅ ${t('sortByPriority')}`"
                                    :title="sortByPriority ? t('sortOnDragOff') : ''"
                                    @click="toggleSortByPriority" />
                            </li>
                        </ul>

                        <ul class="todo-func-list batch">
                            <li v-if="leftTodos.length">
                                <input
                                    type="button"
                                    class="btn-small completed-all"
                                    :value="t('batchCompleteAll')"
                                    @click="handleMarkAll" />
                            </li>
                            <li v-if="completedTodos.length">
                                <input
                                    type="button"
                                    class="btn-small completed-clear"
                                    :value="t('batchClearCompleted')"
                                    @click="handleClearCompleted" />
                            </li>
                            <li v-if="activeTodos.length">
                                <input
                                    type="button"
                                    class="btn-small clear-all"
                                    :value="t('batchClearAll')"
                                    @click="handleClearAll" />
                            </li>
                            <li v-if="recycleBin.length">
                                <input
                                    type="button"
                                    class="btn-small clear-all"
                                    :value="t('emptyTrash')"
                                    @click="handleEmptyTrash" />
                            </li>
                        </ul>

                        <ul class="todo-func-list datasave">
                            <li v-if="todos.length">
                                <input
                                    type="button"
                                    class="btn-small action-download"
                                    :value="t('exportData')"
                                    @click="handleExport" />
                            </li>
                            <li>
                                <label class="btn-small action-import" style="display:block">
                                    {{ t('importData') }}
                                    <input type="file" accept=".json,application/json" hidden @change="handleImport" />
                                </label>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <UserNav />
        </div>
    </div>

    <ImageLightbox
        v-if="preview"
        :images="preview.images"
        :index="preview.index"
        @update:index="preview.index = $event"
        @close="preview = null" />
</template>
