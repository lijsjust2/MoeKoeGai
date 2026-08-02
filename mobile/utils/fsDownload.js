const log = (...args) => {
  console.log('[fsDownload]', ...args)
}

export function isFileSystemAccessSupported() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export async function pickDownloadDirectory() {
  if (!isFileSystemAccessSupported()) {
    throw new Error('当前浏览器不支持 File System Access API，请使用 Chrome 或 Edge 浏览器')
  }
  const dirHandle = await window.showDirectoryPicker({
    mode: 'readwrite',
    startIn: 'downloads'
  })
  log('选择了下载目录:', dirHandle.name)
  return dirHandle
}

export async function saveBlobToDirectory(blob, rootDir, artist, album, fileName) {
  const safeArtist = sanitizeFileName(artist || '未知歌手')
  const safeAlbum = sanitizeFileName(album || '未知专辑')
  const safeFileName = sanitizeFileName(fileName)

  log('保存文件:', `${safeArtist}/${safeAlbum}/${safeFileName}`)

  const artistDir = await rootDir.getDirectoryHandle(safeArtist, { create: true })
  const albumDir = await artistDir.getDirectoryHandle(safeAlbum, { create: true })
  const fileHandle = await albumDir.getFileHandle(safeFileName, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(blob)
  await writable.close()

  log('文件保存成功:', `${safeArtist}/${safeAlbum}/${safeFileName}`)
  return `${safeArtist}/${safeAlbum}/${safeFileName}`
}

function sanitizeFileName(name) {
  if (!name) return '未知'
  return String(name)
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
}
