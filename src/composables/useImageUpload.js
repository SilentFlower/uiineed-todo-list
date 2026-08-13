import { ref } from 'vue'
import { api } from '../api.js'
import { t } from '../i18n.js'
import { showAlert } from './useDialog.js'
import { prepareImage } from '../utils/image.js'

/** 是否有图片正在上传，用于禁用提交按钮 */
export const uploading = ref(false)

/**
 * 压缩并上传一组图片文件。
 * 单张失败不影响其余图片，最后统一提示。
 *
 * @param {File[]|FileList} files 待上传的图片文件
 * @returns {Promise<object[]>} 上传成功的图片记录列表
 */
export async function uploadImages(files) {
    const list = Array.from(files || [])
    if (!list.length) return []

    uploading.value = true
    const uploaded = []
    let tooLarge = false
    let failed = false

    try {
        for (const file of list) {
            try {
                const { dataUrl, width, height } = await prepareImage(file)
                const { image } = await api.uploadImage(dataUrl, width, height)
                uploaded.push({ id: image.id, width: image.width, height: image.height })
            } catch (error) {
                if (error.message === 'IMAGE_TOO_LARGE') tooLarge = true
                else failed = true
            }
        }
    } finally {
        uploading.value = false
    }

    if (tooLarge) showAlert(t('imageTooLarge'), t('errorTitle'))
    else if (failed) showAlert(t('imageFailed'), t('errorTitle'))

    return uploaded
}
