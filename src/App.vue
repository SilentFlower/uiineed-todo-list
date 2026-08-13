<script setup>
/**
 * 应用根组件：按登录态在登录页与主界面之间切换。
 */
import { onMounted } from 'vue'
import LoginView from './components/LoginView.vue'
import TodoApp from './components/TodoApp.vue'
import AppDialog from './components/AppDialog.vue'
import { authChecking, restoreSession, user } from './composables/useAuth.js'

onMounted(restoreSession)
</script>

<template>
    <div v-if="authChecking" class="app-loading">…</div>
    <TodoApp v-else-if="user" />
    <LoginView v-else />

    <AppDialog />
</template>
