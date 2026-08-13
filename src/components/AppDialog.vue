<script setup>
/**
 * 全局提示 / 确认对话框。
 * 替代原先直接改写 window.alert / window.confirm 的做法。
 */
import { nextTick, ref, watch } from 'vue'
import { closeDialog, dialogState } from '../composables/useDialog.js'
import { t } from '../i18n.js'

const confirmButton = ref(null)

// 打开后把焦点交给默认按钮，回车可直接确认，Esc 可取消
watch(
    () => dialogState.visible,
    async (visible) => {
        if (!visible) return
        await nextTick()
        confirmButton.value?.focus()
    }
)

/**
 * 处理键盘事件：Esc 关闭对话框。
 * @param {KeyboardEvent} event 键盘事件
 * @returns {void}
 */
function onKeydown(event) {
    if (event.key === 'Escape') closeDialog(false)
}
</script>

<template>
    <div v-if="dialogState.visible" class="custom-alert-overlay" tabindex="-1" @keydown="onKeydown">
        <div class="custom-alert">
            <div class="custom-alert-title">{{ dialogState.title }}</div>
            <div class="custom-alert-content">{{ dialogState.message }}</div>
            <div class="custom-alert-buttons">
                <button
                    v-if="dialogState.mode === 'confirm'"
                    type="button"
                    class="custom-alert-btn cancel"
                    @click="closeDialog(false)">
                    {{ t('cancel') }}
                </button>
                <button ref="confirmButton" type="button" class="custom-alert-btn confirm" @click="closeDialog(true)">
                    {{ t('ok') }}
                </button>
            </div>
        </div>
    </div>
</template>
