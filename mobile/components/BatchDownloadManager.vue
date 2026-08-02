<template>
    <div class="batch-download-manager">
        <QualityModal
            :show="showQualityModal"
            :song="firstSong"
            :qualities="qualities"
            :cover="getFirstSongCover()"
            :title="modalTitle"
            :description="modalDescription"
            :show-header="true"
            :show-cover="true"
            :show-close-button="true"
            :size="'medium'"
            :disabled-items="[]"
            :selected-item="null"
            @close="handleQualityClose"
            @select="handleQualitySelect"
        />

        <div v-if="isDownloading" class="download-progress">
            <div class="progress-header">
                <h3>批量下载中...</h3>
                <span class="progress-text">{{ currentIndex + 1 }}/{{ songs.length }}</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
            </div>
            <div class="current-song">
                <i class="fas fa-music"></i>
                <span>{{ currentSongName }}</span>
            </div>
            <button class="stop-btn" @click="stopDownload">
                <i class="fas fa-stop-circle"></i> 停止下载
            </button>
        </div>

        <div v-if="showResultModal" class="result-modal-overlay" @click="showResultModal = false">
            <div class="result-modal" @click.stop>
                <div class="result-modal-header">
                    <h3>{{ isCancelled ? '下载已取消' : '下载完成' }}</h3>
                    <button class="close-btn" @click="showResultModal = false">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="result-modal-body">
                    <div class="result-summary">
                        <span class="success-count">
                            <i class="fas fa-check-circle"></i> 成功: {{ downloadResults.success.length }}
                        </span>
                        <span class="failed-count" v-if="downloadResults.failed.length > 0">
                            <i class="fas fa-times-circle"></i> 失败: {{ downloadResults.failed.length }}
                        </span>
                    </div>
                    
                    <div v-if="downloadResults.success.length > 0" class="result-section">
                        <h4><i class="fas fa-check"></i> 下载成功</h4>
                        <ul class="result-list success-list">
                            <li v-for="(item, index) in downloadResults.success" :key="'success-' + index">
                                <span class="song-name">{{ item.name }}</span>
                            </li>
                        </ul>
                    </div>
                    
                    <div v-if="downloadResults.failed.length > 0" class="result-section">
                        <h4><i class="fas fa-times"></i> 下载失败</h4>
                        <ul class="result-list failed-list">
                            <li v-for="(item, index) in downloadResults.failed" :key="'failed-' + index">
                                <span class="song-name">{{ item.name }}</span>
                                <span class="error-msg">{{ item.error }}</span>
                            </li>
                        </ul>
                    </div>
                </div>
                <div class="result-modal-footer">
                    <button class="confirm-btn" @click="showResultModal = false">确定</button>
                </div>
            </div>
        </div>

        <slot name="trigger" :start-download="openQualityModal">
            <button 
                v-if="showTriggerButton" 
                class="download-trigger-btn"
                :disabled="isDownloading"
                @click="openQualityModal"
            >
                <i v-if="isDownloading" class="fas fa-spinner fa-spin"></i>
                <i v-else :class="triggerIcon"></i>
                <span>{{ triggerText }}</span>
            </button>
        </slot>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { get } from '../utils/request';
import { MoeAuthStore } from '../stores/store';
import QualityModal from './QualityModal.vue';
import { downloadWithMetadata } from '../utils/metadata';
import { 
    QUALITY_OPTIONS, 
    QUALITY_FALLBACK_ORDER, 
    getFileExtension,
    getQualityDescription
} from '../utils/qualityConfig';

const MoeAuth = MoeAuthStore();

const props = defineProps({
    songs: {
        type: Array,
        required: true,
        default: () => []
    },
    showTriggerButton: {
        type: Boolean,
        default: false
    },
    triggerText: {
        type: String,
        default: '批量下载'
    },
    triggerIcon: {
        type: String,
        default: 'fas fa-download'
    },
    autoStart: {
        type: Boolean,
        default: false
    },
    // 下载等待延时配置（秒）
    downloadDelayMin: {
        type: Number,
        default: 1
    },
    downloadDelayMax: {
        type: Number,
        default: 3
    }
});

const emit = defineEmits([
    'download-start',
    'download-complete',
    'download-progress',
    'download-fail',
    'song-download-success',
    'song-download-fail',
    'download-waiting',
    'download-cancelled'
]);

const showQualityModal = ref(false);
const isDownloading = ref(false);
const currentIndex = ref(0);
const currentSongName = ref('');
const selectedQuality = ref(null);
const showResultModal = ref(false);
const isCancelled = ref(false);
const downloadResults = ref({
    success: [],
    failed: []
});

const qualities = ref([...QUALITY_OPTIONS]);

const modalTitle = computed(() => '批量下载 - 选择音质');
const modalDescription = computed(() => `共 ${props.songs.length} 首歌曲`);

const firstSong = computed(() => props.songs.length > 0 ? props.songs[0] : null);

const progressPercentage = computed(() => {
    if (props.songs.length === 0) return 0;
    return ((currentIndex.value + 1) / props.songs.length) * 100;
});

const stopDownload = () => {
    if (!isDownloading.value) return;
    isDownloading.value = false;
    isCancelled.value = true;
    emit('download-cancelled');
};

const getFirstSongCover = () => {
    if (props.songs.length === 0) return null;
    const song = props.songs[0];
    return song.cover || song.img || song.sizable_cover || song.album_info?.sizable_cover;
};

const openQualityModal = async () => {
    if (props.songs.length === 0) return;
    if (isDownloading.value) {
        console.warn('已有下载任务在进行中，无法打开音质选择');
        return;
    }
    
    if (MoeAuth.isAuthenticated) {
        await MoeAuth.autoClaimVip()
    }
    
    showQualityModal.value = true;
};

const handleQualityClose = () => {
    showQualityModal.value = false;
};

defineExpose({
    openQualityModal
});

const handleQualitySelect = async (quality) => {
    showQualityModal.value = false;
    
    if (isDownloading.value) {
        console.warn('已有下载任务在进行中，跳过重复请求');
        return;
    }
    
    selectedQuality.value = quality;
    
    if (props.songs.length === 0) return;
    
    isDownloading.value = true;
    isCancelled.value = false;
    currentIndex.value = 0;
    
    downloadResults.value = {
        success: [],
        failed: []
    };
    
    emit('download-start', props.songs, quality);
    
    for (let i = 0; i < props.songs.length; i++) {
        if (!isDownloading.value) {
            console.log('下载任务已被中断');
            break;
        }
        
        currentIndex.value = i;
        const song = props.songs[i];
        currentSongName.value = song.name || song.originalData?.name || '未知歌曲';
        
        try {
            await downloadSong(song, quality);
            downloadResults.value.success.push({
                name: currentSongName.value,
                song: song
            });
            emit('song-download-success', song, i + 1);
        } catch (error) {
            console.error(`下载失败: ${currentSongName.value}`, error);
            downloadResults.value.failed.push({
                name: currentSongName.value,
                song: song,
                error: error.message || '未知错误'
            });
            emit('song-download-fail', song, i + 1, error);
        }
        
        emit('download-progress', {
            currentIndex: i + 1,
            total: props.songs.length,
            song: song,
            quality: quality
        });
        
        // 如果不是最后一首歌，添加随机延时（防风控）
        if (i < props.songs.length - 1) {
            // 确保延时值在合理范围内
            const rawMin = Math.max(0, Math.min(10, props.downloadDelayMin));
            const rawMax = Math.max(rawMin, Math.min(10, props.downloadDelayMax));
            
            // 生成随机延时（秒）
            const delaySec = Math.floor(Math.random() * (rawMax - rawMin + 1)) + rawMin;
            
            emit('download-waiting', delaySec, i + 1, props.songs.length);
            await new Promise(resolve => setTimeout(resolve, delaySec * 1000));
        }
    }
    
    isDownloading.value = false;
    currentSongName.value = '';
    
    if (downloadResults.value.success.length > 0 || downloadResults.value.failed.length > 0) {
        showResultModal.value = true;
    }
    
    // 传递详细的下载结果
    emit('download-complete', {
        songs: props.songs,
        quality: quality,
        successList: downloadResults.value.success,
        failedList: downloadResults.value.failed,
        totalCount: props.songs.length,
        successCount: downloadResults.value.success.length,
        failedCount: downloadResults.value.failed.length,
        cancelled: isCancelled.value
    });
};

const downloadSong = async (song, quality) => {
    const hash = song.hash || song.originalData?.hash;
    if (!hash) {
        throw new Error('歌曲 hash 不存在');
    }
    
    const qualityFallbackOrder = [...QUALITY_FALLBACK_ORDER];
    let currentQualityIndex = qualityFallbackOrder.indexOf(quality.quality);
    if (currentQualityIndex === -1) {
        currentQualityIndex = qualityFallbackOrder.indexOf('320');
        if (currentQualityIndex === -1) currentQualityIndex = 2;
    }
    
    let lastError = null;
    
    while (currentQualityIndex < qualityFallbackOrder.length) {
        const currentQuality = qualityFallbackOrder[currentQualityIndex];
        
        try {
            const data = { hash: hash };
            
            if (!MoeAuth.isAuthenticated) {
                data.free_part = 1;
            }
            
            if (currentQuality !== '128') {
                data.quality = currentQuality;
            }
            
            console.log('[BatchDownload] 请求下载URL:', { quality: currentQuality, hash: hash });
            const response = await get('/song/url', data);
            
            if (response.status !== 1 || !response.url || !response.url[0]) {
                throw new Error(`获取 ${getQualityDescription(currentQuality)} 下载链接失败`);
            }
            
            const downloadUrl = response.url[0];
            const fileExt = getFileExtension(currentQuality, downloadUrl);
            
            console.log('[BatchDownload] 下载URL:', downloadUrl, '检测格式:', fileExt);
            
            const coverUrl = song.cover || song.img || song.sizable_cover || song.album_info?.sizable_cover;
            
            const result = await downloadWithMetadata(song, downloadUrl, { 
                coverUrl,
                hash: hash,
                quality: currentQuality,
                forceExt: fileExt
            });
            
            if (!result.success || !result.outputBlob) {
                throw new Error(result.message || '下载失败');
            }
            
            const url = window.URL.createObjectURL(result.outputBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = result.fileName;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            return;
            
        } catch (error) {
            lastError = error;
            console.warn(`[BatchDownload] 歌曲 ${song.name} 尝试 ${getQualityDescription(currentQuality)} 失败:`, error.message);
            currentQualityIndex++;
        }
    }
    
    throw lastError || new Error('所有音质尝试均失败');
};

onMounted(() => {
    if (props.autoStart && props.songs.length > 0) {
        openQualityModal();
    }
})
</script>

<style scoped>
.batch-download-manager {
    position: relative;
}

.download-trigger-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.3s ease;
}

.download-trigger-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.download-trigger-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.download-progress {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    min-width: 320px;
    z-index: 10000;
}

.progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}

.progress-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #333;
}

.progress-text {
    font-size: 14px;
    color: #667eea;
    font-weight: 500;
}

.progress-bar {
    width: 100%;
    height: 8px;
    background: #f0f0f0;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 16px;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
    border-radius: 4px;
    transition: width 0.3s ease;
}

.current-song {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    background: #f8f9fa;
    border-radius: 8px;
}

.current-song i {
    font-size: 16px;
    color: #667eea;
}

.current-song span {
    font-size: 14px;
    color: #555;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.stop-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    margin-top: 16px;
    padding: 10px;
    background: #fff1f0;
    color: #ff4d4f;
    border: 1px solid #ffccc7;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
}

.stop-btn:hover {
    background: #ff4d4f;
    color: white;
    border-color: #ff4d4f;
}

.stop-btn i {
    font-size: 16px;
}

.result-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
}

.result-modal {
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    max-width: 480px;
    width: 90%;
    max-height: 70vh;
    display: flex;
    flex-direction: column;
}

.result-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #eee;
}

.result-modal-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #333;
}

.close-btn {
    background: none;
    border: none;
    font-size: 18px;
    color: #999;
    cursor: pointer;
    padding: 4px;
    transition: color 0.2s;
}

.close-btn:hover {
    color: #333;
}

.result-modal-body {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
}

.result-summary {
    display: flex;
    gap: 20px;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid #eee;
}

.success-count {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 16px;
    font-weight: 500;
    color: #52c41a;
}

.failed-count {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 16px;
    font-weight: 500;
    color: #ff4d4f;
}

.result-section {
    margin-bottom: 16px;
}

.result-section h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
}

.result-section:nth-child(2) h4 {
    color: #52c41a;
}

.result-section:nth-child(3) h4 {
    color: #ff4d4f;
}

.result-list {
    list-style: none;
    padding: 0;
    margin: 0;
    max-height: 150px;
    overflow-y: auto;
}

.result-list li {
    display: flex;
    flex-direction: column;
    padding: 8px 12px;
    border-radius: 6px;
    margin-bottom: 4px;
}

.success-list li {
    background: #f6ffed;
}

.failed-list li {
    background: #fff2f0;
}

.song-name {
    font-size: 14px;
    color: #333;
}

.error-msg {
    font-size: 12px;
    color: #999;
    margin-top: 4px;
}

.result-modal-footer {
    padding: 16px 20px;
    border-top: 1px solid #eee;
    display: flex;
    justify-content: flex-end;
}

.confirm-btn {
    padding: 8px 24px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
}

.confirm-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}
</style>
