<template>
  <div class="login-container">
    <div class="login-box">
      <div class="logo-section">
        <i class="fas fa-music"></i>
        <h1>KuGou 概念版</h1>
        <p>登陆后，请领取VIP</p>
      </div>

      <div class="login-tabs">
        <button 
          :class="{ active: loginType === 'phone' }" 
          @click="loginType = 'phone'"
        >
          <i class="fas fa-mobile-alt"></i>
          手机登录
        </button>
        <button 
          :class="{ active: loginType === 'qr' }" 
          @click="loginType = 'qr'"
        >
          <i class="fas fa-qrcode"></i>
          扫码登录
        </button>
      </div>

      <div class="login-content">
        <div v-if="showAccountSelection" class="account-selection">
          <p class="selection-tip">该手机绑定多个账号，请选择要登录的账号</p>
          <div class="account-list">
            <div 
              v-for="account in accountList" 
              :key="account.userid"
              class="account-item"
              @click="selectAccount(account)"
            >
              <div class="account-avatar">
                <img :src="account.pic || '/assets/images/profile.jpg'" :alt="account.nickname" />
              </div>
              <div class="account-info">
                <div class="account-name">{{ account.nickname || '未命名用户' }}</div>
                <div class="account-status">
                  <span v-if="account.p_grade" class="svip-badge">Lv {{ account.p_grade }}</span>
                  <span class="user-level">UID：{{ account.userid }}</span>
                </div>
              </div>
              <div class="select-arrow">→</div>
            </div>
          </div>
          <button 
            type="button" 
            class="back-button" 
            @click="backToLogin"
          >
            返回登录
          </button>
        </div>

        <div v-else-if="loginType === 'phone'" class="phone-login">
          <div class="input-group" :class="{ 'has-error': phoneFormErrors.mobile }">
            <i class="fas fa-phone"></i>
            <input 
              v-model="phoneForm.mobile" 
              type="tel" 
              placeholder="请输入手机号"
              maxlength="11"
              @blur="validateField('mobile', phoneForm.mobile)"
            />
            <button 
              v-if="phoneForm.mobile" 
              class="clear-button" 
              @click="phoneForm.mobile = ''"
            >
              ×
            </button>
          </div>
          <div v-if="phoneFormErrors.mobile" class="error-text">
            {{ phoneFormErrors.mobile }}
          </div>
          
          <div class="input-group" :class="{ 'has-error': phoneFormErrors.code }">
            <i class="fas fa-shield-alt"></i>
            <input 
              v-model="phoneForm.code" 
              type="text" 
              placeholder="请输入验证码"
              maxlength="6"
              class="verification-input"
              @blur="validateField('code', phoneForm.code)"
            />
            <div class="spacer"></div>
            <button 
              v-if="phoneForm.code" 
              class="clear-button" 
              @click="phoneForm.code = ''"
            >
              ×
            </button>
            <button 
              class="send-code-btn" 
              :disabled="countdown > 0 || !phoneForm.mobile || isSendingCaptcha"
              @click="sendCode"
            >
              <span v-if="isSendingCaptcha" class="loading-spinner"></span>
              {{ countdown > 0 ? `${countdown}秒` : '发送验证码' }}
            </button>
          </div>
          <div v-if="phoneFormErrors.code" class="error-text">
            {{ phoneFormErrors.code }}
          </div>

          <button 
            class="login-btn" 
            :disabled="!phoneForm.mobile || !phoneForm.code || loading"
            @click="phoneLogin"
          >
            <span v-if="loading" class="loading-spinner"></span>
            {{ loading ? '登录中...' : '登录' }}
          </button>
        </div>

        <div v-else-if="loginType === 'qr'" class="qr-login">
          <div class="qr-container">
            <div v-if="qrCodeUrl" class="qr-code">
              <img :src="qrCodeUrl" alt="扫码登录" />
              <div v-if="qrStatus === 'expired'" class="qr-expired">
                <p>二维码已过期</p>
                <button @click="generateQRCode">刷新</button>
              </div>
              <div v-else-if="qrStatus === 'scanned'" class="qr-scanned">
                <p>已扫描，请在手机上确认</p>
              </div>
              <div v-else-if="qrStatus === 'confirmed'" class="qr-confirmed">
                <p>登录成功</p>
              </div>
            </div>
            <div v-else class="qr-loading">
              <div class="loading-spinner"></div>
              <p>生成二维码中...</p>
            </div>
          </div>
          <p class="qr-tip">请使用酷狗音乐APP扫码登录</p>
        </div>
      </div>
    </div>

    <div v-if="message" class="toast" :class="message.type">
      <i :class="message.type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle'"></i>
      {{ message.text }}
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { get } from '../utils/request'
import { MoeAuthStore } from '../stores/store'

const router = useRouter()
const route = useRoute()
const MoeAuth = MoeAuthStore()

const loginType = ref('phone')
const loading = ref(false)
const showAccountSelection = ref(false)
const accountList = ref([])
const message = ref(null)
const countdown = ref(0)
const isSendingCaptcha = ref(false)
const qrCodeUrl = ref('')
const qrStatus = ref('waiting')
const qrKey = ref('')
const qrCheckInterval = ref(null)

const phoneForm = reactive({
  mobile: '',
  code: ''
})

const phoneFormErrors = reactive({
  mobile: '',
  code: ''
})

const showMessage = (text, type = 'success') => {
  message.value = { text, type }
  setTimeout(() => {
    message.value = null
  }, 3000)
}

const validateField = (field, value) => {
  if (field === 'mobile') {
    if (!value) {
      phoneFormErrors.mobile = '请输入手机号'
    } else if (!/^1[3-9]\d{9}$/.test(value)) {
      phoneFormErrors.mobile = '请输入正确的手机号'
    } else {
      phoneFormErrors.mobile = ''
    }
  } else if (field === 'code') {
    if (!value) {
      phoneFormErrors.code = '请输入验证码'
    } else if (value.length !== 6) {
      phoneFormErrors.code = '请输入6位验证码'
    } else {
      phoneFormErrors.code = ''
    }
  }
}

const sendCode = async () => {
  validateField('mobile', phoneForm.mobile)
  if (phoneFormErrors.mobile) return

  try {
    isSendingCaptcha.value = true
    const response = await get(`/captcha/sent?mobile=${phoneForm.mobile}`)
    
    if (response.status === 1) {
      showMessage('验证码已发送')
      countdown.value = 60
      const timer = setInterval(() => {
        countdown.value--
        if (countdown.value <= 0) {
          clearInterval(timer)
        }
      }, 1000)
    } else {
      showMessage(response.data || '发送失败', 'error')
    }
  } catch (error) {
    showMessage('发送失败，请稍后重试', 'error')
  } finally {
    isSendingCaptcha.value = false
  }
}

const checkAndClaimVip = async () => {
  try {
    const todayKey = new Date().toISOString().split('T')[0]
    const lastClaimDate = localStorage.getItem('lastVipClaimDate')
    
    console.log('[VIP检查] 开始检查VIP状态...')
    console.log('[VIP检查] 今天日期:', todayKey)
    console.log('[VIP检查] 上次领取日期:', lastClaimDate)
    
    // 获取当前用户ID
    const currentUserId = MoeAuth.UserInfo?.userid
    console.log('[VIP检查] 当前用户ID:', currentUserId)
    
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
          console.log('[VIP检查] 缓存的基础VIP仍然有效，过期时间:', expireTime)
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
          console.log('[VIP检查] 缓存的商业VIP仍然有效')
        }
      }
      
      if (isVipValid) {
        console.log('[VIP检查] 使用缓存的VIP信息（VIP未过期且属于当前用户）...')
        vipInfoData = parsedVipInfo
      } else {
        console.log('[VIP检查] 缓存的VIP已过期或用户不是VIP，开始获取VIP信息...')
        needRefreshVipInfo = true
      }
    } else {
      if (cachedVipInfo && cachedUserId !== currentUserId) {
        console.log('[VIP检查] 缓存的VIP信息属于其他用户，开始获取VIP信息...')
      } else {
        console.log('[VIP检查] 缓存不存在，开始获取VIP信息...')
      }
      needRefreshVipInfo = true
    }
    
    // 只有在需要刷新时才请求接口
    if (needRefreshVipInfo) {
      const VipInfoResponse = await get('/youth/union/vip')
      console.log('[VIP检查] 获取VIP信息响应:', VipInfoResponse)
      
      if (VipInfoResponse.status === 1) {
        vipInfoData = VipInfoResponse.data
        // 更新缓存，同时存储用户ID
        localStorage.setItem('cachedVipInfo', JSON.stringify(vipInfoData))
        localStorage.setItem('cachedVipUserId', currentUserId)
        console.log('[VIP检查] VIP信息已缓存，用户ID:', currentUserId)
      } else {
        console.log('[VIP检查] 获取VIP信息失败:', VipInfoResponse.data)
        return
      }
    }
    
    // 更新VIP信息到存储中（只有在缓存过期或不存在时才更新）
    if (needRefreshVipInfo) {
      const currentConfig = MoeAuth.Config || []
      const vipIndex = currentConfig.findIndex(item => item.key === 'vip')
      
      if (vipIndex >= 0) {
        currentConfig[vipIndex].value = vipInfoData
      } else {
        currentConfig.push({ key: 'vip', value: vipInfoData })
      }
      
      await MoeAuth.setData({ Config: currentConfig })
      console.log('[VIP检查] VIP信息已更新到存储')
    }
    
    // 检查用户VIP状态
    let isVip = false
    
    console.log('[VIP检查] 检查用户VIP状态...')
    if (vipInfoData.is_vip === 1) {
      const expireTime = vipInfoData.vip_end_time || vipInfoData.end_time
      console.log('[VIP检查] 用户VIP状态:', vipInfoData.is_vip)
      console.log('[VIP检查] VIP过期时间:', expireTime)
      if (expireTime && new Date(expireTime) > new Date()) {
        isVip = true
        console.log('[VIP检查] 用户VIP未过期')
      } else {
        console.log('[VIP检查] 用户VIP已过期')
      }
    } else {
      console.log('[VIP检查] 用户不是基础VIP')
    }
    
    if (vipInfoData.busi_vip && Array.isArray(vipInfoData.busi_vip)) {
      console.log('[VIP检查] 检查商业VIP状态...')
      console.log('[VIP检查] 商业VIP数量:', vipInfoData.busi_vip.length)
      const hasValidVip = vipInfoData.busi_vip.some(vip => {
        if (!vip) return false
        const expireTime = vip.vip_end_time || vip.end_time
        console.log('[VIP检查] 商业VIP过期时间:', expireTime)
        return expireTime && new Date(expireTime) > new Date()
      })
      if (hasValidVip) {
        isVip = true
        console.log('[VIP检查] 用户有有效的商业VIP')
      } else {
        console.log('[VIP检查] 用户商业VIP已过期或不存在')
      }
    } else {
      console.log('[VIP检查] 用户没有商业VIP')
    }
    
    console.log('[VIP检查] 最终VIP状态:', isVip)
    
    if (isVip) {
      console.log('[VIP检查] 用户已经是VIP，无需领取')
      // 只有在用户确实是VIP的情况下才更新领取记录
      localStorage.setItem('lastVipClaimDate', todayKey)
      console.log('[VIP检查] 已更新领取记录')
    } else {
      // 只有当今天还没有领取过VIP时才尝试领取
      if (lastClaimDate !== todayKey) {
        console.log('[VIP检查] 用户不是VIP，开始领取1天VIP...')
        const dayVipResponse = await get('/youth/day/vip', { receive_day: todayKey })
        console.log('[VIP领取] 领取1天VIP响应:', dayVipResponse)
        
        if (dayVipResponse.status === 1) {
          console.log('[VIP领取] 1天VIP领取成功')
          
          await new Promise(resolve => setTimeout(resolve, 500))
          
          console.log('[VIP升级] 开始升级为概念版VIP...')
          const upgradeResponse = await get('/youth/day/vip/upgrade')
          console.log('[VIP升级] 升级概念版VIP响应:', upgradeResponse)
          
          if (upgradeResponse.status === 1) {
            console.log('[VIP升级] 概念版VIP升级成功')
          } else {
            console.log('[VIP升级] 概念版VIP升级失败:', upgradeResponse.data)
          }
          
          // 领取VIP成功后，重新获取VIP信息并更新到存储中
          console.log('[VIP检查] 重新获取VIP信息...')
          const updatedVipInfoResponse = await get('/youth/union/vip')
          console.log('[VIP检查] 重新获取VIP信息响应:', updatedVipInfoResponse)
          
          if (updatedVipInfoResponse.status === 1) {
            // 直接创建一个新的配置数组，只包含VIP信息
            const newConfig = [{ key: 'vip', value: updatedVipInfoResponse.data }]
            
            // 确保VIP信息被正确保存
            await MoeAuth.setData({ Config: newConfig })
            console.log('[VIP检查] VIP信息已更新到存储')
            
            // 更新缓存，同时存储用户ID
            localStorage.setItem('cachedVipInfo', JSON.stringify(updatedVipInfoResponse.data))
            localStorage.setItem('cachedVipUserId', currentUserId)
            console.log('[VIP检查] VIP信息缓存已更新，用户ID:', currentUserId)
            
            // 再次确认VIP状态
            console.log('[VIP检查] 再次确认VIP状态...')
            console.log('[VIP检查] 更新后的VIP信息:', updatedVipInfoResponse.data)
            
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
              console.log('[VIP检查] 领取后用户确实成为了VIP')
              localStorage.setItem('lastVipClaimDate', todayKey)
              console.log('[VIP检查] 已更新领取记录')
            } else {
              console.log('[VIP检查] 领取后用户仍然不是VIP，不更新领取记录')
            }
          }
        } else {
          console.log('[VIP领取] 1天VIP领取失败:', dayVipResponse.data)
          localStorage.setItem('lastVipClaimDate', todayKey)
        }
      } else {
        console.log('[VIP检查] 今天已经尝试领取过VIP，跳过领取')
      }
    }
  } catch (error) {
    console.error('[VIP检查] VIP检查失败:', error)
    localStorage.setItem('lastVipClaimDate', todayKey)
  }
}

const phoneLogin = async () => {
  validateField('mobile', phoneForm.mobile)
  validateField('code', phoneForm.code)
  
  if (phoneFormErrors.mobile || phoneFormErrors.code) return

  try {
    loading.value = true
    let url = `/login/cellphone?mobile=${phoneForm.mobile}&code=${phoneForm.code}`
    const response = await get(url)

    if (response.status === 1) {
      const data = response.data
      
      if (data?.info_list && data.info_list.length > 1) {
        accountList.value = data.info_list
        showAccountSelection.value = true
      } else {
        const userInfo = data?.info_list?.[0] || data
        await MoeAuth.setData({ UserInfo: userInfo })
        showMessage('登录成功')
        
        await checkAndClaimVip()
        
        // 延迟一小段时间，确保VIP信息已经更新到存储中
        await new Promise(resolve => setTimeout(resolve, 500))
        
        const redirect = route.query.redirect || '/profile'
        router.push(redirect)
      }
    } else {
      // 处理登录失败的情况
      if (response.error_code === 34182 || response.data === '该账号不存在') {
        showMessage('登录失败，请先用酷狗音乐注册', 'error')
      } else {
        showMessage(response.data || '登录失败', 'error')
      }
    }
  } catch (error) {
    if (error.response?.data?.data?.info_list) {
      accountList.value = error.response.data.data.info_list
      showAccountSelection.value = true
    } else {
      // 处理捕获到的错误
      if (error.response?.data?.error_code === 34182 || error.response?.data?.data === '该账号不存在') {
        showMessage('登录失败，请先用酷狗音乐注册', 'error')
      } else {
        showMessage('登录失败，请稍后重试', 'error')
      }
    }
  } finally {
    loading.value = false
  }
}

const generateQRCode = async () => {
  try {
    qrStatus.value = 'waiting'
    qrCodeUrl.value = ''
    
    const keyResponse = await get('/login/qr/key')
    if (keyResponse.status === 1) {
      qrKey.value = keyResponse.data.qrcode
      
      const qrResponse = await get(`/login/qr/create?key=${qrKey.value}&qrimg=true`)
      
      if (qrResponse.code === 200) {
        qrCodeUrl.value = qrResponse.data.base64
        startQRCheck()
      } else {
        showMessage('生成二维码失败', 'error')
      }
    } else {
      showMessage('获取二维码key失败', 'error')
    }
  } catch (error) {
    console.error('生成二维码失败:', error)
    showMessage('生成二维码失败', 'error')
  }
}

const startQRCheck = () => {
  if (qrCheckInterval.value) {
    clearInterval(qrCheckInterval.value)
  }

  qrCheckInterval.value = setInterval(async () => {
    try {
      const response = await get(`/login/qr/check?key=${qrKey.value}&timestamp=${Date.now()}`, {}, {
        headers: {
          'Cache-Control': 'no-cache'
        }
      })

      if (response.status === 1) {
        if (response.data.status === 2) {
          qrStatus.value = 'scanned'
        } else if (response.data.status === 4) {
          qrStatus.value = 'confirmed'
          clearInterval(qrCheckInterval.value)
          
          const userInfo = response.data
          await MoeAuth.setData({ UserInfo: userInfo })
          showMessage('登录成功')
          
          await checkAndClaimVip()
          
          // 延迟一小段时间，确保VIP信息已经更新到存储中
          await new Promise(resolve => setTimeout(resolve, 500))
          
          const redirect = route.query.redirect || '/profile'
          router.push(redirect)
        } else if (response.data.status === 0) {
          qrStatus.value = 'expired'
          clearInterval(qrCheckInterval.value)
          showMessage('二维码已过期，请重新扫码', 'error')
        }
      }
    } catch (error) {
      console.error('QR check error:', error)
    }
  }, 1000)
}

const selectAccount = async (account) => {
  loading.value = true
  await phoneLogin(account.userid)
}

const backToLogin = () => {
  showAccountSelection.value = false
  accountList.value = []
}

onMounted(() => {
  if (MoeAuth.isAuthenticated) {
    const redirect = route.query.redirect || '/profile'
    router.push(redirect)
  }
})

watch(loginType, (newType) => {
  if (newType === 'qr') {
    generateQRCode()
  }
})

onUnmounted(() => {
  if (qrCheckInterval.value) {
    clearInterval(qrCheckInterval.value)
  }
})
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-box {
  width: 100%;
  max-width: 400px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  padding: 40px 30px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.logo-section {
  text-align: center;
  margin-bottom: 30px;
}

.logo-section i {
  font-size: 48px;
  color: #667eea;
  margin-bottom: 10px;
}

.logo-section h1 {
  font-size: 28px;
  color: #333;
  margin-bottom: 8px;
}

.logo-section p {
  color: #999;
  font-size: 14px;
}

.login-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 30px;
}

.login-tabs button {
  flex: 1;
  padding: 12px;
  border: 2px solid #e0e0e0;
  background: white;
  border-radius: 10px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.login-tabs button:hover {
  border-color: #667eea;
  color: #667eea;
}

.login-tabs button.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: transparent;
  color: white;
}

.login-content {
  margin-bottom: 20px;
}

.input-group {
  position: relative;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  background: #f5f5f5;
  border-radius: 10px;
  padding: 12px 15px;
  transition: all 0.3s;
}

.input-group:focus-within {
  background: white;
  box-shadow: 0 0 0 2px #667eea;
}

.input-group i {
  color: #999;
  font-size: 18px;
  margin-right: 10px;
}

.input-group input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 15px;
  color: #333;
  outline: none;
}

.input-group input.verification-input {
  max-width: 6em;
}

.input-group .spacer {
  flex: 1;
}

.input-group input::placeholder {
  color: #999;
}

.clear-button {
  background: none;
  border: none;
  color: #999;
  font-size: 20px;
  cursor: pointer;
  padding: 0 5px;
  transition: color 0.3s;
}

.clear-button:hover {
  color: #667eea;
}

.send-code-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: white;
  padding: 8px 15px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.3s;
}

.send-code-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.send-code-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-btn {
  width: 100%;
  padding: 15px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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

.login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}

.login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-text {
  color: #ff4757;
  font-size: 12px;
  margin-top: -15px;
  margin-bottom: 15px;
  padding-left: 5px;
}

.input-group.has-error {
  box-shadow: 0 0 0 2px #ff4757;
}

.qr-container {
  text-align: center;
  padding: 20px;
}

.qr-code {
  position: relative;
  display: inline-block;
}

.qr-code img {
  width: 200px;
  height: 200px;
  border-radius: 10px;
}

.qr-expired,
.qr-scanned,
.qr-confirmed {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
}

.qr-expired p,
.qr-scanned p,
.qr-confirmed p {
  margin-bottom: 10px;
  color: #333;
}

.qr-expired button {
  padding: 8px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
}

.qr-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.qr-loading p {
  color: #999;
}

.qr-tip {
  text-align: center;
  color: #999;
  font-size: 14px;
  margin-top: 15px;
}

.account-selection {
  text-align: center;
}

.selection-tip {
  color: #666;
  font-size: 14px;
  margin-bottom: 20px;
}

.account-list {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 20px;
}

.account-item {
  display: flex;
  align-items: center;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 10px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.3s;
}

.account-item:hover {
  background: #e8e8e8;
  transform: translateX(5px);
}

.account-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  overflow: hidden;
  margin-right: 15px;
}

.account-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.account-info {
  flex: 1;
  text-align: left;
}

.account-name {
  font-weight: 600;
  color: #333;
  margin-bottom: 5px;
}

.account-status {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}

.svip-badge {
  background: linear-gradient(135deg, #ffd700 0%, #ffaa00 100%);
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}

.user-level {
  color: #999;
}

.select-arrow {
  font-size: 20px;
  color: #667eea;
}

.back-button {
  width: 100%;
  padding: 12px;
  background: #f5f5f5;
  border: none;
  border-radius: 10px;
  color: #666;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.3s;
}

.back-button:hover {
  background: #e8e8e8;
}

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

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
