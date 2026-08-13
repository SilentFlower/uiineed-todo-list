<script setup>
/**
 * 单条待办。
 * 负责内容折叠展开、图片缩略图、编辑，以及完成 / 回收站 / 彻底删除等操作。
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { imageUrl } from '../api.js'
import { t } from '../i18n.js'
import { showConfirm } from '../composables/useDialog.js'
import { uploadImages } from '../composables/useImageUpload.js'
import {
    deleteForever,
    moveToTrash,
    persist,
    restoreTodo,
    setCompleted
} from '../composables/useTodos.js'
import { imagesFromClipboard } from '../utils/image.js'

const props = defineProps({
    todo: { type: Object, required: true },
    index: { type: Number, required: true }
})
const emit = defineEmits(['preview', 'dragstart', 'dragenter'])

/** 收起状态下最多展示的图片数量 */
const COLLAPSED_IMAGE_LIMIT = 3

const contentEl = ref(null)
const editInput = ref(null)
const expanded = ref(false)
const overflowing = ref(false)
const editing = ref(false)
const draftTitle = ref('')

/** 内容是否需要「展开全部」：文字超出行数限制，或图片多于收起上限 */
const hasMore = computed(() => overflowing.value || props.todo.images.length > COLLAPSED_IMAGE_LIMIT)

/** 当前应展示的图片列表，收起时只露出前几张 */
const visibleImages = computed(() =>
    expanded.value ? props.todo.images : props.todo.images.slice(0, COLLAPSED_IMAGE_LIMIT)
)

/** 收起时被折叠掉的图片数量，用于在最后一张上盖「+N」 */
const hiddenImageCount = computed(() =>
    expanded.value ? 0 : Math.max(0, props.todo.images.length - COLLAPSED_IMAGE_LIMIT)
)

/**
 * 测量文本是否超出收起高度。
 *
 * 收起态下 .clamped 会一直挂着（内容不长时它本就没有视觉影响），
 * 这样 scrollHeight 与 clientHeight 才有差值可比；否则两者永远相等，
 * 永远测不出溢出。展开态跳过测量，沿用上一次的结论。
 *
 * @returns {void}
 */
function measure() {
    if (expanded.value || !contentEl.value) return
    overflowing.value = contentEl.value.scrollHeight - contentEl.value.clientHeight > 2
}

onMounted(() => nextTick(measure))
watch(() => props.todo.title, () => nextTick(measure))

/**
 * 进入编辑态，把当前内容拷进草稿。
 * @returns {void}
 */
function startEdit() {
    if (props.todo.removed) return
    draftTitle.value = props.todo.title
    editing.value = true
    nextTick(() => editInput.value?.focus())
}

/**
 * 保存编辑结果。内容被清空且没有图片时，直接移入回收站。
 * @returns {void}
 */
function commitEdit() {
    const title = draftTitle.value.trim()
    if (!title && !props.todo.images.length) {
        editing.value = false
        moveToTrash(props.todo)
        return
    }

    props.todo.title = draftTitle.value
    editing.value = false
    persist()
    nextTick(measure)
}

/**
 * 放弃编辑。
 * @returns {void}
 */
function cancelEdit() {
    editing.value = false
}

/**
 * 编辑态下粘贴图片，直接追加到当前待办。
 * @param {ClipboardEvent} event 粘贴事件
 * @returns {Promise<void>}
 */
async function onPaste(event) {
    const files = imagesFromClipboard(event)
    if (!files.length) return

    event.preventDefault()
    const uploaded = await uploadImages(files)
    if (!uploaded.length) return

    props.todo.images.push(...uploaded)
    persist()
}

/**
 * 移除待办中的某张图片。
 * @param {number} imageIndex 图片下标
 * @returns {void}
 */
function removeImage(imageIndex) {
    props.todo.images.splice(imageIndex, 1)
    persist()
}

/**
 * 彻底删除，需二次确认。图片会随之从磁盘上一并清除。
 * @returns {Promise<void>}
 */
async function confirmDeleteForever() {
    if (!(await showConfirm(t('confirmDeleteForever')))) return
    deleteForever(props.todo)
}
</script>

<template>
    <li
        class="todo-item"
        :class="{ 'is-expanded': expanded, 'in-trash': todo.removed }"
        :draggable="!editing"
        @dragstart="emit('dragstart', index)"
        @dragenter.prevent="emit('dragenter', index)"
        @dragover.prevent>
        <!-- 展示态 -->
        <template v-if="!editing">
            <div class="todo-body" :class="{ completed: todo.completed }">
                <div
                    ref="contentEl"
                    class="todo-content"
                    :class="{ clamped: !expanded }"
                    @dblclick="startEdit">
                    {{ todo.title }}
                </div>

                <div v-if="todo.images.length" class="todo-images">
                    <div
                        v-for="(image, imageIndex) in visibleImages"
                        :key="image.id"
                        class="todo-image"
                        @click="emit('preview', todo.images, imageIndex)">
                        <img :src="imageUrl(image.id)" alt="" draggable="false" loading="lazy" />
                        <span
                            v-if="hiddenImageCount && imageIndex === visibleImages.length - 1"
                            class="todo-image-more">
                            +{{ hiddenImageCount }}
                        </span>
                    </div>
                </div>

                <button v-if="hasMore" type="button" class="todo-toggle" @click="expanded = !expanded">
                    {{ expanded ? t('collapse') : t('expand') }}
                </button>
            </div>
        </template>

        <!-- 编辑态 -->
        <div v-else class="edit-todo-wrapper">
            <textarea
                ref="editInput"
                v-model="draftTitle"
                class="edit-todo"
                rows="1"
                @paste="onPaste"
                @keydown.enter.exact.prevent="commitEdit"
                @keydown.esc="cancelEdit"
                @dragstart.stop.prevent
                @mousedown.stop></textarea>

            <div v-if="todo.images.length" class="todo-images editing">
                <div v-for="(image, imageIndex) in todo.images" :key="image.id" class="todo-image">
                    <img :src="imageUrl(image.id)" alt="" draggable="false" />
                    <button
                        type="button"
                        class="todo-image-remove"
                        :title="t('removeImage')"
                        @click.stop="removeImage(imageIndex)">✕</button>
                </div>
            </div>

            <div class="todo-btn btn-edit-submit" @click="commitEdit">
                <img class="ic-check" src="/img/check.svg" :alt="t('submit')" draggable="false" />
            </div>
        </div>

        <!-- 操作区 -->
        <template v-if="!editing">
            <!-- 回收站中：还原 + 彻底删除 -->
            <template v-if="todo.removed">
                <div class="todo-btn btn-restore" :title="t('restore')" @click="restoreTodo(todo)">
                    <img src="/img/restore.svg" :alt="t('restore')" draggable="false" />
                </div>
                <div
                    class="todo-btn btn-delete-forever"
                    :title="t('deleteForever')"
                    @click="confirmDeleteForever">
                    <img src="/img/trash.svg" :alt="t('deleteForever')" draggable="false" />
                </div>
            </template>

            <!-- 正常状态：完成 / 取消完成 + 移入回收站 -->
            <template v-else>
                <div v-if="!todo.completed" class="todo-btn btn-finish" @click="setCompleted(todo, true)"></div>
                <div v-else class="todo-btn btn-unfinish" @click="setCompleted(todo, false)">
                    <img class="icon-finish" src="/img/undo.svg" alt="" draggable="false" />
                </div>
                <div class="todo-btn btn-delete" :title="t('moveToTrash')" @click="moveToTrash(todo)">
                    <img src="/img/close.svg" :alt="t('moveToTrash')" draggable="false" />
                </div>
            </template>
        </template>
    </li>
</template>
