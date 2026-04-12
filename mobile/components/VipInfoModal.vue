<template>
  <teleport to="body">
    <transition name="modal-fade">
      <div v-if="show" class="vip-modal-overlay" @click="handleOverlayClick">
        <div class="vip-modal-content" @click.stop>
          <div class="vip-modal-header">
            <div class="header-title">
              <i class="fas fa-crown"></i>
              <span>VIP信息</span>
            </div>
            <button class="close-btn" @click="handleClose">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="vip-modal-body">
            <div v-if="vipData" class="vip-info-section">
              <div v-if="displayVipList.length > 0" class="vip-busi-list">
                <div v-for="(vip, index) in displayVipList" :key="index" class="vip-item">
                  <div class="vip-label">{{ vip.type }}</div>
                  <div class="vip-value">
                    {{ formatVipTime(vip.expireTime) }}
                  </div>
                </div>
              </div>
              
              <div v-else class="vip-empty">
                <i class="fas fa-info-circle"></i>
                <span>暂无有效VIP</span>
              </div>
            </div>
            
            <div class="vip-actions-section">
              <button 
                class="vip-action-btn claim-btn" 
                :disabled="claiming"
                @click="handleClaimVip"
              >
                <i class="fas fa-gift"></i>
                <span>{{ claiming ? '领取中...' : '领取3小时VIP' }}</span>
              </button>
              
              <button 
                class="vip-action-btn day-btn" 
                :disabled="claimingDay"
                @click="handleClaimDayVip"
              >
                <i class="fas fa-calendar-day"></i>
                <span>{{ claimingDay ? '领取中...' : '领取1天VIP' }}</span>
              </button>
              
              <button 
                v-if="canShowUpgrade"
                class="vip-action-btn upgrade-btn" 
                :disabled="upgrading"
                @click="handleUpgradeVip"
              >
                <i class="fas fa-arrow-up"></i>
                <span>{{ upgrading ? '升级中...' : '升级概念版VIP' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
    
    <div v-if="message" class="toast" :class="message.type">
      <i :class="message.type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle'"></i>
      {{ message.text }}
    </div>
  </teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import { get } from '../utils/request'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  vipData: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'refresh'])

const claiming = ref(false)
const claimingDay = ref(false)
const upgrading = ref(false)
const message = ref(null)

const hasValidVip = computed(() => {
  if (!props.vipData) return false
  
  if (props.vipData.is_vip === 1) {
    const expireTime = props.vipData.vip_end_time || props.vipData.end_time
    if (expireTime && new Date(expireTime) > new Date()) {
      return true
    }
  }
  
  if (props.vipData.busi_vip && Array.isArray(props.vipData.busi_vip)) {
    return props.vipData.busi_vip.some(vip => {
      if (!vip) return false
      const expireTime = vip.vip_end_time || vip.end_time
      return expireTime && new Date(expireTime) > new Date()
    })
  }
  
  return false
})

const displayVipList = computed(() => {
  if (!props.vipData) return []
  
  const vipList = []
  
  if (props.vipData.is_vip === 1) {
    const expireTime = props.vipData.vip_end_time || props.vipData.end_time
    if (expireTime && new Date(expireTime) > new Date()) {
      vipList.push({
        type: '普通VIP',
        expireTime: expireTime
      })
    }
  }
  
  if (props.vipData.busi_vip && Array.isArray(props.vipData.busi_vip)) {
    props.vipData.busi_vip.forEach(vip => {
      if (!vip) return
      const expireTime = vip.vip_end_time || vip.end_time
      if (expireTime && new Date(expireTime) > new Date()) {
        const typeName = getVipTypeName(vip.busi_type)
        vipList.push({
          type: typeName,
          expireTime: expireTime
        })
      }
    })
  }
  
  const expireTimeMap = new Map()
  vipList.forEach(vip => {
    const key = vip.expireTime
    if (!expireTimeMap.has(key)) {
      expireTimeMap.set(key, vip)
    } else {
      const existing = expireTimeMap.get(key)
      const existingTypes = existing.type.split('、')
      if (!existingTypes.includes(vip.type)) {
        existing.type = `${existing.type}、${vip.type}`
      }
    }
  })
  
  return Array.from(expireTimeMap.values())
})

const canShowUpgrade = computed(() => {
  return hasValidVip.value
})

const formatVipTime = (expireTime) => {
  if (!expireTime) return '未开通'
  
  const date = new Date(expireTime)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

const getVipTypeName = (busiType) => {
  const typeMap = {
    'concept': '概念版VIP',
    'dvip': '畅听VIP',
    'qvip': '超级VIP'
  }
  return typeMap[busiType] || 'VIP'
}

const handleOverlayClick = () => {
  handleClose()
}

const handleClose = () => {
  emit('close')
}

const handleClaimVip = async () => {
  try {
    claiming.value = true
    const todayKey = new Date().toISOString().split('T')[0]
    const response = await get('/youth/vip')
    
    if (response.status === 1) {
      localStorage.setItem('lastVipClaimDate', todayKey)
      showMessage(`签到成功，获得${response.data.award_vip_hour}小时VIP`)
      await new Promise(resolve => setTimeout(resolve, 2000))
      emit('refresh')
    } else {
      const errorMsg = getErrorMessage(response)
      showMessage(errorMsg || '领取失败', 'error')
    }
  } catch (error) {
    console.error('领取VIP失败:', error)
    const errorData = error.response?.data || error.response
    const errorMsg = getErrorMessage(errorData) || error.message || '领取失败，请稍后重试'
    showMessage(errorMsg, 'error')
  } finally {
    claiming.value = false
  }
}

const handleClaimDayVip = async () => {
  try {
    claimingDay.value = true
    const todayKey = new Date().toISOString().split('T')[0]
    
    const response = await get('/youth/day/vip', {
      receive_day: todayKey
    })
    
    if (response.status === 1) {
      localStorage.setItem('lastVipClaimDate', todayKey)
      showMessage('领取成功！获得1天VIP')
      await new Promise(resolve => setTimeout(resolve, 2000))
      emit('refresh')
    } else {
      const errorMsg = getErrorMessage(response)
      showMessage(errorMsg || '领取失败', 'error')
    }
  } catch (error) {
    console.error('领取1天VIP失败:', error)
    const errorData = error.response?.data || error.response
    const errorMsg = getErrorMessage(errorData) || error.message || '领取失败，请稍后重试'
    showMessage(errorMsg, 'error')
  } finally {
    claimingDay.value = false
  }
}

const handleUpgradeVip = async () => {
  try {
    upgrading.value = true
    const response = await get('/youth/day/vip/upgrade')
    
    if (response.status === 1) {
      showMessage('升级成功！获得1天概念版VIP')
      await new Promise(resolve => setTimeout(resolve, 2000))
      emit('refresh')
    } else {
      const errorMsg = getErrorMessage(response)
      showMessage(errorMsg || '升级失败', 'error')
    }
  } catch (error) {
    console.error('升级VIP失败:', error)
    // 尝试从error.response.data中获取错误信息
    const errorData = error.response?.data || error.response
    const errorMsg = getErrorMessage(errorData) || error.message || '升级失败，请稍后重试'
    showMessage(errorMsg, 'error')
  } finally {
    upgrading.value = false
  }
}

const getErrorMessage = (response) => {
  if (!response) return '操作失败'
  
  // 优先检查错误码
  if (response.error_code) {
    return getErrorCodeMessage(response.error_code)
  }
  
  if (typeof response.data === 'string') {
    return response.data
  }
  
  if (typeof response.data === 'object') {
    if (response.data.msg) return response.data.msg
    if (response.data.message) return response.data.message
    if (response.data.error) return response.data.error
    if (response.data.err_msg) return response.data.err_msg
  }
  
  if (response.status === 0) {
    return '操作失败，请稍后重试'
  }
  
  return '操作失败'
}

const getErrorCodeMessage = (errorCode) => {
  const errorMessages = {
    '131001': '今日已领取过VIP，请明天再试',
    '131002': 'VIP领取次数已达上限',
    '131003': '账号异常，无法领取VIP',
    '131004': '系统繁忙，请稍后重试',
    '131005': '活动已结束',
    '131006': '不符合领取条件',
    '297002': '今日已升级过概念版VIP，请明天再试',
    '297003': '升级VIP失败，请稍后重试',
    '297004': '系统繁忙，请稍后重试'
  }
  return errorMessages[errorCode] || `操作失败（错误码：${errorCode}）`
}

const showMessage = (text, type = 'success') => {
  message.value = { text, type }
  setTimeout(() => {
    message.value = null
  }, 3000)
}
</script>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.vip-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
  padding: 20px;
}

.vip-modal-content {
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  animation: modalSlideIn 0.3s ease-out;
  width: 90%;
  max-width: 400px;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.vip-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 16px 16px 0 0;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
}

.header-title i {
  font-size: 20px;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  font-size: 14px;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: rotate(90deg);
}

.vip-modal-body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.vip-info-section {
  margin-bottom: 20px;
}

.vip-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 10px;
}

.vip-label {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.vip-value {
  font-size: 14px;
  color: #333;
  font-weight: 600;
}

.vip-busi-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.vip-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  color: #999;
  font-size: 14px;
}

.vip-actions-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.vip-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  color: white;
}

.vip-action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.vip-action-btn i {
  font-size: 16px;
}

.claim-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.claim-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.day-btn {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.day-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(245, 87, 108, 0.3);
}

.upgrade-btn {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.upgrade-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 242, 254, 0.3);
}

@media (max-width: 480px) {
  .vip-modal-content {
    max-width: 350px;
  }
  
  .vip-modal-header {
    padding: 14px 16px;
  }
  
  .vip-modal-body {
    padding: 16px;
  }
  
  .vip-item {
    padding: 10px 14px;
  }
}

.toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: 8px;
  background: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 10001;
  animation: toastSlideIn 0.3s ease-out;
  min-width: 200px;
}

.toast.success {
  border-left: 4px solid #4caf50;
}

.toast.error {
  border-left: 4px solid #f44336;
}

.toast i {
  font-size: 18px;
}

.toast.success i {
  color: #4caf50;
}

.toast.error i {
  color: #f44336;
}

.toast span {
  font-size: 14px;
  color: #333;
}

@keyframes toastSlideIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
</style>
