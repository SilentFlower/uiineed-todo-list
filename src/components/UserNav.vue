<script setup>
/**
 * 右上角用户区：显示当前登录用户名，提供退出登录与中英文切换。
 * 原先此处是作者信息弹窗，已整体替换。
 */
import { ref } from 'vue'
import { logout, user } from '../composables/useAuth.js'
import { showConfirm } from '../composables/useDialog.js'
import { api } from '../api.js'
import { locale, setLocale, t } from '../i18n.js'

const menuOpen = ref(false)

/**
 * 切换语言，并把选择同步到账号设置，换设备登录后仍然生效。
 * @param {'zh'|'en'} lang 目标语言
 * @returns {Promise<void>}
 */
async function switchLanguage(lang) {
    if (locale.value === lang) return
    setLocale(lang)
    try {
        await api.saveSettings({ lang })
    } catch {
        // 语言只是偏好项，同步失败不打断使用，本地选择已经生效
    }
}

/**
 * 退出登录，需要用户二次确认。
 * @returns {Promise<void>}
 */
async function handleLogout() {
    menuOpen.value = false
    if (!(await showConfirm(t('confirmLogout')))) return
    await logout()
}
</script>

<template>
    <div class="nav" draggable="false">
        <div class="user-menu">
            <button type="button" class="user-chip" :class="{ open: menuOpen }" @click="menuOpen = !menuOpen">
                <span class="user-avatar">{{ user?.username?.[0]?.toUpperCase() }}</span>
                <span class="user-name">{{ user?.username }}</span>
            </button>

            <div v-if="menuOpen" class="user-popup animated popIn">
                <div class="user-popup-name">{{ user?.username }}</div>
                <button type="button" class="btn-small user-logout" @click="handleLogout">
                    {{ t('logout') }}
                </button>
            </div>
        </div>

        <div class="language switch-language">
            <a href="javascript:;" class="en" :class="{ active: locale === 'en' }" @click="switchLanguage('en')">En</a>
            <span>/</span>
            <a href="javascript:;" class="zh" :class="{ active: locale === 'zh' }" @click="switchLanguage('zh')">中</a>
        </div>
    </div>

    <!-- 点击空白处收起菜单 -->
    <div v-if="menuOpen" class="user-menu-mask" @click="menuOpen = false"></div>
</template>
