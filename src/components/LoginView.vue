<script setup>
/**
 * 登录 / 注册页。
 * 只有一个表单：账号存在则校验密码，不存在则直接创建。
 */
import { ref } from 'vue'
import { login } from '../composables/useAuth.js'
import { locale, setLocale, t } from '../i18n.js'

const username = ref('')
const password = ref('')
const errorMessage = ref('')
const submitting = ref(false)

/** 后端错误码到用户可读文案的映射 */
const ERROR_TEXT = {
    INVALID_USERNAME: 'errInvalidUsername',
    PASSWORD_TOO_SHORT: 'errPasswordShort',
    BAD_CREDENTIALS: 'errBadCredentials'
}

/**
 * 提交登录表单。成功后本组件会被卸载，无需再做后续处理。
 * @returns {Promise<void>}
 */
async function submit() {
    if (submitting.value) return

    errorMessage.value = ''
    submitting.value = true
    try {
        await login(username.value.trim(), password.value)
    } catch (error) {
        errorMessage.value = t(ERROR_TEXT[error.code] || 'errNetwork')
        submitting.value = false
    }
}
</script>

<template>
    <div class="login-wrapper">
        <div class="login-card animated popIn">
            <h1 class="login-title">{{ t('loginTitle') }}</h1>
            <p class="login-subtitle">{{ t('loginSubtitle') }}</p>

            <form class="login-form" @submit.prevent="submit">
                <label class="login-field">
                    <span class="login-label">{{ t('username') }}</span>
                    <input
                        v-model="username"
                        type="text"
                        class="login-input"
                        autocomplete="username"
                        autofocus
                        :placeholder="t('usernamePlaceholder')" />
                </label>

                <label class="login-field">
                    <span class="login-label">{{ t('password') }}</span>
                    <input
                        v-model="password"
                        type="password"
                        class="login-input"
                        autocomplete="current-password"
                        :placeholder="t('passwordPlaceholder')" />
                </label>

                <div v-if="errorMessage" class="login-error">{{ errorMessage }}</div>

                <button type="submit" class="btn login-submit" :disabled="submitting">
                    {{ submitting ? t('loggingIn') : t('loginSubmit') }}
                </button>
            </form>

            <div class="language switch-language login-language">
                <a
                    href="javascript:;"
                    class="en"
                    :class="{ active: locale === 'en' }"
                    @click="setLocale('en')">En</a>
                <span>/</span>
                <a
                    href="javascript:;"
                    class="zh"
                    :class="{ active: locale === 'zh' }"
                    @click="setLocale('zh')">中</a>
            </div>
        </div>
    </div>
</template>
