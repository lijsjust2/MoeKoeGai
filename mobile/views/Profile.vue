<template>
  <div class="profile-container">
    <div class="content">
      <!-- 用户基本信息和VIP部分 -->
      <div class="profile-card">
        <div class="card-left">
          <div class="avatar">
            <img v-if="userInfo?.pic" :src="userInfo.pic" alt="头像" />
            <i v-else class="fas fa-user"></i>
          </div>
          <div class="user-info">
            <h2>{{ userInfo?.nickname || userInfo?.username || '用户' }}</h2>
            <p v-if="userInfo?.userid">ID: {{ userInfo.userid }}</p>
            <div class="vip-info" :class="{ 'vip-active': isVip }" @click="showVipModal = true">
              <i v-if="isVip" class="fas fa-crown"></i>
              <span>{{ isVip ? 'VIP' : '普通用户' }}</span>
              <span class="vip-status">{{ vipStatusText }}</span>
              <i class="fas fa-chevron-right"></i>
            </div>
          </div>
        </div>
      </div>



      <!-- 固定标题 -->
      <div class="section-title">
        <h2>我的歌单</h2>
        <button class="create-playlist-btn" @click="createPlaylist">
          <i class="fas fa-plus"></i>
          <span>{{ $t('chuang-jian-ge-dan') }}</span>
        </button>
      </div>

      <!-- 音乐卡片网格（显示歌单） -->
      <div class="music-grid">
        <div class="music-card"
          v-for="(item, index) in userPlaylists" :key="index">
          <router-link :to="{
                path: '/PlaylistDetail',
                query: { global_collection_id: item.list_create_gid || item.global_collection_id, listid: item.listid}
            }">
            <img v-if="item.pic" :src="$getCover(item.pic, 480)" class="album-image" />
            <div v-else class="album-icon live-icon">
                <i class="fas fa-compact-disc"></i>
            </div>
            <div class="album-info">
              <h3>{{ item.name }}</h3>
              <p>{{ item.count }} <span>{{ $t('shou-ge') }}</span></p>
            </div>
          </router-link>
        </div>

      </div>

      <div v-if="userPlaylists.length === 0" class="empty-container">
        <div class="empty-description">{{ $t('zhe-li-shi-mo-du-mei-you') }}</div>
      </div>

      <!-- 退出登录按钮 -->
      <div class="logout-section">
        <button class="logout-btn" @click="handleLogout">
          <i class="fas fa-sign-out-alt"></i>
          退出登录
        </button>
      </div>
    </div>

    <VipInfoModal
      :show="showVipModal"
      :vip-data="vipInfo"
      @close="showVipModal = false"
      @refresh="getVipInfo"
    />

    <div v-if="message" class="toast" :class="message.type">
      <i :class="message.type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle'"></i>
      {{ message.text }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { get } from '../utils/request'
import { MoeAuthStore } from '../stores/store'
import { useI18n } from 'vue-i18n'
import BirthdayEasterEgg from '../components/BirthdayEasterEgg.vue'
import VipInfoModal from '../components/VipInfoModal.vue'

const router = useRouter()
const MoeAuth = MoeAuthStore()
const { t } = useI18n()

// VIP相关状态
const showVipModal = ref(false)
const claiming = ref(false)
const claimingDay = ref(false)
const upgrading = ref(false)
const monthRecord = ref(null)
const message = ref(null)
const hasClaimedDayVip = ref(false)

// Library相关状态
const userDetail = ref({})
const userPlaylists = ref([]) // 创建的歌单
const collectedPlaylists = ref([]) // 收藏的歌单
const collectedAlbums = ref([]) // 收藏的专辑
const isLoading = ref(true)

const userInfo = computed(() => MoeAuth.UserInfo)

const vipInfo = computed(() => {
  const config = MoeAuth.Config
  if (!config) return null
  
  // 优先查找 key 为 'vip' 的配置项
  const vipConfig = config.find(item => item.key === 'vip')
  if (vipConfig) return vipConfig.value
  
  // 如果没有找到，查找 key 为 'vip_info' 的配置项
  const vipInfoConfig = config.find(item => item.key === 'vip_info')
  if (vipInfoConfig) return vipInfoConfig.value
  
  return null
})

const isVip = computed(() => {
  if (!vipInfo.value) return false
  
  if (vipInfo.value.is_vip === 1) {
    const expireTime = vipInfo.value.vip_end_time || vipInfo.value.end_time
    if (expireTime && new Date(expireTime) > new Date()) {
      return true
    }
  }
  
  if (vipInfo.value.busi_vip && Array.isArray(vipInfo.value.busi_vip)) {
    return vipInfo.value.busi_vip.some(vip => {
      if (!vip) return false
      const expireTime = vip.vip_end_time || vip.end_time
      return expireTime && new Date(expireTime) > new Date()
    })
  }
  
  if (vipInfo.value?.data) {
    const expireTime = vipInfo.value.data.expire_time || vipInfo.value.data.due_date || vipInfo.value.data.vip_end_time
    if (expireTime && new Date(expireTime) > new Date()) {
      return true
    }
  }
  
  return false
})

const isConceptVip = computed(() => {
  if (!vipInfo.value?.busi_vip || !Array.isArray(vipInfo.value.busi_vip)) {
    return false
  }
  
  return vipInfo.value.busi_vip.some(vip => {
    if (!vip) return false
    if (vip.busi_type !== 'concept') return false
    const expireTime = vip.vip_end_time || vip.end_time
    return expireTime && new Date(expireTime) > new Date()
  })
})

const vipStatusText = computed(() => {
  if (!vipInfo.value) return '未开通VIP'
  
  if (isVip.value) {
    let expireTime = vipInfo.value.vip_end_time || vipInfo.value.end_time
    
    if (!expireTime && vipInfo.value.busi_vip && Array.isArray(vipInfo.value.busi_vip)) {
      const validVips = vipInfo.value.busi_vip.filter(vip => {
        return vip && vip.vip_end_time && new Date(vip.vip_end_time) > new Date()
      })
      
      if (validVips.length > 0) {
        const longestVip = validVips.reduce((longest, current) => {
          const longestTime = new Date(longest.vip_end_time).getTime()
          const currentTime = new Date(current.vip_end_time).getTime()
          return currentTime > longestTime ? current : longest
        })
        expireTime = longestVip.vip_end_time
      }
    }
    
    if (expireTime) {
      const date = new Date(expireTime)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const seconds = String(date.getSeconds()).padStart(2, '0')
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    }
  }
  
  return ''
})

const canShowUpgradeButton = computed(() => {
  return isVip.value && !hasClaimedDayVip.value
})

const showMessage = (text, type = 'success') => {
  message.value = { text, type }
  setTimeout(() => {
    message.value = null
  }, 3000)
}

// Library相关方法

// 格式化听歌时长（分钟转为小时和分钟）
const formatDuration = (minutes) => {
  if (!minutes) return '0'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0) {
    return `${hours}${t('xiao-shi')} ${mins}${t('fen-zhong')}`
  }
  return `${mins}${t('fen-zhong')}`
}

// 格式化注册时间
const formatRegTime = (timestamp) => {
  if (!timestamp) return ''
  const registerDate = new Date(timestamp * 1000)
  const now = new Date()
  const years = now.getFullYear() - registerDate.getFullYear()
  return `${t('le-ling')} ${years} ${t('nian')}`
}

const playSong = (hash, name, img, author) => {
  props.playerControl.addSongToQueue(hash, name, img, author)
}

const getUserDetails = () => {
  // 获取用户详细信息
  getUserDetail().finally(() => {
    isLoading.value = false 
  })
  // 获取用户创建和收藏的歌单
  getplaylist()
}

// 获取用户详细信息
const getUserDetail = async () => {
  try {
    const detailResponse = await get('/user/detail')
    if (detailResponse.status === 1) {
      userDetail.value = detailResponse.data
    }
  } catch (error) {
    console.error('Failed to get user details:', error)
  }
}

const getVipInfo = async () => {
  try {
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
    }
  } catch (error) {
    window.$modal.alert(t('deng-lu-shi-xiao-qing-zhong-xin-deng-lu'))
    router.push('/login')
  }
}

const checkAndClaimVip = async () => {
  try {
    const todayKey = new Date().toISOString().split('T')[0]
    const lastClaimDate = localStorage.getItem('lastVipClaimDate')
    const currentUserId = MoeAuth.UserInfo?.userid
    
    console.log('[Profile VIP检查] 开始检查VIP状态...')
    console.log('[Profile VIP检查] 当前用户ID:', currentUserId)
    
    // 检查本地是否有缓存的VIP信息
    const cachedVipInfo = localStorage.getItem('cachedVipInfo')
    const cachedUserId = localStorage.getItem('cachedVipUserId')
    
    let vipInfoData
    let needRefreshVipInfo = false
    
    // 检查缓存的VIP信息是否仍然有效（VIP未过期）且属于当前用户
    if (cachedVipInfo && cachedUserId === currentUserId) {
      const parsedVipInfo = JSON.parse(cachedVipInfo)
      let isVipValid = false
      
      // 检查基础VIP是否有效
      if (parsedVipInfo.is_vip === 1) {
        const expireTime = parsedVipInfo.vip_end_time || parsedVipInfo.end_time
        if (expireTime && new Date(expireTime) > new Date()) {
          isVipValid = true
          console.log('[Profile VIP检查] 缓存的基础VIP仍然有效，过期时间:', expireTime)
        }
      }
      
      // 检查商业VIP是否有效
      if (!isVipValid && parsedVipInfo.busi_vip && Array.isArray(parsedVipInfo.busi_vip)) {
        const hasValidBusiVip = parsedVipInfo.busi_vip.some(vip => {
          if (!vip) return false
          const expireTime = vip.vip_end_time || vip.end_time
          return expireTime && new Date(expireTime) > new Date()
        })
        if (hasValidBusiVip) {
          isVipValid = true
          console.log('[Profile VIP检查] 缓存的商业VIP仍然有效')
        }
      }
      
      if (isVipValid) {
        console.log('[Profile VIP检查] 使用缓存的VIP信息（VIP未过期且属于当前用户）...')
        vipInfoData = parsedVipInfo
      } else {
        console.log('[Profile VIP检查] 缓存的VIP已过期或用户不是VIP，开始获取VIP信息...')
        needRefreshVipInfo = true
      }
    } else {
      if (cachedVipInfo && cachedUserId !== currentUserId) {
        console.log('[Profile VIP检查] 缓存的VIP信息属于其他用户，开始获取VIP信息...')
      } else {
        console.log('[Profile VIP检查] 缓存不存在，开始获取VIP信息...')
      }
      needRefreshVipInfo = true
    }
    
    // 只有在需要刷新时才请求接口
    if (needRefreshVipInfo) {
      const VipInfoResponse = await get('/youth/union/vip')
      console.log('[Profile VIP检查] 获取VIP信息响应:', VipInfoResponse)
      
      if (VipInfoResponse.status === 1) {
        vipInfoData = VipInfoResponse.data
        // 更新缓存，同时存储用户ID
        localStorage.setItem('cachedVipInfo', JSON.stringify(vipInfoData))
        localStorage.setItem('cachedVipUserId', currentUserId)
        console.log('[Profile VIP检查] VIP信息已缓存，用户ID:', currentUserId)
        
        // 更新存储中的VIP信息
        const currentConfig = MoeAuth.Config || []
        const vipIndex = currentConfig.findIndex(item => item.key === 'vip')
        
        if (vipIndex >= 0) {
          currentConfig[vipIndex].value = vipInfoData
        } else {
          currentConfig.push({ key: 'vip', value: vipInfoData })
        }
        
        await MoeAuth.setData({ Config: currentConfig })
      } else {
        console.log('[Profile VIP检查] 获取VIP信息失败:', VipInfoResponse.data)
        return
      }
    }
    
    // 检查用户VIP状态
    let isVip = false
    
    if (vipInfoData.is_vip === 1) {
      const expireTime = vipInfoData.vip_end_time || vipInfoData.end_time
      if (expireTime && new Date(expireTime) > new Date()) {
        isVip = true
      }
    }
    
    if (vipInfoData.busi_vip && Array.isArray(vipInfoData.busi_vip)) {
      const hasValidVip = vipInfoData.busi_vip.some(vip => {
        if (!vip) return false
        const expireTime = vip.vip_end_time || vip.end_time
        return expireTime && new Date(expireTime) > new Date()
      })
      if (hasValidVip) {
        isVip = true
      }
    }
    
    console.log('[Profile VIP检查] 最终VIP状态:', isVip)
    
    if (isVip) {
      console.log('[Profile VIP检查] 用户已经是VIP，无需领取')
      localStorage.setItem('lastVipClaimDate', todayKey)
    } else {
      // 只有当今天还没有领取过VIP时才尝试领取
      if (lastClaimDate !== todayKey) {
        console.log('[Profile VIP检查] 用户不是VIP，开始领取1天VIP...')
        const dayVipResponse = await get('/youth/day/vip', { receive_day: todayKey })
        console.log('[Profile VIP领取] 领取1天VIP响应:', dayVipResponse)
        
        if (dayVipResponse.status === 1) {
          console.log('[Profile VIP领取] 1天VIP领取成功')
          
          await new Promise(resolve => setTimeout(resolve, 500))
          
          console.log('[Profile VIP升级] 开始升级为概念版VIP...')
          const upgradeResponse = await get('/youth/day/vip/upgrade')
          console.log('[Profile VIP升级] 升级概念版VIP响应:', upgradeResponse)
          
          if (upgradeResponse.status === 1) {
            console.log('[Profile VIP升级] 概念版VIP升级成功')
          } else {
            console.log('[Profile VIP升级] 概念版VIP升级失败:', upgradeResponse.data)
          }
          
          // 领取VIP成功后，重新获取VIP信息并更新到存储中
          console.log('[Profile VIP检查] 重新获取VIP信息...')
          const updatedVipInfoResponse = await get('/youth/union/vip')
          console.log('[Profile VIP检查] 重新获取VIP信息响应:', updatedVipInfoResponse)
          
          if (updatedVipInfoResponse.status === 1) {
            // 直接创建一个新的配置数组，只包含VIP信息
            const newConfig = [{ key: 'vip', value: updatedVipInfoResponse.data }]
            
            // 确保VIP信息被正确保存
            await MoeAuth.setData({ Config: newConfig })
            console.log('[Profile VIP检查] VIP信息已更新到存储')
            
            // 更新缓存，同时存储用户ID
            localStorage.setItem('cachedVipInfo', JSON.stringify(updatedVipInfoResponse.data))
            localStorage.setItem('cachedVipUserId', currentUserId)
            console.log('[Profile VIP检查] VIP信息缓存已更新，用户ID:', currentUserId)
            
            // 检查领取后用户是否真的成为了VIP
            const afterClaimVipData = updatedVipInfoResponse.data
            let isVipAfterClaim = false
            
            if (afterClaimVipData.is_vip === 1) {
              const expireTime = afterClaimVipData.vip_end_time || afterClaimVipData.end_time
              if (expireTime && new Date(expireTime) > new Date()) {
                isVipAfterClaim = true
              }
            }
            
            if (afterClaimVipData.busi_vip && Array.isArray(afterClaimVipData.busi_vip)) {
              isVipAfterClaim = afterClaimVipData.busi_vip.some(vip => {
                if (!vip) return false
                const expireTime = vip.vip_end_time || vip.end_time
                return expireTime && new Date(expireTime) > new Date()
              })
            }
            
            if (isVipAfterClaim) {
              console.log('[Profile VIP检查] 领取后用户确实成为了VIP')
              localStorage.setItem('lastVipClaimDate', todayKey)
            } else {
              console.log('[Profile VIP检查] 领取后用户仍然不是VIP，不更新领取记录')
            }
          }
        } else {
          console.log('[Profile VIP领取] 1天VIP领取失败:', dayVipResponse.data)
          localStorage.setItem('lastVipClaimDate', todayKey)
        }
      } else {
        console.log('[Profile VIP检查] 今天已经尝试领取过VIP，跳过领取')
      }
    }
  } catch (error) {
    console.error('[Profile VIP检查] VIP检查失败:', error)
    localStorage.setItem('lastVipClaimDate', todayKey)
  }
}

const getplaylist = async () => {
  try {
    const playlistResponse = await get('/user/playlist',{
      pagesize: 500,
      t: localStorage.getItem('t')
    })
    if (playlistResponse.status === 1) {
      const sortedInfo = playlistResponse.data.info.sort((a, b) => {
        if (a.sort !== b.sort) {
          return a.sort - b.sort
        }
        return 0
      })

      userPlaylists.value = sortedInfo.filter(playlist => {
        if (playlist.name == '我喜欢') {
          localStorage.setItem('like', playlist.listid)
        }
        return playlist.list_create_userid === userInfo.value?.userid || playlist.name === '我喜欢'
      }).sort((a, b) => {
        // 我喜欢 (is_def: 2) 排在最前面
        if (a.is_def === 2) return -1
        if (b.is_def === 2) return 1
        // 默认收藏 (is_def: 1) 排在第二位
        if (a.is_def === 1) return -1
        if (b.is_def === 1) return 1
        // 其他歌单按照创建时间新到旧排序
        if (a.create_time && b.create_time) {
          return new Date(b.create_time) - new Date(a.create_time)
        }
        return 0
      })

      collectedPlaylists.value = sortedInfo.filter(playlist => 
        playlist.list_create_userid !== userInfo.value?.userid && !playlist.authors
      )

      collectedAlbums.value = sortedInfo.filter(playlist => 
        playlist.list_create_userid !== userInfo.value?.userid && playlist.authors
      )

      await loadPlaylistCovers(userPlaylists.value)
      
      const collectedIds = []
      sortedInfo.forEach(playlist => {
        if (playlist.list_create_userid !== userInfo.value?.userid) {
          collectedIds.push({
            list_create_listid: playlist.list_create_listid, 
            listid: playlist.listid
          })
        }
      })
      localStorage.setItem('collectedPlaylists', JSON.stringify(collectedIds))
    }
  } catch (error) {
    window.$modal.alert(t('xin-zeng-zhang-hao-qing-xian-zai-guan-fang-ke-hu-duan-zhong-deng-lu-yi-ci'))
  }
}

const createPlaylist = async () => {
  const result = await window.$modal.prompt(t('qing-shu-ru-xin-de-ge-dan-ming-cheng'), '')
  if (result) {
    try {
      const playlistResponse = await get('/playlist/add', { name: result, list_create_userid: userInfo.value?.userid })
      if (playlistResponse.status === 1) {
        localStorage.setItem('t', Date.now())
        getplaylist()
        showMessage('歌单创建成功')
      }
    } catch (error) {
      window.$modal.alert(t('chuang-jian-shi-bai'))
    }
  }
}

const loadPlaylistCovers = async (playlists) => {
  for (const playlist of playlists) {
    try {
      const response = await get('/playlist/track/all', {
        id: playlist.global_collection_id,
        page: 1,
        pagesize: 1
      })
      
      if (response.status === 1 && response.data?.songs?.length > 0) {
        const firstSong = response.data.songs[0]
        if (firstSong.cover) {
          playlist.pic = firstSong.cover.replace('{size}', 480)
        }
      }
      
      if (!playlist.pic) {
        playlist.pic = ''
      }
    } catch (error) {
      console.error(`Failed to load cover for playlist ${playlist.name}:`, error)
      if (!playlist.pic) {
        playlist.pic = ''
      }
    }
  }
}

const goToArtistDetail = (artist) => {
  if (!artist.singerid) return
  router.push({
    path: '/PlaylistDetail',
    query: { 
      singerid: artist.singerid,
      unfollow: true
    }
  })
}

const handleLogout = () => {
  MoeAuth.clearData()
  showMessage('已退出登录')
  router.push('/login')
}

const props = defineProps({
  playerControl: Object
})

let vipCheckInterval = null

onMounted(() => {
  if (!MoeAuth.isAuthenticated) {
    router.push('/login')
    return
  }
  
  // 获取用户VIP信息
  getVipInfo()
  // 获取用户详细信息和歌单
  getUserDetails()
  
  // 定期检查VIP状态，每5分钟检查一次
  vipCheckInterval = setInterval(() => {
    checkAndClaimVip()
  }, 5 * 60 * 1000)
})

onUnmounted(() => {
  // 清除定时器
  if (vipCheckInterval) {
    clearInterval(vipCheckInterval)
    vipCheckInterval = null
  }
})
</script>

<style scoped>
.profile-container {
  min-height: 100vh;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
}

.content {
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

/* Profile Card */
.profile-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  padding: 30px;
  margin-bottom: 20px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.vip-buttons-container {
  margin-bottom: 0;
}

.card-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar i {
  font-size: 40px;
  color: white;
}

.user-info h2 {
  font-size: 24px;
  color: #333;
  margin-bottom: 5px;
}

.user-info p {
  color: #999;
  font-size: 14px;
}

.card-right {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.vip-section {
  background: #f5f5f5;
  border-radius: 12px;
  padding: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.vip-section.vip-active {
  background: linear-gradient(135deg, #ffd700 0%, #ffaa00 100%);
}

.vip-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #666;
}

.vip-section.vip-active .vip-badge {
  color: white;
}

.vip-badge i {
  font-size: 20px;
}

.vip-status {
  font-size: 14px;
  color: #999;
}

.vip-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  margin-top: 8px;
  cursor: pointer;
  transition: all 0.3s;
  padding: 8px 12px;
  border-radius: 8px;
}

.vip-info:hover {
  background: rgba(102, 126, 234, 0.05);
  transform: translateX(4px);
}

.vip-info i {
  font-size: 16px;
  color: #ffd700;
}

.vip-info span {
  color: #666;
}

.vip-info .vip-status {
  margin-left: 8px;
  color: #999;
}

.vip-info.vip-active span {
  color: #ffaa00;
  font-weight: 600;
}

.vip-info.vip-active .vip-status {
  color: #ffaa00;
}

.section-title {
  margin: 20px 0;
  padding: 0 10px;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.section-title h2 {
  font-size: 20px;
  font-weight: 600;
  color: white;
  margin: 0;
  float: left;
  line-height: 40px;
}

.create-playlist-btn {
  float: right;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 20px;
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  white-space: nowrap;
}

.section-title::after {
  content: '';
  display: table;
  clear: both;
}

/* Profile Detail Section */
.profile-detail-section {
  margin-bottom: 30px;
}

.profile-header {
  width: 100%;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 50%, rgba(240, 147, 251, 0.2) 100%);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  margin-bottom: 20px;
  display: flex;
  align-items: flex-end;
  padding: 25px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  position: relative;
  overflow: visible;
  transition: all 0.4s ease;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.profile-header:hover {
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
  border-color: rgba(255, 255, 255, 0.25);
}

.profile-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.5) 100%);
  border-radius: 24px;
  z-index: 1;
}

.profile-info {
  display: flex;
  align-items: flex-end;
  gap: 20px;
  color: white;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
  width: 100%;
  z-index: 2;
}

.profile-pic {
  border-radius: 50%;
  width: 100px;
  height: 100px;
  border: 4px solid white;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
  margin-bottom: 15px;
  position: relative;
  top: -25px;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.profile-pic:hover {
  transform: scale(1.08);
}

.user-details {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  height: 100%;
  flex: 1;
}

.user-name-row {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.user-name {
  font-size: 30px;
  font-weight: 700;
  margin: 0;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  letter-spacing: 0.5px;
  color: white;
}

.user-level {
  font-size: 13px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 5px 14px;
  border-radius: 20px;
  color: white;
  font-weight: 600;
  box-shadow: 0 3px 10px rgba(102, 126, 234, 0.4);
  margin-left: 10px;
}

.user-signature {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.95);
  margin-bottom: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  font-weight: 400;
}

.user-stats {
  display: flex;
  justify-content: flex-start;
  gap: 28px;
  margin-bottom: 10px;
  font-size: 14px;
  color: #fff;
}

.user-stats .stat-item {
  text-align: center;
  transition: transform 0.3s ease;
}

.user-stats .stat-item:hover {
  transform: translateY(-2px);
}

.user-stats .stat-value {
  font-size: 22px;
  font-weight: 700;
  display: inline-block;
  margin-right: 4px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  color: white;
}

.user-stats .stat-label {
  display: inline-block;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.75);
}

.user-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #fff;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.user-gender i {
  font-size: 16px;
  color: #fff;
}

.user-duration,
.user-age {
  background-color: rgba(255, 255, 255, 0.18);
  padding: 5px 12px;
  border-radius: 18px;
  color: white;
  font-weight: 500;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Favorite Section */
.section-title {
  font-size: 26px;
  font-weight: 700;
  margin-bottom: 20px;
  color: white;
  cursor: pointer;
  display: inline-block;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  letter-spacing: 0.5px;
}

.section-title:hover {
  transform: translateY(-2px);
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.favorite-section {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 20px;
  margin-bottom: 30px;
  backdrop-filter: blur(20px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.song-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  margin-top: 10px;
}

.song-item {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  width: calc(50% - 6px);
  background: rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.song-item:hover {
  background: rgba(255, 255, 255, 0.12);
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
  border-color: rgba(255, 255, 255, 0.15);
}

.album-cover {
  width: 56px;
  height: 56px;
  border-radius: 10px;
  margin-right: 12px;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
  transition: transform 0.3s ease;
}

.song-item:hover .album-cover {
  transform: scale(1.05);
}

.song-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  max-width: calc(100% - 72px);
}

.album-name {
  font-weight: 600;
  margin-bottom: 4px;
  font-size: 14px;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.singer-name {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

/* Category Tabs */
.category-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 25px;
  flex-wrap: wrap;
  padding: 5px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 25px;
  backdrop-filter: blur(10px);
}

.category-tabs button {
  background: transparent;
  border: none;
  padding: 12px 20px;
  border-radius: 20px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 500;
  position: relative;
}

.category-tabs button:hover {
  color: white;
  background: rgba(255, 255, 255, 0.1);
}

.category-tabs button.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-weight: 600;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

/* Music Grid */
.music-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
  margin-bottom: 30px;
}

.music-card {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.music-card:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.2);
}

.music-card a {
  text-decoration: none;
  color: inherit;
  display: block;
  height: 100%;
}

.album-image {
  width: 100%;
  height: 160px;
  object-fit: cover;
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.album-icon {
  width: 100%;
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.live-icon {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.live-icon i {
  font-size: 60px;
  color: white;
}

.music-card:hover .album-image,
.music-card:hover .album-icon {
  transform: scale(1.08);
}

.album-info {
  padding: 14px;
}

.album-info h3 {
  margin: 0 0 6px 0;
  font-size: 15px;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
  line-height: 1.4;
}

.album-info p {
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.65);
}

/* Create Playlist Button */
.create-playlist-button {
  color: white;
  border-radius: 16px;
  cursor: pointer;
  position: relative;
  background: rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
}

.create-playlist-button:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-5px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
}

.add-icon {
  width: 100%;
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%);
  border-radius: 16px 16px 0 0;
  transition: all 0.3s ease;
}

.create-playlist-button:hover .add-icon {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.5) 0%, rgba(118, 75, 162, 0.5) 100%);
}

.add-icon i {
  font-size: 48px;
  color: white;
  opacity: 0.9;
  transition: all 0.3s ease;
}

.create-playlist-button:hover .add-icon i {
  font-size: 56px;
  opacity: 1;
  transform: rotate(90deg);
}

.create-playlist-button h3 {
  text-align: center;
  padding: 14px;
  margin: 0;
  font-size: 15px;
  color: white;
  font-weight: 600;
}

/* Empty Container */
.empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  backdrop-filter: blur(10px);
}

.empty-image {
  margin-bottom: 20px;
  display: flex;
  justify-content: center;
}

.empty-image img {
  width: 200px;
  height: 200px;
  opacity: 0.8;
  filter: brightness(1.2);
}

.empty-description {
  color: rgba(255, 255, 255, 0.8);
  font-size: 16px;
  text-align: center;
  margin-left: 0;
  font-weight: 500;
}

/* Skeleton Loader */
.skeleton-loader {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  margin-top: 10px;
}

.skeleton-item {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
  width: calc(50% - 10px);
  border-radius: 12px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  height: 80px;
}

.skeleton-cover {
  width: 60px;
  height: 60px;
  margin-right: 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
}

.skeleton-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  max-width: calc(100% - 75px);
}

.skeleton-line {
  height: 12px;
  background: rgba(255, 255, 255, 0.1);
  margin-bottom: 8px;
  border-radius: 6px;
  width: 150px;
}

/* Logout Section */
.logout-section {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 20px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 20px;
}

.logout-btn {
  width: 100%;
  padding: 15px;
  background: #ff4757;
  border: none;
  border-radius: 12px;
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.logout-btn:hover {
  background: #ff6b81;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(255, 71, 87, 0.4);
}

/* Toast */
.toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 15px 30px;
  border-radius: 10px;
  color: white;
  font-size: 15px;
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 1000;
  animation: slideDown 0.3s ease;
}

.toast.success {
  background: linear-gradient(135deg, #00b894 0%, #00cec9 100%);
}

.toast.error {
  background: linear-gradient(135deg, #ff4757 0%, #ff6b81 100%);
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

/* Responsive */
@media (max-width: 768px) {
  .content {
    max-width: 100%;
  }
  
  .music-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
  }
  
  .song-item {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .profile-container {
    padding: 15px;
  }

  .profile-card {
    padding: 20px;
  }

  .card-left {
    flex-direction: column;
    text-align: center;
  }

  .avatar {
    width: 100px;
    height: 100px;
  }

  .avatar i {
    font-size: 50px;
  }

  .profile-info {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .profile-pic {
    position: static;
    margin-bottom: 15px;
  }

  .user-name-row {
    justify-content: center;
  }

  .user-stats {
    justify-content: center;
    gap: 20px;
  }

  .user-meta {
    justify-content: center;
  }

  .music-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 10px;
  }

  .album-image {
    height: 120px;
  }
}
</style>
