<template>
    <div class="download-page">
        <div class="page-header">
            <h1>批量下载</h1>
            <p>输入歌手ID，查询并下载该歌手的所有歌曲</p>
        </div>

        <!-- 第一步：查询歌手 -->
        <div class="config-section">
            <div class="input-group">
                <label>歌手ID</label>
                <div class="input-with-button">
                    <input 
                        v-model="artistId" 
                        type="text" 
                        placeholder="请输入歌手ID（例如：3520）"
                        class="input-field"
                        @keyup.enter="queryArtist"
                    />
                    <button 
                        @click="queryArtist" 
                        :disabled="querying || !artistId"
                        class="btn btn-query"
                    >
                        <i class="fas fa-search"></i>
                        {{ querying ? '查询中...' : '查询歌手' }}
                    </button>
                </div>
            </div>

            <!-- 查询进度 -->
            <div v-if="querying" class="query-progress">
                <div class="progress-bar">
                    <div class="progress-fill" :style="{ width: `${queryProgress}%` }"></div>
                </div>
                <p class="progress-text">{{ queryStatus }}</p>
            </div>
        </div>

        <!-- 第二步：歌曲列表（分页表格） -->
        <div v-if="allSongs.length > 0" class="songs-section">
            <div class="section-header">
                <h2>歌曲列表 (共 {{ allSongs.length }} 首)</h2>
                <div class="selection-actions">
                    <button @click="selectAll" class="btn-small">
                        <i class="fas fa-check-square"></i> 全选
                    </button>
                    <button @click="deselectAll" class="btn-small">
                        <i class="fas fa-square"></i> 全不选
                    </button>
                    <button @click="invertSelection" class="btn-small">
                        <i class="fas fa-exchange-alt"></i> 反选
                    </button>
                    <span class="selected-count">已选 {{ selectedSongs.size }} 首</span>
                </div>
            </div>

            <!-- 分页表格 -->
            <div class="table-container">
                <table class="songs-table">
                    <thead>
                        <tr>
                            <th class="col-checkbox">
                                <input 
                                    type="checkbox" 
                                    :checked="isCurrentPageAllSelected" 
                                    @change="toggleCurrentPageSelect"
                                />
                            </th>
                            <th class="col-index">#</th>
                            <th class="col-name">歌曲名</th>
                            <th class="col-album">专辑名</th>
                            <th class="col-duration">时长</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr 
                            v-for="(song, index) in paginatedSongs" 
                            :key="song.hash"
                            :class="{ selected: selectedSongs.has(song.hash) }"
                            @click="toggleSongSelection(song.hash)"
                        >
                            <td class="col-checkbox" @click.stop>
                                <input 
                                    type="checkbox" 
                                    :checked="selectedSongs.has(song.hash)"
                                    @change="toggleSongSelection(song.hash)"
                                />
                            </td>
                            <td class="col-index">{{ (currentPage - 1) * pageSize + index + 1 }}</td>
                            <td class="col-name">
                                <div class="song-name-cell">
                                    <i class="fas fa-music"></i>
                                    <span>{{ song.name }}</span>
                                </div>
                            </td>
                            <td class="col-album">{{ song.albumName }}</td>
                            <td class="col-duration">
                                <i class="fas fa-clock"></i>
                                {{ formatDuration(song.duration) }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- 分页控件 -->
            <div class="pagination">
                <button 
                    @click="currentPage = 1" 
                    :disabled="currentPage === 1"
                    class="btn-page"
                >
                    <i class="fas fa-angle-double-left"></i> 首页
                </button>
                <button 
                    @click="currentPage--" 
                    :disabled="currentPage === 1"
                    class="btn-page"
                >
                    <i class="fas fa-angle-left"></i> 上一页
                </button>
                <span class="page-info">
                    第 {{ currentPage }} / {{ totalPages }} 页
                </span>
                <button 
                    @click="currentPage++" 
                    :disabled="currentPage === totalPages"
                    class="btn-page"
                >
                    下一页 <i class="fas fa-angle-right"></i>
                </button>
                <button 
                    @click="currentPage = totalPages" 
                    :disabled="currentPage === totalPages"
                    class="btn-page"
                >
                    末页 <i class="fas fa-angle-double-right"></i>
                </button>
                <div class="page-size-selector">
                    <label>每页显示：</label>
                    <select v-model.number="pageSize" @change="currentPage = 1" class="select-page-size">
                        <option :value="20">20</option>
                        <option :value="50">50</option>
                        <option :value="100">100</option>
                        <option :value="200">200</option>
                    </select>
                </div>
            </div>
        </div>

        <!-- 第三步：下载按钮（使用 BatchDownloadManager 组件） -->
        <div v-if="allSongs.length > 0 && selectedSongs.size > 0" class="download-config-section">
            <h3><i class="fas fa-download"></i> 准备下载</h3>
            
            <div class="config-grid">
                <div class="filter-options">
                    <label class="checkbox-label">
                        <input type="checkbox" v-model="excludeConcert" />
                        <i class="fas fa-microphone-alt"></i>
                        <span>排除演唱会</span>
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" v-model="excludeLive" />
                        <i class="fas fa-broadcast-tower"></i>
                        <span>排除Live版本</span>
                    </label>
                </div>
                
                <!-- PushPlus 推送配置 -->
                <div class="pushplus-config">
                    <label class="input-label">
                        <i class="fas fa-bell"></i>
                        <span>PushPlus 推送 Token（可选）</span>
                    </label>
                    <input 
                        v-model="pushplusToken" 
                        type="text" 
                        placeholder="输入 PushPlus Token，下载完成后推送通知"
                        class="input-field pushplus-input"
                    />
                    <p class="hint">下载完成后会将日志推送到您的手机</p>
                </div>
            </div>

            <!-- 使用 BatchDownloadManager 组件 -->
            <BatchDownloadManager 
                :songs="selectedSongList"
                :show-trigger-button="true"
                trigger-text="开始下载"
                trigger-icon="fas fa-download"
                @download-start="handleDownloadStart"
                @download-complete="handleDownloadComplete"
            />
        </div>

        <!-- 日志区域 -->
        <div v-if="logs.length > 0" class="logs-section">
            <h3><i class="fas fa-terminal"></i> 下载日志</h3>
            <div class="logs-container">
                <div v-for="(log, index) in logs.slice(-50)" :key="index" class="log-item" :class="log.type">
                    <i :class="log.icon"></i>
                    <span>{{ log.message }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { get } from '../utils/request';
import BatchDownloadManager from '../components/BatchDownloadManager.vue';
import { savePushplusToken, getPushplusToken, sendPushNotification, formatLogsForPush } from '../utils/pushplus';

// 状态变量
const artistId = ref('');
const excludeConcert = ref(true);
const excludeLive = ref(true);
const querying = ref(false);
const allSongs = ref([]);
const selectedSongs = ref(new Set());
const logs = ref([]);

// PushPlus 推送配置 - 从 localStorage 加载
const pushplusToken = ref(getPushplusToken());

// 分页相关
const currentPage = ref(1);
const pageSize = ref(50);

// 查询进度
const queryProgress = ref(0);
const queryStatus = ref('');

// 监听 PushPlus Token 变化，自动保存到 localStorage
watch(pushplusToken, (newValue) => {
    savePushplusToken(newValue);
});

// 计算选中的歌曲列表
const selectedSongList = computed(() => {
    return allSongs.value.filter(song => selectedSongs.value.has(song.hash));
});

// 计算当前页的歌曲
const paginatedSongs = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value;
    const end = start + pageSize.value;
    return allSongs.value.slice(start, end);
});

// 总页数
const totalPages = computed(() => {
    return Math.ceil(allSongs.value.length / pageSize.value);
});

// 当前页是否全选
const isCurrentPageAllSelected = computed(() => {
    if (paginatedSongs.value.length === 0) return false;
    return paginatedSongs.value.every(song => selectedSongs.value.has(song.hash));
});

// 添加日志
const addLog = (message, type = 'info', icon = 'fas fa-info-circle') => {
    const timestamp = new Date().toLocaleTimeString();
    logs.value.push({
        message: `[${timestamp}] ${message}`,
        type,
        icon
    });
    console.log(message);
};

// 格式化时长
const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '0:00';
    const secs = Number(seconds);
    if (isNaN(secs)) return '0:00';
    
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
};

// 检查是否应该排除
const shouldExclude = (songName, albumName) => {
    const name = (songName || '').toLowerCase();
    const album = (albumName || '').toLowerCase();
    
    if (excludeConcert.value && (name.includes('演唱会') || album.includes('演唱会'))) {
        return true;
    }
    
    if (excludeLive.value && (name.includes('live') || album.includes('live'))) {
        return true;
    }
    
    return false;
};

// 获取歌手所有专辑
const fetchArtistAlbums = async (id) => {
    const albums = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
        try {
            if (page > 1) {
                const delay = Math.random() * 1000 + 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            const response = await get('/artist/albums', {
                id,
                page,
                pagesize: 100
            });
            
            if (response.status === 1 && response.data) {
                const albumList = Array.isArray(response.data) ? response.data : (response.data.info || []);
                albums.push(...albumList);
                
                const total = response.extra?.page_total || response.data?.total || 0;
                if (albums.length >= total || albumList.length === 0) {
                    hasMore = false;
                } else {
                    page++;
                }
            } else {
                hasMore = false;
            }
        } catch (error) {
            addLog(`获取专辑失败: ${error.message}`, 'error', 'fas fa-exclamation-circle');
            console.error('获取专辑失败:', error);
            hasMore = false;
        }
    }
    
    return albums;
};

// 获取专辑中的所有歌曲
const fetchAlbumSongs = async (albumId, albumName) => {
    const allSongs = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
        try {
            const delay = Math.random() * 2000 + 1000;
            addLog(`等待 ${(delay/1000).toFixed(1)} 秒后请求...`, 'info', 'fas fa-hourglass-half');
            await new Promise(resolve => setTimeout(resolve, delay));
            
            const response = await get('/album/songs', {
                id: albumId,
                page,
                pagesize: 50
            });
            
            if (response.status === 1) {
                const songList = response.data?.songs || [];
                
                if (songList.length > 0) {
                    const formattedSongs = songList
                        .filter(track => track.audio_info?.hash)
                        .map(track => {
                            const audioInfo = track.audio_info;
                            const base = track.base;
                            const albumInfo = track.album_info;
                            
                            let coverUrl = '';
                            if (track.trans_param?.union_cover) {
                                coverUrl = track.trans_param.union_cover.replace('{size}', '480');
                            } else if (albumInfo?.sizable_cover) {
                                coverUrl = albumInfo.sizable_cover.replace('{size}', '480');
                            } else if (base?.sizable_cover) {
                                coverUrl = base.sizable_cover.replace('{size}', '480');
                            }
                            
                            return {
                                hash: audioInfo.hash || '',
                                name: base.audio_name || track.audio_name || '未知歌曲',
                                songname: base.audio_name || '',
                                audio_name: base.audio_name || '',
                                albumId: albumId,
                                albumName: albumName || albumInfo?.album_name || '未知专辑',
                                duration: audioInfo.duration || 0,
                                timelen: audioInfo.duration || 0,
                                cover: coverUrl,
                                img: coverUrl,
                                author: base.author_name || '',
                                singer_name: base.author_name || '',
                                album: albumInfo?.album_name || ''
                            };
                        });
                    
                    allSongs.push(...formattedSongs);
                    
                    const total = response.data.total || 0;
                    if (allSongs.length >= total || songList.length === 0) {
                        hasMore = false;
                    } else {
                        page++;
                    }
                } else {
                    hasMore = false;
                }
            } else {
                addLog(`专辑 ${albumName} 返回状态异常: ${response.status}`, 'warning', 'fas fa-exclamation-triangle');
                hasMore = false;
            }
        } catch (error) {
            addLog(`获取专辑歌曲失败: ${albumName} - ${error.message}`, 'error', 'fas fa-exclamation-circle');
            console.error('获取专辑歌曲失败:', error);
            
            if (error.response?.status === 502) {
                addLog('服务器繁忙，等待8秒后重试...', 'warning', 'fas fa-redo');
                await new Promise(resolve => setTimeout(resolve, 8000));
                
                try {
                    const retryResponse = await get('/album/songs', {
                        id: albumId,
                        page,
                        pagesize: 50
                    });
                    
                    if (retryResponse.status === 1) {
                        const songList = retryResponse.data?.songs || [];
                        if (songList.length > 0) {
                            const formattedSongs = songList
                                .filter(track => track.audio_info?.hash)
                                .map(track => {
                                    const audioInfo = track.audio_info;
                                    const base = track.base;
                                    const albumInfo = track.album_info;
                                    
                                    let coverUrl = '';
                                    if (track.trans_param?.union_cover) {
                                        coverUrl = track.trans_param.union_cover.replace('{size}', '480');
                                    } else if (albumInfo?.sizable_cover) {
                                        coverUrl = albumInfo.sizable_cover.replace('{size}', '480');
                                    }
                                    
                                    return {
                                        hash: audioInfo.hash || '',
                                        name: base.audio_name || track.audio_name || '未知歌曲',
                                        albumId: albumId,
                                        albumName: albumName,
                                        duration: audioInfo.duration || 0,
                                        timelen: audioInfo.duration || 0,
                                        cover: coverUrl,
                                        img: coverUrl,
                                        author: base.author_name || '',
                                        singer_name: base.author_name || '',
                                        album: albumName
                                    };
                                });
                            
                            allSongs.push(...formattedSongs);
                            addLog(`重试成功: ${albumName} (${formattedSongs.length}首)`, 'success', 'fas fa-check');
                        }
                    }
                } catch (retryError) {
                    addLog(`重试也失败: ${albumName} - ${retryError.message}`, 'error', 'fas fa-times');
                }
            }
            
            hasMore = false;
        }
    }
    
    return allSongs;
};

// 查询歌手
const queryArtist = async () => {
    if (!artistId.value) {
        addLog('请输入歌手ID', 'warning', 'fas fa-exclamation-triangle');
        return;
    }
    
    querying.value = true;
    allSongs.value = [];
    selectedSongs.value = new Set();
    logs.value = [];
    queryProgress.value = 0;
    
    addLog(`开始查询歌手 ID: ${artistId.value}`, 'info', 'fas fa-search');
    
    try {
        queryStatus.value = '正在获取专辑列表...';
        addLog('正在获取专辑列表...', 'info', 'fas fa-compact-disc');
        const albums = await fetchArtistAlbums(artistId.value);
        
        if (albums.length === 0) {
            addLog('未找到该歌手的专辑', 'warning', 'fas fa-exclamation-triangle');
            queryStatus.value = '查询完成（未找到专辑）';
            queryProgress.value = 100;
            querying.value = false;
            return;
        }
        
        addLog(`找到 ${albums.length} 个专辑`, 'success', 'fas fa-check-circle');
        
        const allSongsMap = new Map();
        let processedAlbums = 0;
        const totalAlbums = albums.length;
        
        for (let i = 0; i < albums.length; i++) {
            const album = albums[i];
            processedAlbums++;
            queryProgress.value = Math.round((processedAlbums / totalAlbums) * 100);
            queryStatus.value = `正在获取专辑: ${album.album_name} (${processedAlbums}/${totalAlbums})`;
            
            addLog(`获取专辑: ${album.album_name} (${processedAlbums}/${totalAlbums})`, 'info', 'fas fa-music');
            
            const albumSongs = await fetchAlbumSongs(album.album_id, album.album_name);
            
            if (albumSongs.length > 0) {
                albumSongs.forEach(song => {
                    if (!allSongsMap.has(song.hash)) {
                        allSongsMap.set(song.hash, {
                            name: song.name || song.audio_name || song.songname || '未知歌曲',
                            hash: song.hash,
                            albumId: album.album_id,
                            albumName: album.album_name || '未知专辑',
                            duration: song.duration || song.timelen || 0,
                            timelen: song.timelen || song.duration || 0,
                            cover: song.cover || song.img || '',
                            img: song.cover || song.img || '',
                            author: song.author || song.singer_name || '',
                            singer_name: song.author || song.singer_name || '',
                            album: song.album || album.album_name || ''
                        });
                    }
                });
                addLog(`  ✓ 获取到 ${albumSongs.length} 首歌曲`, 'success', 'fas fa-check');
            } else {
                addLog(`  ✗ 该专辑没有歌曲`, 'warning', 'fas fa-times');
            }
        }
        
        let songList = Array.from(allSongsMap.values());
        
        if (excludeConcert.value || excludeLive.value) {
            const beforeCount = songList.length;
            songList = songList.filter(song => 
                !shouldExclude(song.name, song.albumName)
            );
            if (beforeCount - songList.length > 0) {
                addLog(`排除演唱会/Live后剩余 ${songList.length} 首歌曲（排除了 ${beforeCount - songList.length} 首）`, 'info', 'fas fa-filter');
            }
        }
        
        allSongs.value = songList;
        queryProgress.value = 100;
        queryStatus.value = '查询完成';
        addLog(`✅ 共找到 ${songList.length} 首歌曲`, 'success', 'fas fa-check-circle');
        
    } catch (error) {
        addLog(`查询失败: ${error.message}`, 'error', 'fas fa-exclamation-circle');
        console.error('查询歌手失败:', error);
        queryStatus.value = '查询失败';
    } finally {
        querying.value = false;
    }
};

// 全选当前页
const toggleCurrentPageSelect = () => {
    if (isCurrentPageAllSelected.value) {
        paginatedSongs.value.forEach(song => {
            selectedSongs.value.delete(song.hash);
        });
    } else {
        paginatedSongs.value.forEach(song => {
            selectedSongs.value.add(song.hash);
        });
    }
};

// 全选
const selectAll = () => {
    allSongs.value.forEach(song => {
        selectedSongs.value.add(song.hash);
    });
    addLog(`已全选 ${allSongs.value.length} 首歌曲`, 'info', 'fas fa-check-square');
};

// 全不选
const deselectAll = () => {
    selectedSongs.value.clear();
    addLog('已取消所有选择', 'info', 'fas fa-square');
};

// 反选
const invertSelection = () => {
    allSongs.value.forEach(song => {
        if (selectedSongs.value.has(song.hash)) {
            selectedSongs.value.delete(song.hash);
        } else {
            selectedSongs.value.add(song.hash);
        }
    });
    addLog('已反选', 'info', 'fas fa-exchange-alt');
};

// 切换歌曲选择
const toggleSongSelection = (hash) => {
    if (selectedSongs.value.has(hash)) {
        selectedSongs.value.delete(hash);
    } else {
        selectedSongs.value.add(hash);
    }
};

// 下载开始
const handleDownloadStart = () => {
    addLog('开始批量下载...', 'info', 'fas fa-download');
};

// 下载完成
const handleDownloadComplete = async (songs, quality) => {
    const successCount = songs.length;
    addLog(`下载完成！共 ${successCount} 首歌曲，音质: ${quality}`, 'success', 'fas fa-check-circle');
    
    // 如果有 PushPlus Token，发送推送
    if (pushplusToken.value) {
        try {
            addLog('正在发送 PushPlus 推送...', 'info', 'fas fa-paper-plane');
            
            const title = `🎵 批量下载完成`;
            const content = `歌手ID: ${artistId.value}\n下载数量: ${successCount} 首\n音质: ${quality}\n\n${formatLogsForPush(logs.value)}`;
            
            const result = await sendPushNotification(pushplusToken.value, title, content);
            
            if (result.success) {
                addLog('✓ PushPlus 推送成功', 'success', 'fas fa-check-circle');
            } else {
                addLog(`✗ PushPlus 推送失败: ${result.message}`, 'error', 'fas fa-times-circle');
            }
        } catch (error) {
            addLog(`PushPlus 推送异常: ${error.message}`, 'warning', 'fas fa-exclamation-triangle');
            console.error('PushPlus 推送失败:', error);
        }
    }
};
</script>

<style scoped>
.download-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 20px;
    color: white;
}

.page-header {
    text-align: center;
    margin-bottom: 30px;
}

.page-header h1 {
    font-size: 2.5em;
    margin-bottom: 10px;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
}

.page-header p {
    opacity: 0.9;
    font-size: 1.1em;
}

.config-section, .songs-section, .download-config-section {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-radius: 15px;
    padding: 25px;
    margin-bottom: 30px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
}

.input-group {
    margin-bottom: 20px;
}

.input-group label {
    display: block;
    margin-bottom: 10px;
    font-weight: 600;
    font-size: 1.1em;
}

.input-with-button {
    display: flex;
    gap: 10px;
}

.input-field {
    flex: 1;
    padding: 12px 15px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.15);
    color: white;
    font-size: 16px;
    outline: none;
    transition: all 0.3s ease;
}

.input-field::placeholder {
    color: rgba(255, 255, 255, 0.6);
}

.input-field:focus {
    background: rgba(255, 255, 255, 0.25);
    border-color: rgba(255, 255, 255, 0.5);
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
}

.btn {
    padding: 12px 25px;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-query {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    white-space: nowrap;
}

.btn-query:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
}

.query-progress {
    margin-top: 20px;
    padding: 15px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
}

.progress-bar {
    width: 100%;
    height: 8px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 10px;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #11998e 0%, #38ef7d 100%);
    transition: width 0.3s ease;
}

.progress-text {
    text-align: center;
    font-size: 0.9em;
    opacity: 0.9;
    margin: 0;
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    flex-wrap: wrap;
    gap: 15px;
}

.section-header h2 {
    margin: 0;
    font-size: 1.5em;
}

.selection-actions {
    display: flex;
    gap: 10px;
    align-items: center;
}

.btn-small {
    padding: 8px 15px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 14px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
}

.btn-small:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.5);
}

.selected-count {
    padding: 8px 15px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    font-weight: 600;
}

.table-container {
    overflow-x: auto;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
}

.songs-table {
    width: 100%;
    border-collapse: collapse;
}

.songs-table thead {
    background: rgba(255, 255, 255, 0.15);
    position: sticky;
    top: 0;
}

.songs-table th {
    padding: 15px 10px;
    text-align: left;
    font-weight: 600;
    border-bottom: 2px solid rgba(255, 255, 255, 0.2);
}

.songs-table td {
    padding: 12px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.songs-table tbody tr {
    cursor: pointer;
    transition: all 0.2s ease;
}

.songs-table tbody tr:hover {
    background: rgba(255, 255, 255, 0.1);
}

.songs-table tbody tr.selected {
    background: rgba(56, 239, 125, 0.15);
}

.col-checkbox {
    width: 40px;
    text-align: center;
}

.col-checkbox input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
}

.col-index {
    width: 60px;
    text-align: center;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
}

.col-name {
    min-width: 200px;
}

.song-name-cell {
    display: flex;
    align-items: center;
    gap: 8px;
}

.song-name-cell i {
    color: rgba(255, 255, 255, 0.5);
}

.col-album {
    min-width: 150px;
    color: rgba(255, 255, 255, 0.8);
}

.col-duration {
    width: 100px;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
}

.col-duration i {
    color: rgba(255, 255, 255, 0.5);
}

.pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    margin-top: 20px;
    flex-wrap: wrap;
}

.btn-page {
    padding: 8px 15px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    cursor: pointer;
    transition: all 0.3s ease;
    display: inline-flex;
    align-items: center;
    gap: 5px;
}

.btn-page:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
}

.btn-page:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

.page-info {
    padding: 8px 15px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    font-weight: 600;
}

.page-size-selector {
    display: flex;
    align-items: center;
    gap: 8px;
}

.select-page-size {
    padding: 6px 10px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.15);
    color: white;
    cursor: pointer;
}

.download-config-section h3 {
    margin-top: 0;
    margin-bottom: 20px;
    font-size: 1.4em;
    display: flex;
    align-items: center;
    gap: 10px;
}

.config-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    margin-bottom: 20px;
}

.filter-options {
    background: rgba(255, 255, 255, 0.05);
    padding: 15px;
    border-radius: 8px;
}

.pushplus-config {
    background: rgba(255, 255, 255, 0.05);
    padding: 15px;
    border-radius: 8px;
}

.input-label {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    font-weight: 600;
    font-size: 0.95em;
}

.input-label i {
    color: rgba(255, 255, 255, 0.7);
}

.pushplus-input {
    width: 100%;
    margin-bottom: 8px;
}

.checkbox-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-right: 15px;
    margin-bottom: 10px;
    cursor: pointer;
    user-select: none;
}

.checkbox-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
}

.hint {
    font-size: 12px;
    opacity: 0.7;
    margin-top: 5px;
    margin-bottom: 0;
}

.logs-section {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 15px;
    padding: 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.logs-section h3 {
    margin-top: 0;
    margin-bottom: 15px;
    display: flex;
    align-items: center;
    gap: 10px;
}

.logs-container {
    max-height: 400px;
    overflow-y: auto;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    padding: 15px;
}

.log-item {
    padding: 8px 10px;
    margin-bottom: 5px;
    border-radius: 4px;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.log-item.success {
    background: rgba(56, 239, 125, 0.1);
    color: #38ef7d;
}

.log-item.error {
    background: rgba(255, 82, 82, 0.1);
    color: #ff5252;
}

.log-item.warning {
    background: rgba(255, 193, 7, 0.1);
    color: #ffc107;
}

.log-item.info {
    color: rgba(255, 255, 255, 0.8);
}

/* 响应式设计 */
@media (max-width: 768px) {
    .page-header h1 {
        font-size: 2em;
    }
    
    .section-header {
        flex-direction: column;
        align-items: flex-start;
    }
    
    .selection-actions {
        width: 100%;
        flex-wrap: wrap;
    }
    
    .config-grid {
        grid-template-columns: 1fr;
    }
    
    .pagination {
        flex-direction: column;
    }
    
    .songs-table {
        font-size: 14px;
    }
    
    .col-album {
        display: none;
    }
}
</style>
