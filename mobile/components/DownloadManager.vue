<template>
  <div class="download-manager">
    <QualityModal
      :show="showQualityModal"
      :song="song"
      :qualities="displayQualities"
      :cover="getSongCover()"
      :title="modalTitle"
      :description="modalDescription"
      :show-header="showHeader"
      :show-cover="showCover"
      :show-close-button="showCloseButton"
      :size="modalSize"
      :disabled-items="disabledQualities"
      :selected-item="selectedQuality"
      :song-name-field="songNameField"
      :artist-name-field="artistNameField"
      :extra-info="extraInfo"
      :guest-mode="!MoeAuth.isAuthenticated"
      @close="handleQualityClose"
      @select="handleQualitySelect"
    >
      <template #before-list>
        <slot name="modal-before-list"></slot>
      </template>
      <template #after-list>
        <slot name="modal-after-list"></slot>
      </template>
      <template #item-left="{ item, index }">
        <slot name="modal-item-left" :item="item" :index="index">
          <div class="quality-name">{{ getItemName(item) }}</div>
          <div class="quality-desc">{{ getItemDescription(item) }}</div>
        </slot>
      </template>
      <template #item-right="{ item, index }">
        <slot name="modal-item-right" :item="item" :index="index">
          <div v-if="showItemSize && item.size" class="quality-size">{{ item.size }}</div>
          <i v-if="showItemIcon && !isItemDisabled(item)" :class="itemIcon"></i>
          <span 
            v-if="!MoeAuth.isAuthenticated && (item.quality === '320' || item.quality === 'flac')" 
            class="login-hint"
            @click.stop="goToLogin"
          >请先登录</span>
        </slot>
      </template>
    </QualityModal>

    <slot name="trigger" :start-download="startDownloadProcess">
      <button 
        v-if="showTriggerButton" 
        class="download-trigger-btn"
        :disabled="isProcessing"
        @click="startDownloadProcess"
      >
        <i v-if="isProcessing" class="fas fa-spinner fa-spin"></i>
        <i v-else :class="triggerIcon"></i>
        <span>{{ triggerText }}</span>
      </button>
    </slot>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { get } from '../utils/request'
import { MoeAuthStore } from '../stores/store'
import QualityModal from './QualityModal.vue'
import { downloadWithMetadata } from '../utils/metadata'
import message from '../utils/message'

const router = useRouter()
const MoeAuth = MoeAuthStore()

const props = defineProps({
  song: {
    type: Object,
    required: true
  },
  autoStart: {
    type: Boolean,
    default: false
  },
  showTriggerButton: {
    type: Boolean,
    default: false
  },
  triggerText: {
    type: String,
    default: '下载'
  },
  triggerIcon: {
    type: String,
    default: 'fas fa-download'
  },
  apiEndpoint: {
    type: String,
    default: '/song/url'
  },
  apiMethod: {
    type: String,
    default: 'get',
    validator: (value) => ['get', 'post'].includes(value.toLowerCase())
  },
  customApiRequest: {
    type: Function,
    default: null
  },
  qualities: {
    type: Array,
    default: () => []
  },
  defaultQualities: {
    type: Array,
    default: () => [
      { name: '标准音质', quality: '128' },
      { name: '高品质', quality: '320' },
      { name: '无损音质', quality: 'flac' }
    ]
  },
  disabledQualities: {
    type: Array,
    default: () => []
  },
  selectedQuality: {
    type: [Object, String, Number],
    default: null
  },
  modalTitle: {
    type: String,
    default: '选择下载音质'
  },
  modalDescription: {
    type: String,
    default: ''
  },
  modalSize: {
    type: String,
    default: 'medium',
    validator: (value) => ['small', 'medium', 'large'].includes(value)
  },
  showHeader: {
    type: Boolean,
    default: true
  },
  showCover: {
    type: Boolean,
    default: true
  },
  showCloseButton: {
    type: Boolean,
    default: true
  },
  showItemIcon: {
    type: Boolean,
    default: true
  },
  showItemSize: {
    type: Boolean,
    default: false
  },
  itemIcon: {
    type: String,
    default: 'fas fa-download'
  },
  autoDownload: {
    type: Boolean,
    default: true
  },
  customFileName: {
    type: Function,
    default: null
  },
  customUrlHandler: {
    type: Function,
    default: null
  },
  customDownloadTrigger: {
    type: Function,
    default: null
  },
  useAuth: {
    type: Boolean,
    default: true
  },
  authStore: {
    type: Object,
    default: null
  },
  songNameField: {
    type: [String, Array],
    default: () => ['name', 'ori_audio_name', 'songname', 'audio_name']
  },
  artistNameField: {
    type: [String, Array],
    default: () => ['author', 'author_name', 'singer_name', 'singername']
  },
  extraInfo: {
    type: String,
    default: ''
  },
  coverFields: {
    type: Array,
    default: () => ['sizable_cover', 'img', 'union_cover', 'cover', 'album_cover', 'pic']
  },
  songHashField: {
    type: String,
    default: 'hash'
  },
  qualityParamName: {
    type: String,
    default: 'quality'
  },
  freePartParamName: {
    type: String,
    default: 'free_part'
  },
  responseUrlField: {
    type: [String, Array],
    default: () => ['data.url', 'url']
  },
  enableConsoleLog: {
    type: Boolean,
    default: true
  },
  embedMetadata: {
    type: Boolean,
    default: true
  },
  fetchLyrics: {
    type: Boolean,
    default: true
  },
  fetchCover: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits([
  'downloadStart',
  'downloadComplete',
  'downloadFail',
  'qualitySelect',
  'modalOpen',
  'modalClose',
  'beforeDownload',
  'afterDownload',
  'apiRequest',
  'apiResponse',
  'urlProcessed',
  'fileNameGenerated'
])

const showQualityModal = ref(false)
const isProcessing = ref(false)
const currentQuality = ref(null)

watch(() => props.autoStart, (newVal) => {
  if (newVal && props.song) {
    startDownloadProcess()
  }
})

const log = (...args) => {
  if (props.enableConsoleLog) {
    console.log('[DownloadManager]', ...args)
  }
}

const checkIsVip = () => {
  // 优先查找 key 为 'vip' 的配置项
  let vipInfo = MoeAuth.Config?.find(c => c.key === 'vip')?.value
  
  // 如果没有找到，查找 key 为 'vip_info' 的配置项
  if (!vipInfo) {
    vipInfo = MoeAuth.Config?.find(c => c.key === 'vip_info')?.value
  }
  
  if (!vipInfo) return false
  
  if (vipInfo.is_vip === 1) {
    const expireTime = vipInfo.vip_end_time || vipInfo.end_time
    if (expireTime && new Date(expireTime) > new Date()) {
      return true
    }
  }
  
  if (vipInfo.busi_vip && Array.isArray(vipInfo.busi_vip)) {
    return vipInfo.busi_vip.some(vip => {
      if (!vip) return false
      const expireTime = vip.vip_end_time || vip.end_time
      return expireTime && new Date(expireTime) > new Date()
    })
  }
  
  return false
}

const claimFreeVip = async () => {
  try {
    log('尝试领取免费VIP...')
    const response = await get('/youth/vip')
    
    if (response.status === 1) {
      log('领取VIP成功，获得', response.data?.award_vip_hour, '小时VIP')
      const currentConfig = MoeAuth.Config || []
      // 将 VIP 信息存储到 key 为 'vip' 的配置项中，与登录时的逻辑保持一致
      const vipConfigIndex = currentConfig.findIndex(c => c.key === 'vip')
      if (vipConfigIndex >= 0) {
        currentConfig[vipConfigIndex].value = response.data
      } else {
        currentConfig.push({ key: 'vip', value: response.data })
      }
      await MoeAuth.setData({ Config: currentConfig })
      return true
    }
    return false
  } catch (error) {
    log('领取VIP失败:', error.message)
    return false
  }
}

const showLoginPrompt = () => {
  const goLogin = confirm('下载此歌曲需要登录，是否前往登录页面？')
  if (goLogin) {
    router.push('/login')
  }
  return false
}

const displayQualities = computed(() => {
  if (props.qualities && props.qualities.length > 0) {
    return props.qualities
  }
  return props.defaultQualities
})

const getSongCover = () => {
  if (!props.song) return null
  
  if (props.song.union_cover && props.song.union_cover.includes('http')) {
    return props.song.union_cover.replace('{size}', '480').replace(/[`"]/g, '').trim()
  }
  
  if (props.song.img && props.song.img.includes('http')) {
    return props.song.img.replace(/[`"]/g, '').trim()
  }
  
  if (props.song.sizable_cover && props.song.sizable_cover.includes('http')) {
    return props.song.sizable_cover.replace('{size}', '480').replace(/[`"]/g, '').trim()
  }
  
  if (props.song.album_info?.sizable_cover && props.song.album_info.sizable_cover.includes('http')) {
    return props.song.album_info.sizable_cover.replace('{size}', '480').replace(/[`"]/g, '').trim()
  }
  
  if (props.song.trans_param?.union_cover && props.song.trans_param.union_cover.includes('http')) {
    return props.song.trans_param.union_cover.replace('{size}', '480').replace(/[`"]/g, '').trim()
  }
  
  for (const field of props.coverFields) {
    if (props.song[field]) {
      let cover = props.song[field]
      if (typeof cover === 'string' && cover.includes('http')) {
        cover = cover.replace('{size}', '480').replace(/[`"]/g, '').trim()
        return cover
      }
    }
  }
  
  return null
}

const getSongName = () => {
  if (!props.song) return '未知歌曲'
  
  const fields = Array.isArray(props.songNameField) 
    ? props.songNameField 
    : [props.songNameField]
  
  for (const field of fields) {
    if (props.song[field]) {
      return props.song[field]
    }
  }
  
  return '未知歌曲'
}

const getSongArtist = () => {
  if (!props.song) return '未知歌手'
  
  const fields = Array.isArray(props.artistNameField) 
    ? props.artistNameField 
    : [props.artistNameField]
  
  for (const field of fields) {
    if (props.song[field]) {
      return props.song[field]
    }
  }
  
  return '未知歌手'
}

const getSongHash = () => {
  if (!props.song) return null
  return props.song[props.songHashField]
}

const getItemName = (item) => {
  return item.name || item.quality || ''
}

const getItemDescription = (item) => {
  const desc = item.quality || item.desc || item.description
  if (desc === 'flac') return '无损 FLAC'
  if (typeof desc === 'number' || (typeof desc === 'string' && !isNaN(desc))) return `${desc}K MP3`
  return desc || ''
}

const checkAndClaimVip = async () => {
  const todayKey = new Date().toISOString().split('T')[0]
  const lastClaimDate = localStorage.getItem('lastVipClaimDate')
  
  if (lastClaimDate === todayKey) {
    console.log('[VIP检查] 今天已经领取过VIP，跳过检查')
    return
  }
  
  try {
    console.log('[VIP检查] 开始获取VIP信息...')
    const VipInfoResponse = await get('/youth/union/vip')
    if (VipInfoResponse.status === 1) {
      const currentConfig = MoeAuth.Config || []
      const vipIndex = currentConfig.findIndex(item => item.key === 'vip')
      
      if (vipIndex >= 0) {
        currentConfig[vipIndex].value = VipInfoResponse.data
      } else {
        currentConfig.push({ key: 'vip', value: VipInfoResponse.data })
      }
      
      await MoeAuth.setData({ Config: currentConfig })
      
      const vipData = VipInfoResponse.data
      let isVip = false
      
      if (vipData.is_vip === 1) {
        const expireTime = vipData.vip_end_time || vipData.end_time
        if (expireTime && new Date(expireTime) > new Date()) {
          isVip = true
        }
      }
      
      if (vipData.busi_vip && Array.isArray(vipData.busi_vip)) {
        const hasValidVip = vipData.busi_vip.some(vip => {
          if (!vip) return false
          const expireTime = vip.vip_end_time || vip.end_time
          return expireTime && new Date(expireTime) > new Date()
        })
        if (hasValidVip) isVip = true
      }
      
      if (isVip) {
        console.log('[VIP检查] 用户已经是VIP，无需领取')
        localStorage.setItem('lastVipClaimDate', todayKey)
      } else {
        console.log('[VIP检查] 用户不是VIP，开始领取1天VIP...')
        const dayVipResponse = await get('/youth/day/vip', { receive_day: todayKey })
        if (dayVipResponse.status === 1) {
          console.log('[VIP领取] 1天VIP领取成功')
          localStorage.setItem('lastVipClaimDate', todayKey)
          
          await new Promise(resolve => setTimeout(resolve, 500))
          
          console.log('[VIP升级] 开始升级为概念版VIP...')
          const upgradeResponse = await get('/youth/day/vip/upgrade')
          if (upgradeResponse.status === 1) {
            console.log('[VIP升级] 概念版VIP升级成功')
          } else {
            console.log('[VIP升级] 概念版VIP升级失败:', upgradeResponse.data)
          }
          
          console.log('[VIP检查] 重新获取VIP信息...')
          const newVipInfoResponse = await get('/youth/union/vip')
          if (newVipInfoResponse.status === 1) {
            const newVipIndex = currentConfig.findIndex(item => item.key === 'vip')
            if (newVipIndex >= 0) {
              currentConfig[newVipIndex].value = newVipInfoResponse.data
            } else {
              currentConfig.push({ key: 'vip', value: newVipInfoResponse.data })
            }
            await MoeAuth.setData({ Config: currentConfig })
            console.log('[VIP检查] VIP信息已更新')
          }
        } else {
          console.log('[VIP领取] 1天VIP领取失败:', dayVipResponse.data)
          localStorage.setItem('lastVipClaimDate', todayKey)
        }
      }
    } else {
      console.log('[VIP检查] 获取VIP信息失败:', VipInfoResponse.data)
      localStorage.setItem('lastVipClaimDate', todayKey)
    }
  } catch (error) {
    console.error('[VIP检查] VIP检查失败:', error)
    localStorage.setItem('lastVipClaimDate', todayKey)
  }
}

const startDownloadProcess = async () => {
  if (!props.song) {
    const error = new Error('歌曲对象为空')
    log('下载失败:', error.message)
    emit('downloadFail', props.song, error)
    return
  }
  
  if (isProcessing.value) {
    log('正在处理中，请稍候')
    return
  }
  
  if (MoeAuth.isAuthenticated) {
    await checkAndClaimVip()
  }
  
  isProcessing.value = true
  showQualityModal.value = true
  emit('modalOpen', props.song)
  log('打开音质选择弹窗')
}

const handleQualityClose = () => {
  showQualityModal.value = false
  isProcessing.value = false
  currentQuality.value = null
  emit('modalClose')
  log('关闭音质选择弹窗')
}

const goToLogin = () => {
  showQualityModal.value = false
  router.push('/login')
}

const isItemDisabled = (item) => {
  if (!MoeAuth.isAuthenticated) {
    return item.quality === '320' || item.quality === 'flac'
  }
  return false
}

const handleQualitySelect = async (quality) => {
  currentQuality.value = quality
  showQualityModal.value = false
  emit('qualitySelect', quality)
  log('选择音质:', quality)
  
  if (!props.song) {
    const error = new Error('歌曲对象为空')
    log('下载失败:', error.message)
    emit('downloadFail', props.song, error)
    isProcessing.value = false
    return
  }
  
  try {
    emit('downloadStart', props.song, quality)
    emit('beforeDownload', props.song, quality)
    log('开始下载:', getSongName(), '-', getSongArtist())
    
    const result = await fetchDownloadUrlWithFallback(quality)
    
    if (props.autoDownload && result.url) {
      await triggerDownload(result.url, result.actualQuality || quality)
    }
    
    emit('afterDownload', props.song, quality, result.url)
    log('下载流程完成')
  } catch (error) {
    log('下载失败:', error.message)
    emit('downloadFail', props.song, error)
    if (props.enableConsoleLog && error.message !== '用户取消登录') {
      if (error.message.includes('需要登录') || error.message.includes('需要验证')) {
        message.error('请先登录')
        router.push('/login')
      } else {
        alert('下载失败：' + error.message)
      }
    }
  } finally {
    isProcessing.value = false
  }
}

const fetchDownloadUrlWithFallback = async (quality) => {
  const qualityFallbackOrder = ['flac', '320', '128']
  let currentQualityIndex = qualityFallbackOrder.indexOf(quality.quality)
  if (currentQualityIndex === -1) {
    currentQualityIndex = 1
  }
  
  let lastError = null
  let vipClaimed = false
  
  while (currentQualityIndex < qualityFallbackOrder.length) {
    const currentQuality = qualityFallbackOrder[currentQualityIndex]
    const qualityObj = { name: currentQuality === 'flac' ? '无损音质' : `${currentQuality}K`, quality: currentQuality }
    
    try {
      const url = await fetchDownloadUrl(qualityObj)
      if (currentQualityIndex > qualityFallbackOrder.indexOf(quality.quality)) {
        log(`音质降级: ${quality.quality} -> ${currentQuality}`)
      }
      return { url, actualQuality: qualityObj }
    } catch (error) {
      lastError = error
      log(`${currentQuality} 获取失败:`, error.message)
      
      if (error.message.includes('需要VIP') || error.message.includes('需要登录')) {
        if (!MoeAuth.isAuthenticated) {
          const shouldLogin = showLoginPrompt()
          if (!shouldLogin) {
            throw new Error('用户取消登录')
          }
          throw error
        }
        
        const isVip = checkIsVip()
        if (!isVip && !vipClaimed) {
          const claimed = await claimFreeVip()
          if (claimed) {
            vipClaimed = true
            continue
          }
        }
        
        if (!isVip && vipClaimed) {
          log('已领取VIP但仍无法下载，尝试降级音质...')
          currentQualityIndex++
          if (currentQualityIndex < qualityFallbackOrder.length) {
            log(`尝试降级到 ${qualityFallbackOrder[currentQualityIndex]}...`)
          }
          continue
        }
      }
      
      if (error.message.includes('无此音质资源') || error.message.includes('获取下载链接失败')) {
        currentQualityIndex++
        if (currentQualityIndex < qualityFallbackOrder.length) {
          log(`尝试降级到 ${qualityFallbackOrder[currentQualityIndex]}...`)
        }
        continue
      }
      
      throw error
    }
  }
  
  throw lastError || new Error('所有音质尝试均失败')
}

const fetchDownloadUrl = async (quality) => {
  log('请求下载URL...')
  
  let response
  
  try {
    if (props.customApiRequest && typeof props.customApiRequest === 'function') {
      log('使用自定义API请求函数')
      emit('apiRequest', props.song, quality)
      response = await props.customApiRequest(props.song, quality)
    } else {
      const data = {
        [props.songHashField]: getSongHash()
      }
      
      if (props.useAuth) {
        const authStore = props.authStore || MoeAuth
        if (authStore && !authStore.isAuthenticated) {
          data[props.freePartParamName] = 1
        }
      }
      
      if (quality.quality === 'flac') {
        data[props.qualityParamName] = 'flac'
      } else if (quality.quality === '320') {
        data[props.qualityParamName] = '320'
      } else if (quality.quality === '128') {
        data[props.qualityParamName] = '128'
      }
      
      log('请求参数:', data)
      emit('apiRequest', props.song, quality, data)
      
      if (props.apiMethod.toLowerCase() === 'post') {
        response = await get(props.apiEndpoint, data)
      } else {
        response = await get(props.apiEndpoint, data)
      }
    }
  } catch (networkError) {
    const errorData = networkError.response?.data
    const errorMsg = errorData?.error || errorData?.msg || networkError.message
    
    log('网络请求失败:', errorMsg)
    
    if (errorMsg?.includes('需要验证') || errorMsg?.includes('需要登录') || errorData?.errcode === 20028) {
      throw new Error('获取下载链接失败: 需要登录')
    }
    
    if (errorMsg?.includes('VIP') || errorMsg?.includes('会员')) {
      throw new Error('获取下载链接失败: 需要VIP')
    }
    
    throw new Error(`获取下载链接失败: ${errorMsg}`)
  }
  
  log('API响应:', response)
  emit('apiResponse', response)
  
  if (response && response.status !== 1) {
    const errorMsg = response.error?.msg || response.msg || '歌曲不可用或需要VIP'
    log('API返回错误状态:', response.status, errorMsg)
    throw new Error(`获取下载链接失败: ${errorMsg}`)
  }
  
  let url = extractUrlFromResponse(response)
  
  if (props.customUrlHandler && typeof props.customUrlHandler === 'function') {
    log('使用自定义URL处理函数')
    url = props.customUrlHandler(url, response, quality)
  } else {
    url = processUrl(url)
  }
  
  log('处理后的URL:', url)
  emit('urlProcessed', url, quality)
  
  if (!url || typeof url !== 'string') {
    const reason = !response ? 'API无响应' : 
                   response.status !== 1 ? `状态码: ${response.status}` :
                   '歌曲无此音质资源'
    throw new Error(`获取下载链接失败: ${reason}`)
  }
  
  return url
}

const extractUrlFromResponse = (response) => {
  const fields = Array.isArray(props.responseUrlField) 
    ? props.responseUrlField 
    : [props.responseUrlField]
  
  for (const field of fields) {
    const keys = field.split('.')
    let value = response
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key]
      } else {
        value = null
        break
      }
    }
    
    if (value) {
      return value
    }
  }
  
  return null
}

const processUrl = (url) => {
  if (!url) return null
  
  if (Array.isArray(url)) {
    url = url[0]
  }
  
  if (typeof url === 'string') {
    url = url.trim()
    
    if (url && !url.startsWith('http')) {
      url = 'https://' + url
    }
  }
  
  return url
}

const generateFileName = (quality) => {
  if (props.customFileName && typeof props.customFileName === 'function') {
    const fileName = props.customFileName(props.song, quality)
    log('使用自定义文件名:', fileName)
    emit('fileNameGenerated', fileName)
    return fileName
  }
  
  const songName = getSongName()
  const artistName = getSongArtist()
  const qualityName = quality.name || quality.quality || ''
  
  let fileName = `${songName} - ${artistName}`
  
  if (qualityName) {
    fileName += ` [${qualityName}]`
  }
  
  const extension = quality.quality === 'flac' ? 'flac' : 'mp3'
  fileName += `.${extension}`
  
  log('生成文件名:', fileName)
  emit('fileNameGenerated', fileName)
  return fileName
}

const triggerDownload = async (url, quality) => {
  const fileName = generateFileName(quality)
  
  if (props.customDownloadTrigger && typeof props.customDownloadTrigger === 'function') {
    log('使用自定义下载触发函数')
    await props.customDownloadTrigger(url, fileName, quality)
  } else {
    if (props.embedMetadata) {
      log('开始下载并嵌入元数据')
      try {
        const coverUrl = props.fetchCover ? getSongCover() : null
        const lyrics = props.fetchLyrics ? await fetchLyricsForSong() : null
        const hash = getSongHash()
        
        const metadataResult = await downloadWithMetadata(props.song, url, {
          coverUrl,
          lyrics,
          hash,
          quality: currentQuality.value
        })
        
        if (metadataResult.success && metadataResult.outputBlob) {
          const link = document.createElement('a')
          link.href = URL.createObjectURL(metadataResult.outputBlob)
          link.download = metadataResult.fileName || fileName
          link.click()
          
          setTimeout(() => {
            URL.revokeObjectURL(link.href)
          }, 100)
          
          log('触发浏览器下载（带元数据）:', metadataResult.fileName || fileName)
        } else {
          log('元数据嵌入失败，使用原始文件下载')
          const link = document.createElement('a')
          link.href = url
          link.download = fileName
          link.click()
          log('触发浏览器下载（原始文件）:', fileName)
        }
      } catch (metadataError) {
        log('元数据处理失败，使用原始文件下载:', metadataError)
        const link = document.createElement('a')
        link.href = url
        link.download = fileName
        link.click()
        log('触发浏览器下载（原始文件）:', fileName)
      }
    } else {
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      link.click()
      log('触发浏览器下载:', fileName)
    }
  }
  
  emit('downloadComplete', props.song, url, quality)
  log('下载成功:', fileName)
}

const fetchLyricsForSong = async () => {
  try {
    const hash = getSongHash()
    if (!hash) return null
    
    // 首先调用 /search/lyric 接口获取歌词的 id 和 accesskey
    const searchResponse = await get(`/search/lyric?hash=${hash}`)
    
    if (searchResponse.status !== 200 || !searchResponse.candidates || searchResponse.candidates.length === 0) {
      log('未找到歌词候选')
      return null
    }
    
    // 从候选列表中取第一个，获取 id 和 accesskey
    const candidate = searchResponse.candidates[0]
    const lyricId = candidate.id
    const accesskey = candidate.accesskey
    
    if (lyricId && accesskey) {
      // 然后使用获取到的 id 和 accesskey 调用 /lyric 接口
      const lyricResponse = await get(`/lyric?id=${lyricId}&accesskey=${accesskey}&fmt=lrc&decode=true`)
      
      if (lyricResponse.status === 200) {
        // 尝试从不同字段获取歌词
        const lyrics = lyricResponse.decodeContent || lyricResponse.content
        
        if (lyrics) {
          log('歌词获取成功，长度:', lyrics.length)
          return lyrics
        }
      }
    }
    
    log('未找到歌词数据')
    return null
  } catch (error) {
    log('获取歌词失败:', error)
    return null
  }
}

defineExpose({
  startDownloadProcess,
  handleQualityClose,
  handleQualitySelect,
  fetchDownloadUrl,
  triggerDownload,
  generateFileName,
  fetchLyricsForSong
})
</script>

<style scoped>
.download-manager {
  display: inline-block;
}

.download-trigger-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.download-trigger-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.download-trigger-btn:active:not(:disabled) {
  transform: translateY(0);
}

.download-trigger-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.download-trigger-btn i {
  font-size: 14px;
}

.download-trigger-btn span {
  white-space: nowrap;
}

.login-hint {
  font-size: 13px;
  color: #667eea;
  background: rgba(102, 126, 234, 0.1);
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
}

.login-hint:hover {
  background: rgba(102, 126, 234, 0.2);
  color: #5a6fd6;
}
</style>
