import { computed, ref } from 'vue'

/** 当前界面语言，'zh' 或 'en' */
export const locale = ref(localStorage.getItem('uiineed-todos-lang') === 'en' ? 'en' : 'zh')

const messages = {
    zh: {
        appTitle: 'Todo List',
        // 登录
        loginTitle: '登录',
        loginSubtitle: '账号不存在会自动为你创建',
        username: '用户名',
        password: '密码',
        usernamePlaceholder: '请输入用户名',
        passwordPlaceholder: '请输入密码（至少 6 位）',
        loginSubmit: '登录 / 注册',
        loggingIn: '登录中…',
        welcomeNew: (name) => `账号「${name}」已创建，开始你的第一条待办吧！`,
        logout: '退出登录',
        errInvalidUsername: '用户名长度需为 2 - 32 位',
        errPasswordShort: '密码至少 6 位',
        errBadCredentials: '密码不正确',
        errNetwork: '网络异常，请稍后重试',
        // 主界面
        addPlaceholder: '新增待办事项…',
        submit: '提交',
        emptyTip: '💡请输入内容！',
        markAllDone: '全部标为完成',
        defaultSlogan: '今日事今日毕，勿将今事待明日!.☕',
        remaining: (n) => `剩余 ${n} 项未完成`,
        allDone: '完美收工！',
        // 空状态
        emptyTitle: '添加你的第一个待办事项！📝',
        usageTitle: '食用方法💡：',
        usage: [
            '✔️ 所有提交操作支持 Enter 回车键提交',
            '✔️ 拖拽 Todo 上下移动可排序(仅支持PC)',
            '✔️ 双击上面的标语和 Todo 可进行编辑',
            '✔️ 右侧的小窗口是快捷操作哦',
            '🖼 支持 Ctrl+V 直接粘贴图片到待办',
            '🔒 数据按账号保存在你自己的服务器',
            '📝 支持导出和导入，导入追加到当前序列'
        ],
        // 侧边栏
        quickActions: '快捷操作',
        open: '开✨',
        close: '关',
        filterAll: '全部',
        filterOngoing: '进行中',
        filterCompleted: '已完成',
        filterTrash: '回收站',
        batchCompleteAll: '全部标为已完成',
        batchClearCompleted: '清除已完成',
        batchClearAll: '清除全部',
        emptyTrash: '清空回收站',
        exportData: '导出数据',
        importData: '导入(json)',
        // 待办操作
        expand: '展开全部',
        collapse: '收起',
        restore: '还原',
        moveToTrash: '移到回收站',
        deleteForever: '彻底删除',
        addImage: '添加图片',
        removeImage: '移除图片',
        imageTooLarge: '图片过大，请选择 10MB 以内的图片',
        imageFailed: '图片上传失败，请重试',
        // 对话框
        dialogTitle: '提示',
        confirmTitle: '请确认',
        errorTitle: '错误',
        ok: '确定',
        cancel: '取消',
        confirmMarkAll: '确认一键勾选完成全部待办事项？',
        confirmClearCompleted: '确认清除全部已完成的待办事项？',
        confirmClearAll: '确认清除全部待办事项？',
        confirmDeleteForever: '确认彻底删除这条待办？该操作不可恢复，关联图片也会一并删除。',
        confirmEmptyTrash: '确认清空回收站？回收站内的待办与图片将被永久删除。',
        confirmLogout: '确认退出登录？',
        importSuccess: (n) => `导入成功，已追加 ${n} 条待办！`,
        importFailed: '文件解析失败，请确认是本应用导出的 JSON 文件',
        noFileSelected: '没有选择文件！',
        saveFailed: '保存失败，请检查网络后重试'
    },
    en: {
        appTitle: 'Todo List',
        loginTitle: 'Sign in',
        loginSubtitle: "We'll create the account if it doesn't exist yet",
        username: 'Username',
        password: 'Password',
        usernamePlaceholder: 'Enter your username',
        passwordPlaceholder: 'Enter your password (6+ characters)',
        loginSubmit: 'Sign in / Sign up',
        loggingIn: 'Signing in…',
        welcomeNew: (name) => `Account "${name}" created. Add your first to-do!`,
        logout: 'Sign out',
        errInvalidUsername: 'Username must be 2 - 32 characters',
        errPasswordShort: 'Password must be at least 6 characters',
        errBadCredentials: 'Incorrect password',
        errNetwork: 'Network error, please try again',
        addPlaceholder: 'Add a to-do item…',
        submit: 'Submit',
        emptyTip: '💡Please enter something!',
        markAllDone: 'Finish all',
        defaultSlogan: 'Act Now, Simplify Life.☕',
        remaining: (n) => `${n} items remaining`,
        allDone: 'All done!',
        emptyTitle: 'Add Your First To-Do Item! 📝',
        usageTitle: 'Usage Tips 💡:',
        usage: [
            '✔️ Press Enter to submit actions.',
            '✔️ Drag to reorder your to-dos (PC only)',
            '✔️ Double-click to edit slogan and tasks.',
            '✔️ Access quick actions in the right sidebar.',
            '🖼 Paste images straight into a to-do with Ctrl+V',
            '🔒 Your data lives on your own server, per account.',
            '📝 Supports export and import (appends to list).'
        ],
        quickActions: 'Quick actions',
        open: 'OPEN✨',
        close: '＝',
        filterAll: 'All',
        filterOngoing: 'In Progress',
        filterCompleted: 'Completed',
        filterTrash: 'Trash',
        batchCompleteAll: 'Mark All Done',
        batchClearCompleted: 'Clear Completed',
        batchClearAll: 'Clear All',
        emptyTrash: 'Empty Trash',
        exportData: 'Export data',
        importData: 'Import(json)',
        expand: 'Show more',
        collapse: 'Show less',
        restore: 'Restore',
        moveToTrash: 'Move to trash',
        deleteForever: 'Delete forever',
        addImage: 'Add image',
        removeImage: 'Remove image',
        imageTooLarge: 'Image is too large, please keep it under 10MB',
        imageFailed: 'Image upload failed, please retry',
        dialogTitle: 'Notice',
        confirmTitle: 'Please confirm',
        errorTitle: 'Error',
        ok: 'OK',
        cancel: 'Cancel',
        confirmMarkAll: 'Confirm to mark all as completed?',
        confirmClearCompleted: 'Confirm to clear all completed items?',
        confirmClearAll: 'Confirm to clear all todo items?',
        confirmDeleteForever: 'Delete this to-do forever? This cannot be undone, and its images will be removed too.',
        confirmEmptyTrash: 'Empty the trash? Everything inside will be permanently deleted.',
        confirmLogout: 'Sign out of this account?',
        importSuccess: (n) => `Imported successfully, ${n} items appended!`,
        importFailed: 'Failed to parse the file. Please use a JSON file exported from this app.',
        noFileSelected: 'No file selected!',
        saveFailed: 'Save failed, please check your connection and retry'
    }
}

/**
 * 取当前语言下的文案。
 * @param {string} key 文案 key
 * @param {...any} args 文案为函数时传入的参数
 * @returns {any} 文案内容
 */
export function t(key, ...args) {
    const value = messages[locale.value][key]
    return typeof value === 'function' ? value(...args) : value
}

/** 便于在模板中直接使用的响应式翻译函数 */
export const useI18n = () => ({ t, locale, isZh: computed(() => locale.value === 'zh') })

/**
 * 切换界面语言并记住选择。
 * @param {'zh'|'en'} lang 目标语言
 * @returns {void}
 */
export function setLocale(lang) {
    locale.value = lang
    localStorage.setItem('uiineed-todos-lang', lang)
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
}
