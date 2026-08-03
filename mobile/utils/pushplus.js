/**
 * PushPlus 推送通知工具
 * 用于在下载完成后发送通知到用户手机
 */

const PUSHPLUS_API_URL = 'http://www.pushplus.plus/send';

/**
 * 保存 PushPlus Token 到 localStorage
 * @param {string} token - PushPlus Token
 */
export function savePushplusToken(token) {
    if (token) {
        localStorage.setItem('pushplus_token', token);
    } else {
        localStorage.removeItem('pushplus_token');
    }
}

/**
 * 从 localStorage 获取 PushPlus Token
 * @returns {string} PushPlus Token
 */
export function getPushplusToken() {
    return localStorage.getItem('pushplus_token') || '';
}

/**
 * 发送 PushPlus 推送通知
 * @param {string} token - PushPlus Token
 * @param {string} title - 通知标题
 * @param {string} content - 通知内容
 * @param {string} template - 模板类型，默认为 'txt'（文本）
 * @returns {Promise<Object>} 推送结果
 */
export async function sendPushNotification(token, title, content, template = 'txt') {
    if (!token) {
        throw new Error('PushPlus Token 不能为空');
    }

    try {
        const response = await fetch(PUSHPLUS_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                token: token,
                title: title,
                content: content,
                template: template
            })
        });

        const result = await response.json();

        if (result.code === 200) {
            console.log('[PushPlus] 推送成功:', result);
            return { success: true, message: '推送成功' };
        } else {
            console.error('[PushPlus] 推送失败:', result);
            return { success: false, message: result.msg || '推送失败' };
        }
    } catch (error) {
        console.error('[PushPlus] 推送异常:', error);
        return { success: false, message: `推送异常: ${error.message}` };
    }
}

/**
 * 格式化日志内容为文本格式
 * @param {Array} logs - 日志数组
 * @param {number} maxLines - 最大行数，默认100
 * @returns {string} 格式化后的日志文本
 */
export function formatLogsForPush(logs, maxLines = 100) {
    const recentLogs = logs.slice(-maxLines);
    return recentLogs.map(log => log.message).join('\n');
}
