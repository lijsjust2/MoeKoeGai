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

        <!-- 第二步：专辑列表 -->
        <div v-if="albums.length > 0" class="songs-section">
            <div class="section-header">
                <h2>专辑列表 (共 {{ albums.length }} 个)</h2>
                <div class="selection-actions">
                    <button @click="selectAllAlbums" class="btn-small">
                        <i class="fas fa-check-square"></i> 全选
                    </button>
                    <button @click="deselectAllAlbums" class="btn-small">
                        <i class="fas fa-square"></i> 全不选
                    </button>
                    <span class="selected-count">已选 {{ selectedAlbums.size }} 个专辑</span>
                </div>
            </div>

            <!-- 专辑表格 -->
            <div class="table-container">
                <table class="songs-table">
                    <thead>
                        <tr>
                            <th class="col-checkbox">
                                <input 
                                    type="checkbox" 
                                    :checked="isAllAlbumsSelected" 
                                    @change="toggleAllAlbumsSelect"
                                />
                            </th>
                            <th class="col-index">#</th>
                            <th class="col-name">专辑名</th>
                            <th class="col-date">发布时间</th>
                            <th class="col-count">歌曲数量</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr 
                            v-for="(album, index) in paginatedAlbums" 
                            :key="album.album_id"
                            :class="{ selected: selectedAlbums.has(album.album_id) }"
                            @click="toggleAlbumSelection(album.album_id)"
                        >
                            <td class="col-checkbox" @click.stop>
                                <input 
                                    type="checkbox" 
                                    :checked="selectedAlbums.has(album.album_id)"
                                    @change="toggleAlbumSelection(album.album_id)"
                                />
                            </td>
                            <td class="col-index">{{ (currentPage - 1) * pageSize + index + 1 }}</td>
                            <td class="col-name">
                                <div class="song-name-cell">
                                    <i class="fas fa-compact-disc"></i>
                                    <span>{{ album.album_name || '未知专辑' }}</span>
                                </div>
                            </td>
                            <td class="col-date">
                                <i class="fas fa-calendar-alt"></i>
                                {{ album.publish_date || album.publish_time || '未知' }}
                            </td>
                            <td class="col-count">
                                <span v-if="album.songCount !== undefined && album.songCount !== null">{{ album.songCount }} 首</span>
                                <span v-else class="loading-count"><i class="fas fa-spinner fa-spin"></i> 加载中...</span>
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
        <div v-if="albums.length > 0 && selectedAlbums.size > 0" class="download-config-section">
            <h3><i class="fas fa-download"></i> 准备下载</h3>
            
            <div v-if="!isDownloadReady" class="loading-songs-hint">
                <i class="fas fa-spinner fa-spin"></i>
                <span>正在加载选中专辑的歌曲信息，请稍候...</span>
            </div>
            
            <template v-else>
                <div class="download-summary">
                    <i class="fas fa-music"></i>
                    <span>已选 <strong>{{ selectedAlbums.size }}</strong> 个专辑，共 <strong>{{ selectedSongList.length }}</strong> 首歌曲</span>
                </div>
                
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
                    
                    <!-- 下载等待延时配置 -->
                    <div class="delay-config">
                        <label class="input-label">
                            <i class="fas fa-clock"></i>
                            <span>下载等待延时（防风控）</span>
                        </label>
                        <div class="delay-inputs">
                            <input 
                                v-model.number="downloadDelayMin" 
                                type="number" 
                                min="0"
                                max="10"
                                step="0.5"
                                placeholder="最小值"
                                class="input-field delay-input"
                            />
                            <span class="delay-separator">-</span>
                            <input 
                                v-model.number="downloadDelayMax" 
                                type="number" 
                                min="0"
                                max="10"
                                step="0.5"
                                placeholder="最大值"
                                class="input-field delay-input"
                            />
                            <span class="delay-unit">秒</span>
                        </div>
                        <p class="hint">每首歌曲下载后随机等待时间，避免触发风控（建议 3-7 秒）</p>
                    </div>
                </div>

                <!-- 使用 BatchDownloadManager 组件 -->
                <BatchDownloadManager 
                    :songs="selectedSongList"
                    :show-trigger-button="true"
                    trigger-text="开始下载"
                    trigger-icon="fas fa-download"
                    :download-delay-min="downloadDelayMin"
                    :download-delay-max="downloadDelayMax"
                    @download-start="handleDownloadStart"
                    @download-complete="handleDownloadComplete"
                    @song-download-success="handleSongDownloadSuccess"
                    @song-download-fail="handleSongDownloadFail"
                    @download-waiting="handleDownloadWaiting"
                />
            </template>
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
import { ref, computed, watch, onMounted } from 'vue';
import { get } from '../utils/request';
import { useRoute } from 'vue-router';
import BatchDownloadManager from '../components/BatchDownloadManager.vue';
import { savePushplusToken, getPushplusToken, sendPushNotification, formatLogsForPush } from '../utils/pushplus';

const route = useRoute();

// 状态变量
const artistId = ref('');
const excludeConcert = ref(true);
const excludeLive = ref(true);
const querying = ref(false);
const albums = ref([]);
const selectedAlbums = ref(new Set());
const albumSongMap = ref(new Map());
const logs = ref([]);

// PushPlus 推送配置 - 从 localStorage 加载
const pushplusToken = ref(getPushplusToken());

// 下载等待延时配置 - 从 localStorage 加载，默认 3-7 秒
const downloadDelayMin = ref(parseFloat(localStorage.getItem('download_delay_min')) || 3);
const downloadDelayMax = ref(parseFloat(localStorage.getItem('download_delay_max')) || 7);

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

// 监听下载延时配置变化，自动保存到 localStorage
watch([downloadDelayMin, downloadDelayMax], ([newMin, newMax]) => {
    // 确保最小值不大于最大值
    if (newMin > newMax) {
        downloadDelayMax.value = newMin;
    }
    // 确保值在合理范围内
    const validMin = Math.max(0, Math.min(10, newMin));
    const validMax = Math.max(0, Math.min(10, newMax));
    
    localStorage.setItem('download_delay_min', validMin.toString());
    localStorage.setItem('download_delay_max', validMax.toString());
});

// 计算选中的歌曲列表（从选中专辑收集歌曲，并应用过滤）
const selectedSongList = computed(() => {
    const songs = [];
    const map = albumSongMap.value;
    for (const albumId of selectedAlbums.value) {
        const albumSongs = map.get(albumId);
        if (albumSongs) {
            const filtered = albumSongs.filter(song => !shouldExclude(song.name, song.albumName));
            songs.push(...filtered);
        }
    }
    return songs;
});

// 计算当前页的专辑
const paginatedAlbums = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value;
    const end = start + pageSize.value;
    return albums.value.slice(start, end);
});

// 总页数
const totalPages = computed(() => {
    return Math.ceil(albums.value.length / pageSize.value);
});

// 是否所有专辑都已选中
const isAllAlbumsSelected = computed(() => {
    if (albums.value.length === 0) return false;
    return albums.value.every(album => selectedAlbums.value.has(album.album_id));
});

// 选中专辑的歌曲是否都已加载完成
const isDownloadReady = computed(() => {
    for (const albumId of selectedAlbums.value) {
        if (!albumSongMap.value.has(albumId)) return false;
    }
    return selectedAlbums.value.size > 0;
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
    albums.value = [];
    selectedAlbums.value = new Set();
    albumSongMap.value = new Map();
    logs.value = [];
    queryProgress.value = 0;
    
    addLog(`开始查询歌手 ID: ${artistId.value}`, 'info', 'fas fa-search');
    
    try {
        queryStatus.value = '正在获取专辑列表...';
        addLog('正在获取专辑列表...', 'info', 'fas fa-compact-disc');
        const rawAlbums = await fetchArtistAlbums(artistId.value);
        
        if (rawAlbums.length === 0) {
            addLog('未找到该歌手的专辑', 'warning', 'fas fa-exclamation-triangle');
            queryStatus.value = '查询完成（未找到专辑）';
            queryProgress.value = 100;
            querying.value = false;
            return;
        }
        
        addLog(`找到 ${rawAlbums.length} 个专辑`, 'success', 'fas fa-check-circle');
        
        // 按发布时间新到旧排序
        rawAlbums.sort((a, b) => {
            const dateA = a.publish_date || a.publish_time || '';
            const dateB = b.publish_date || b.publish_time || '';
            return String(dateB).localeCompare(String(dateA));
        });
        
        // 初始化专辑数据（设置 songCount 为 undefined，等后台加载后更新）
        albums.value = rawAlbums.map(a => ({
            ...a,
            songCount: undefined
        }));
        
        queryProgress.value = 100;
        queryStatus.value = `专辑列表加载完成，正在获取歌曲信息...`;
        addLog('✅ 专辑列表已显示，后台正在获取歌曲信息...', 'info', 'fas fa-hourglass-half');
        
        // 后台并发加载每个专辑的歌曲
        await loadAlbumSongsInBackground(rawAlbums);
        
    } catch (error) {
        addLog(`查询失败: ${error.message}`, 'error', 'fas fa-exclamation-circle');
        console.error('查询歌手失败:', error);
        queryStatus.value = '查询失败';
    } finally {
        querying.value = false;
    }
};

// 监听路由参数变化，自动填入歌手ID（不自动查询，由用户手动点击）
watch(() => route.query.artistId, (newArtistId) => {
    if (newArtistId) {
        artistId.value = String(newArtistId);
    }
}, { immediate: true });

// 后台加载所有专辑的歌曲
const loadAlbumSongsInBackground = async (rawAlbums) => {
    let loadedCount = 0;
    const total = rawAlbums.length;
    
    const updateAlbumSongCount = (albumId, count) => {
        const idx = albums.value.findIndex(a => a.album_id === albumId);
        if (idx !== -1) {
            const updated = [...albums.value];
            updated[idx] = { ...updated[idx], songCount: count };
            albums.value = updated;
        }
    };
    
    await parallelLimit(
        rawAlbums.map((album) => async () => {
            const albumSongs = await fetchAlbumSongs(album.album_id, album.album_name);
            
            // 存储歌曲
            const map = new Map(albumSongMap.value);
            map.set(album.album_id, albumSongs);
            albumSongMap.value = map;
            
            // 更新显示
            updateAlbumSongCount(album.album_id, albumSongs.length);
            
            loadedCount++;
            queryStatus.value = `歌曲信息加载中 (${loadedCount}/${total})`;
            
            if (albumSongs.length > 0) {
                addLog(`  ✓ ${album.album_name}: ${albumSongs.length} 首`, 'success', 'fas fa-check');
            } else {
                addLog(`  ✗ ${album.album_name}: 没有歌曲`, 'warning', 'fas fa-times');
            }
        }),
        5
    );
    
    // 汇总
    let totalSongs = 0;
    for (const songs of albumSongMap.value.values()) {
        totalSongs += songs.length;
    }
    queryStatus.value = `加载完成，共 ${totalSongs} 首歌曲`;
    addLog(`✅ 全部加载完成，共 ${totalSongs} 首歌曲`, 'success', 'fas fa-check-circle');
};

// 并发限制函数
const parallelLimit = async (tasks, limit) => {
    const results = [];
    const executing = [];
    for (const [i, task] of tasks.entries()) {
        const p = Promise.resolve().then(() => task(i));
        results.push(p);
        if (limit <= tasks.length) {
            const e = p.then(() => executing.splice(executing.indexOf(e), 1));
            executing.push(e);
            if (executing.length >= limit) {
                await Promise.race(executing);
            }
        }
    }
    return Promise.all(results);
};

// 切换专辑选择
const toggleAlbumSelection = (albumId) => {
    const set = new Set(selectedAlbums.value);
    if (set.has(albumId)) {
        set.delete(albumId);
    } else {
        set.add(albumId);
    }
    selectedAlbums.value = set;
};

// 全选专辑
const selectAllAlbums = () => {
    const set = new Set();
    albums.value.forEach(album => set.add(album.album_id));
    selectedAlbums.value = set;
    addLog(`已全选 ${albums.value.length} 个专辑`, 'info', 'fas fa-check-square');
};

// 全不选
const deselectAllAlbums = () => {
    selectedAlbums.value = new Set();
    addLog('已取消所有选择', 'info', 'fas fa-square');
};

// 切换当前页全选
const toggleAllAlbumsSelect = () => {
    if (isAllAlbumsSelected.value) {
        deselectAllAlbums();
    } else {
        selectAllAlbums();
    }
};

// 等待下一首下载
const handleDownloadWaiting = (delaySec, currentIndex, total) => {
    addLog(`⏳ 等待 ${delaySec} 秒后下载下一首 (${currentIndex}/${total})`, 'info', 'fas fa-hourglass-half');
};

// 单首歌曲下载成功
const handleSongDownloadSuccess = (song, index) => {
    addLog(`[${index}/${selectedSongList.value.length}] ✓ 下载成功: ${song.name}`, 'success', 'fas fa-check-circle');
};

// 单首歌曲下载失败
const handleSongDownloadFail = (song, index, error) => {
    addLog(`[${index}/${selectedSongList.value.length}] ✗ 下载失败: ${song.name} - ${error.message || error}`, 'error', 'fas fa-exclamation-circle');
};

// 下载开始
const handleDownloadStart = () => {
    addLog('开始批量下载...', 'info', 'fas fa-download');
};

// 下载完成
const handleDownloadComplete = async (result) => {
    const { songs, quality, successList, failedList, totalCount, successCount, failedCount, cancelled } = result;
    
    if (cancelled) {
        addLog(`⛔ 下载已取消，已下载 ${successCount} 首，失败 ${failedCount} 首`, 'warning', 'fas fa-exclamation-triangle');
    } else {
        addLog(`下载完成！共 ${totalCount} 首歌曲，成功 ${successCount} 首，失败 ${failedCount} 首，音质: ${quality}`, 'success', 'fas fa-check-circle');
    }
    
    // 如果有 PushPlus Token，发送推送
    if (pushplusToken.value) {
        try {
            addLog('正在发送 PushPlus 推送...', 'info', 'fas fa-paper-plane');
            
            // 构建精简的推送内容
            let content = `总下载歌曲：${totalCount}首，音质${quality}\n`;
            content += `成功下载${successCount}首，失败${failedCount}首\n\n`;
            
            // 成功下载的明细
            if (successList && successList.length > 0) {
                content += '成功下载的明细：\n';
                successList.forEach((item, index) => {
                    content += `${index + 1}、${item.name}\n`;
                });
                content += '\n';
            }
            
            // 失败的明细
            if (failedList && failedList.length > 0) {
                content += '失败的明细：\n';
                failedList.forEach((item, index) => {
                    content += `${index + 1}、${item.name}`;
                    if (item.error) {
                        content += ` (${item.error})`;
                    }
                    content += '\n';
                });
            }
            
            const title = `🎵 批量下载完成`;
            
            const pushResult = await sendPushNotification(pushplusToken.value, title, content);
            
            if (pushResult.success) {
                addLog('✓ PushPlus 推送成功', 'success', 'fas fa-check-circle');
            } else {
                addLog(`✗ PushPlus 推送失败: ${pushResult.message}`, 'error', 'fas fa-times-circle');
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

.col-date {
    min-width: 120px;
    display: flex;
    align-items: center;
    gap: 6px;
    color: rgba(255, 255, 255, 0.8);
}

.col-date i {
    color: rgba(255, 255, 255, 0.5);
}

.col-count {
    min-width: 100px;
    text-align: center;
}

.loading-count {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
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

.loading-songs-hint {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 20px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    font-size: 15px;
    color: rgba(255, 255, 255, 0.9);
}

.loading-songs-hint i {
    font-size: 20px;
    color: #667eea;
}

.download-summary {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 15px 20px;
    background: rgba(56, 239, 125, 0.1);
    border: 1px solid rgba(56, 239, 125, 0.3);
    border-radius: 8px;
    margin-bottom: 20px;
    font-size: 15px;
    color: #38ef7d;
}

.download-summary i {
    font-size: 18px;
}

.download-summary strong {
    font-weight: 700;
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

.delay-config {
    background: rgba(255, 255, 255, 0.05);
    padding: 15px;
    border-radius: 8px;
}

.delay-inputs {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
}

.delay-input {
    width: 80px;
    text-align: center;
}

.delay-separator {
    font-size: 18px;
    font-weight: bold;
    color: rgba(255, 255, 255, 0.6);
}

.delay-unit {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.7);
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
    
    .col-date {
        display: none;
    }
    .col-count {
        display: none;
    }
}
</style>
