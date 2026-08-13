import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * Vite 构建配置。
 * 开发态下前端跑在 5173，通过代理把 /api 打到本地 3000 的 Express 服务；
 * 生产态构建产物输出到 dist，由同一个 Express 服务静态托管。
 */
export default defineConfig({
    plugins: [vue()],
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:3000',
                changeOrigin: true
            }
        }
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true
    }
})
