<script setup>
/**
 * 图片大图预览。点击遮罩、按 Esc 或点关闭按钮均可退出。
 */
import { onBeforeUnmount, onMounted } from 'vue'
import { imageUrl } from '../api.js'

const props = defineProps({
    images: { type: Array, required: true },
    index: { type: Number, default: 0 }
})
const emit = defineEmits(['close', 'update:index'])

/**
 * 在图片间切换。
 * @param {number} step 位移量，-1 上一张、1 下一张
 * @returns {void}
 */
function step(step) {
    const next = (props.index + step + props.images.length) % props.images.length
    emit('update:index', next)
}

/**
 * 键盘控制：Esc 关闭，左右方向键切换。
 * @param {KeyboardEvent} event 键盘事件
 * @returns {void}
 */
function onKeydown(event) {
    if (event.key === 'Escape') emit('close')
    if (event.key === 'ArrowLeft') step(-1)
    if (event.key === 'ArrowRight') step(1)
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
    <div class="lightbox" @click.self="emit('close')">
        <button type="button" class="lightbox-close" @click="emit('close')">✕</button>

        <button v-if="images.length > 1" type="button" class="lightbox-nav prev" @click.stop="step(-1)">‹</button>
        <img class="lightbox-image" :src="imageUrl(images[index].id)" alt="" />
        <button v-if="images.length > 1" type="button" class="lightbox-nav next" @click.stop="step(1)">›</button>

        <div v-if="images.length > 1" class="lightbox-counter">{{ index + 1 }} / {{ images.length }}</div>
    </div>
</template>
