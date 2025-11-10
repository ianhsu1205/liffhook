// 輔助函數：從URL提取域名
function extractDomainName(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch (e) {
        return '網頁內容';
    }
}

// 全域變數
const API_BASE = (() => {
    // 檢查是否為本地開發環境
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return window.location.origin + '/api';
    }
    // 生產環境使用實際後端地址
    return 'https://35.221.146.143.nip.io/linehook';
})();

let announcementId = '';
let canvas, ctx;
let isDrawing = false;
let currentUserInfo = null;
let hasSignatureContent = false;
let currentSignatureData = null;
let currentAnnouncement = null; // 當前宣導內容
let originalScreenOrientation = null; // 記錄原始螢幕方向

// 配置設定（移除LIFF 依賴）
const channelId = "2006992891"; // 頻道 ID

// 螢幕方向控制函數
async function forceScreenOrientation(orientation) {
    // 檢查是否支援 Screen Orientation API
    if (!screen.orientation) {
        return false;
    }
    
    try {
        // 記錄當前方向（只在第一次記錄）
        if (originalScreenOrientation === null) {
            originalScreenOrientation = screen.orientation.type;
        }
        
        // 嘗試鎖定螢幕方向
        await screen.orientation.lock(orientation);
        return true;
    } catch (error) {
        return false;
    }
}

async function restoreScreenOrientation() {
    if (!screen.orientation) {
        return false;
    }
    
    try {
        // 解除螢幕方向鎖定
        screen.orientation.unlock();
        
        // 清除記錄的原始方向
        originalScreenOrientation = null;
        return true;
    } catch (error) {
        return false;
    }
}

// 添加頁面可見性變化監聽器，確保螢幕方向在必要時恢復
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // 當頁面變為不可見時（比如切換到其他應用），恢復螢幕方向
        if (originalScreenOrientation !== null) {
            restoreScreenOrientation();
        }
    }
});

// 添加視窗卸載監聽器，確保螢幕方向恢復
window.addEventListener('beforeunload', function() {
    if (originalScreenOrientation !== null) {
        restoreScreenOrientation();
    }
});

// 頁面載入
document.addEventListener('DOMContentLoaded', function() {
    // 立即嘗試一次解析
    const immediateAnnouncementId = getAnnouncementIdFromUrl();
    const immediateUserId = getUserIdFromUrl();
    
    // 如果立即解析成功，直接初始化
    if (immediateAnnouncementId) {
        initializePage();
    } else {
        // 如果失敗，等待一段時間再重試
        setTimeout(() => {
            const retryAnnouncementId = getAnnouncementIdFromUrl();
            
            if (retryAnnouncementId) {
                initializePage();
            } else {
                // 最後一次重試
                setTimeout(() => {
                    initializePage();
                }, 2000);
            }
        }, 1000);
    }
});

// 從 URL 中獲取宣導 ID - 支援多種格式
function getAnnouncementIdFromUrl() {
    try {
        // 從 URL query parameters 獲取 id 參數
        const urlParams = new URLSearchParams(window.location.search);
        let id = urlParams.get('id');
        
        if (id) {
            return id;
        }
        
        // 如果沒有找到，嘗試從 hash 部分獲取（備用方案）
        if (window.location.hash) {
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            id = hashParams.get('id');
            if (id) {
                return id;
            }
        }
        
        return null;
        
    } catch (error) {
        return null;
    }
}

// 從 URL 中獲取用戶 ID
function getUserIdFromUrl() {
    try {
        
        // 從 URL query parameters 獲取 userId 參數
        const urlParams = new URLSearchParams(window.location.search);
        let userId = urlParams.get('userId');
        
        
        if (userId) {
            return userId;
        }
        
        // 如果沒有找到，嘗試從 hash 部分獲取（備用方案）
        if (window.location.hash) {
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            userId = hashParams.get('userId');
            if (userId) {
                return userId;
            }
        }
        
        return null;
        
    } catch (error) {
        return null;
    }
}

// 初始化頁面
async function initializePage() {
    try {
        // 從 URL 獲取宣導 ID - 支援多種 URL 格式
        announcementId = getAnnouncementIdFromUrl();
        
        if (!announcementId) {
            // 等待一會兒再重試，有時候頁面需要時間來加載完成
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // 重新嘗試解析
            announcementId = getAnnouncementIdFromUrl();
            
            if (!announcementId) {
                
                // 檢查是否為 LIFF 登入回調
                if (window.location.search.includes('code=') && window.location.search.includes('state=')) {
                    // 重導向至用戶頁面
                    window.location.href = 'user.html';
                    return;
                }
                
                // 如果仍然沒有ID，重導向到用戶頁面
                showError('無法獲取宣導資訊，將返回主頁面...');
                setTimeout(() => {
                    window.location.href = 'user.html';
                }, 2000);
                return;
            }
        }
        
        // 載入宣導內容
        await loadAnnouncementContent();
        
        // 在內容載入完成後進行身份驗證
        try {
            await initializeAuthentication();
            
            // 檢查用戶是否已經簽名過此宣導
            if (currentUserInfo && currentUserInfo.userId) {
                const signatureStatus = await checkSignatureStatus(announcementId, currentUserInfo.userId);
                if (signatureStatus.signed) {
                    showSignedState(signatureStatus.recordId);
                } else {
                    showSignatureInterface();
                }
            }
        } catch (error) {
            // 詳細錯誤資訊，用於除錯
            
            // 即使身份驗證失敗，也保證內容顯示，只是不能簽名
            // 禁用簽名按鈕
            const signatureButton = document.getElementById('signatureButton');
            if (signatureButton) {
                signatureButton.disabled = true;
                signatureButton.innerHTML = '<i class="fas fa-exclamation-triangle me-2"></i>身份驗證失敗，無法簽名';
                signatureButton.className = 'btn btn-secondary btn-lg w-100';
            }
            
            let alertMessage = '用戶身份驗證失敗，您可以瀏覽內容但無法簽名：';
            if (error.message.includes('缺少')) {
                alertMessage = 'URL缺少用戶 ID 參數，無法進行身份驗證。您可以瀏覽內容但無法簽名。';
            } else if (error.message.includes('查無此用戶')) {
                alertMessage = '查無此用戶ID，請確認您是否有權限。您可以瀏覽內容但無法簽名。';
            } else if (error.message.includes('網路')) {
                alertMessage = '網路連線異常，無法驗證用戶身份。您可以瀏覽內容但無法簽名。';
            }
            
            showMessage(alertMessage, 'warning');
        }
        
        // 顯示主要內容
        hideLoading();
        
    } catch (error) {
        const errorMessage = error.message || '未知錯誤';
        showError(`載入失敗: ${errorMessage}`);
        
        // 確保載入狀態被隱藏
        const loadingElement = document.getElementById('loadingState');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }
}

// 初始化身份驗證（使用 URL 參數）
async function initializeAuthentication() {
    try {
        
        const urlUserId = getUserIdFromUrl();
        
        
        if (!urlUserId) {
            throw new Error('URL 中缺少 userId 參數');
        }
        
        
        // 驗證並獲取用戶資訊
        const userInfo = await verifyUser(urlUserId);
        
        if (userInfo) {
            currentUserInfo = userInfo;
            
            // 更新頁面上的用戶資訊顯示
            updateUserInfoDisplay(userInfo);
        } else {
            throw new Error('查無此用戶ID');
        }
        
    } catch (error) {
        throw error;
    }
}

// 驗證用戶
async function verifyUser(userId) {
    try {
        
        const response = await fetch(`${API_BASE}/User/verify/${userId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('查無此用戶');
            } else if (response.status >= 500) {
                throw new Error('伺服器錯誤，請稍後再試');
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
            return {
                userId: result.data.userId,
                name: result.data.name,
                company: result.data.company,
                department: result.data.dept,
                employeeId: result.data.empId
            };
        } else {
            throw new Error(result.message || '用戶驗證失敗');
        }
        
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('網路連線異常，無法驗證用戶身份');
        }
        throw error;
    }
}

// 更新用戶資訊顯示
function updateUserInfoDisplay(userInfo) {
    
    const userNameElement = document.getElementById('userName');
    const userCompanyElement = document.getElementById('userCompany');
    const userDepartmentElement = document.getElementById('userDepartment');
    const userEmployeeIdElement = document.getElementById('userEmployeeId');
    
    if (userNameElement) {
        userNameElement.textContent = userInfo.name;
    }
    
    if (userCompanyElement) {
        userCompanyElement.textContent = userInfo.company;
    }
    
    if (userDepartmentElement) {
        userDepartmentElement.textContent = userInfo.department;
    }
    
    if (userEmployeeIdElement) {
        userEmployeeIdElement.textContent = userInfo.employeeId;
    }
}

// 載入宣導內容
async function loadAnnouncementContent() {
    try {
        
        showLoading();
        
        const response = await fetch(`${API_BASE}/EAnnouncement/${announcementId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('找不到指定的宣導專案');
            }
            throw new Error(`HTTP ${response.status}: 載入宣導內容失敗`);
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
            currentAnnouncement = result.data;
            renderAnnouncementContent(result.data);
        } else {
            throw new Error(result.message || '載入宣導內容失敗');
        }
        
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('網路連線異常，無法載入宣導內容');
        }
        throw error;
    }
}

// 渲染宣導內容
function renderAnnouncementContent(announcement) {
    
    // 更新標題
    document.getElementById('announcementTitle').textContent = announcement.title;
    
    // 更新發布資訊
    const publishInfo = `發布單位：${announcement.publishUnit || '未指定'} | 發布日期：${announcement.publishDate || '未指定'}`;
    document.getElementById('publishInfo').textContent = publishInfo;
    
    // 渲染內容區塊
    const contentContainer = document.getElementById('announcementContent');
    if (contentContainer && announcement.contentBlocks) {
        const contentHtml = renderContentBlocks(announcement.contentBlocks);
        contentContainer.innerHTML = contentHtml;
    }
    
}

// 渲染內容區塊
function renderContentBlocks(blocks) {
    let html = '';
    
    blocks.forEach((block, index) => {
        if (block.text && block.text.trim()) {
            html += `<div class="content-block text-block mb-3">
                <div class="border rounded p-3" style="background-color: #f8f9fa;">
                    <p class="mb-0">${block.text}</p>
                </div>
            </div>`;
        }
        else if (block.type === 'image' && block.content) {
            html += `<div class="content-block image-block mb-3 text-center">
                <img src="${block.content}" 
                     class="img-fluid content-image clickable-image" 
                     alt="宣導圖片" 
                     style="max-width: 100%; height: auto; border-radius: 8px; cursor: pointer;" 
                     onclick="openImageModal('${block.content}', '宣導圖片')">
            </div>`;
        }
        else if (block.type === 'html' && block.content) {
            // 優先檢查是否為純HTML內容
            let isLikelyHtml = block.content.includes('<') && block.content.includes('>');
            let isJsonLike = false;
            let isUrlLike = block.content.startsWith('http://') || block.content.startsWith('https://');
            
            if (!isUrlLike) {
                try {
                    JSON.parse(block.content);
                    isJsonLike = true;
                } catch {
                    // 不是 JSON
                }
            }
            
            // 如果包含HTML標籤或者既不是URL也不是JSON，就當作HTML處理
            if (isLikelyHtml || (!isUrlLike && !isJsonLike)) {
                // 直接作為HTML內容處理 - 加入放大檢視功能
                html += `<div class="content-block html-block mb-3">
                    <div class="border rounded p-3 position-relative" style="background-color: #f8f9fa;">
                        <div class="d-flex justify-content-end mb-2">
                            <button type="button" 
                                    class="btn btn-outline-primary btn-sm me-1" 
                                    onclick="openHtmlModal(\`${block.content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`, 'HTML 內容')"
                                    title="放大檢視">
                                <i class="fas fa-search-plus"></i>
                            </button>
                            <button type="button" 
                                    class="btn btn-outline-secondary btn-sm" 
                                    onclick="openHtmlInNewWindow(\`${block.content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)"
                                    title="新視窗開啟">
                                <i class="fas fa-external-link-alt"></i>
                            </button>
                        </div>
                        ${block.content}
                    </div>
                </div>`;
            } else {
                // 處理 JSON 格式的連結或直接URL
                try {
                    let linkData;
                    if (isUrlLike) {
                        linkData = { url: block.content, title: '外部連結' };
                    } else {
                        linkData = JSON.parse(block.content);
                    }
                    
                    if (linkData && linkData.url) {
                        // 創建iframe來載入網頁內容而不是外部連結
                        html += `<div class="content-block html-iframe-block mb-3">
                            <div class="border rounded position-relative" style="background-color: #f8f9fa;">
                                <!-- 浮動控制按鈕 -->
                                <div class="iframe-floating-controls" style="position: sticky; top: 10px; right: 10px; float: right; z-index: 1000; background: rgba(255,255,255,0.95); border-radius: 8px; padding: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); backdrop-filter: blur(5px); margin-bottom: 10px;">
                                    <div class="btn-group" role="group">
                                        <button type="button" 
                                                class="btn btn-primary btn-sm" 
                                                onclick="openUrlInModal('${linkData.url}', '${(linkData.title || '網頁內容').replace(/'/g, '\\\'')}')"
                                                title="放大檢視">
                                            <i class="fas fa-search-plus"></i>
                                        </button>
                                        <button type="button" 
                                                class="btn btn-secondary btn-sm" 
                                                onclick="window.open('${linkData.url}', '_blank')"
                                                title="新視窗開啟">
                                            <i class="fas fa-external-link-alt"></i>
                                        </button>
                                    </div>
                                </div>
                                ${linkData.title ? `
                                <div class="d-flex justify-content-between align-items-center p-2 bg-light border-bottom" style="position: relative; z-index: 100;">
                                    <small class="text-muted">
                                        <i class="fas fa-globe me-1"></i>
                                        ${linkData.title}
                                    </small>
                                </div>
                                ` : ''}
                                <div class="iframe-container position-relative" style="height: 90vh; width: 100%; margin: 0 auto; overflow: hidden !important;">
                                    <iframe src="${linkData.url}" 
                                            style="width: 100%; height: 100%; border: none; transform: scale(1.02) translateY(-40px); transform-origin: top center;" 
                                            frameborder="0"
                                            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
                                            loading="lazy"
                                            onload="hideIframeUrlBars()">
                                        <div class="p-3 text-center">
                                            <p>您的瀏覽器不支援 iframe，請點擊以下連結：</p>
                                            <a href="${linkData.url}" target="_blank" class="btn btn-primary">
                                                開啟網頁
                                            </a>
                                        </div>
                                    </iframe>
                                </div>
                            </div>
                        </div>`;
                    }
                } catch (error) {
                    // 如果處理JSON/URL失敗，降級為HTML處理
                    html += `<div class="content-block html-block mb-3">
                        <div class="border rounded p-3 position-relative" style="background-color: #f8f9fa;">
                            <div class="d-flex justify-content-end mb-2">
                                <button type="button" 
                                        class="btn btn-outline-primary btn-sm me-1" 
                                        onclick="openHtmlModal(\`${block.content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`, 'HTML 內容')"
                                        title="放大檢視">
                                    <i class="fas fa-search-plus"></i>
                                </button>
                                <button type="button" 
                                        class="btn btn-outline-secondary btn-sm" 
                                        onclick="openHtmlInNewWindow(\`${block.content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)"
                                        title="新視窗開啟">
                                    <i class="fas fa-external-link-alt"></i>
                                </button>
                            </div>
                            ${block.content}
                        </div>
                    </div>`;
                }
            }
        }
        else if (block.type === 'youtube' && block.content) {
            
            // 支援兩種情況：1) block.content 為 JSON（包含 url/videoId/title） 2) block.content 為純 URL
            let videoUrl = '';
            let videoId = '';
            let videoTitle = 'YouTube 影片';

            // 先嘗試解析 JSON
            try {
                const youtubeData = JSON.parse(block.content);
                if (youtubeData.url) videoUrl = youtubeData.url;
                if (youtubeData.videoId) videoId = youtubeData.videoId;
                if (youtubeData.title) videoTitle = youtubeData.title;
            } catch (e) {
                // 不是 JSON，當作 URL 處理
                videoUrl = block.content;
            }

            // 如果尚未取得 videoId，嘗試從 URL 擷取
            if (!videoId && videoUrl) {
                try {
                    const urlObj = new URL(videoUrl);
                    if (urlObj.hostname.includes('youtu.be')) {
                        videoId = urlObj.pathname.slice(1);
                    } else if (urlObj.searchParams && urlObj.searchParams.get('v')) {
                        videoId = urlObj.searchParams.get('v');
                    } else if (urlObj.pathname.includes('/embed/')) {
                        const parts = urlObj.pathname.split('/');
                        const embedIndex = parts.indexOf('embed');
                        if (embedIndex >= 0 && parts[embedIndex + 1]) {
                            videoId = parts[embedIndex + 1];
                        }
                    }
                } catch (e) {
                }
            }

            // 優先使用 videoId 來建立嵌入 URL，否則退回到原始 URL
            const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : (videoUrl || '');

            if (embedUrl) {
                html += `<div class="content-block youtube-block mb-3">
                    <div class="border rounded p-3" style="background-color: #fff3cd;">
                        <i class="fab fa-youtube text-danger me-2"></i>
                        <strong>YouTube 影片：</strong> ${escapeHtml(videoTitle)}
                        <div class="ratio ratio-16x9 mt-2">
                            <iframe src="${embedUrl}" title="${escapeHtml(videoTitle)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                        </div>
                    </div>
                </div>`;
            } else {
                // 無法取得可嵌入的影片，回退顯示可點連結
                const displayUrl = videoUrl || block.content;
                html += `<div class="content-block youtube-block mb-3">
                    <div class="border rounded p-3" style="background-color: #fff3cd;">
                        <i class="fab fa-youtube text-danger me-2"></i>
                        <strong>YouTube 影片：</strong>
                        <a href="${displayUrl}" target="_blank" class="text-primary">${displayUrl}<i class="fas fa-external-link-alt ms-1"></i></a>
                    </div>
                </div>`;
            }
        }
    });
    
    return html;
}

// 檢查簽名狀態
async function checkSignatureStatus(announcementId, userId) {
    try {
        
        // 使用正確的 user-announcements API 來檢查特定用戶的簽名記錄
        const response = await fetch(`${API_BASE}/EAnnouncement/user-announcements?userId=${encodeURIComponent(userId)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        
        if (response.ok) {
            const result = await response.json();
            
            if (result.success && result.data && result.data.length > 0) {
                // 查找對應的宣導記錄
                const announcementRecord = result.data.find(record => {
                    return record.id === announcementId;
                });
                
                
                // 檢查是否已簽名
                const hasSignature = announcementRecord && announcementRecord.hasSignature;
                const recordId = announcementRecord ? announcementRecord.recordId : null;
                
                // 如果已簽名，回傳簽名狀態和記錄ID
                if (hasSignature && recordId) {
                    return { 
                        signed: true, 
                        recordId: recordId,
                        signedAt: announcementRecord.signedAt 
                    };
                } else {
                    return { signed: false };
                }
            } else {
            }
        } else {
        }
        
        return { signed: false };
        
    } catch (error) {
        return { signed: false };
    }
}

// 顯示簽名介面
function showSignatureInterface() {
    
    // 隱藏載入狀態
    hideLoading();
    
    // 顯示內容
    const mainContent = document.getElementById('mainContent');
    const signButtonContainer = document.getElementById('signButtonContainer');
    
    if (mainContent) {
        mainContent.style.display = 'block';
    }
    
    // 檢查是否為手機裝置（移除自動進入全屏簽名）
    if (isMobileDevice()) {
        // 不再自動進入全屏簽名，而是顯示正常的簽名按鈕
        if (signButtonContainer) {
            signButtonContainer.style.display = 'block';
        }
    } else {
        // 桌面版顯示簽名按鈕
        if (signButtonContainer) {
            signButtonContainer.style.display = 'block';
        }
    }
    
    // 確保簽名狀態區域隱藏
    const signatureStatusArea = document.getElementById('signatureStatusArea');
    const signedState = document.getElementById('signedState');
    if (signatureStatusArea) signatureStatusArea.style.display = 'none';
    if (signedState) signedState.style.display = 'none';
    
    // 初始化簽名畫布（如果存在的話）
    initializeCanvas();
    
}

// 顯示已簽名狀態
async function showSignedState(recordId = null) {
    try {
        
        // 隱藏載入狀態
        hideLoading();
        
        // 顯示內容
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            mainContent.style.display = 'block';
        }
        
        // 隱藏所有簽名相關的按鈕和區域
        const signButtonContainer = document.getElementById('signButtonContainer');
        const signedState = document.getElementById('signedState');
        const signatureButton = document.getElementById('signatureButton');
        const landscapeSignatureButton = document.getElementById('landscapeSignatureButton');
        
        // 隱藏簽名按鈕容器
        if (signButtonContainer) {
            signButtonContainer.style.display = 'none';
        }
        
        // 隱藏個別簽名按鈕
        if (signatureButton) {
            signatureButton.style.display = 'none';
        }
        if (landscapeSignatureButton) {
            landscapeSignatureButton.style.display = 'none';
        }
        
        // 隱藏任何可能的"我已閱讀"相關按鈕
        const readConfirmButtons = document.querySelectorAll('[data-action="confirm-read"], .read-confirm-btn, #confirmReadBtn');
        readConfirmButtons.forEach(btn => {
            btn.style.display = 'none';
        });
        
        if (signedState) {
            signedState.style.display = 'block';
            
            // 如果有recordId，獲取詳細的簽名信息
            if (recordId) {
                await loadSignedDetails(recordId);
            }
        }
        
        
    } catch (error) {
        // 即使出錯也要顯示基本的已簽名狀態
        const signedState = document.getElementById('signedState');
        if (signedState) {
            signedState.style.display = 'block';
        }
    }
}

// 載入已簽名的詳細信息
async function loadSignedDetails(recordId) {
    try {
        
        const response = await fetch(`${API_BASE}/EAnnouncement/signed/${recordId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        
        if (response.ok) {
            const result = await response.json();
            
            if (result.success && result.data) {
                displaySignedDetails(result.data);
            } else {
            }
        } else {
        }
        
    } catch (error) {
    }
}

// 顯示簽名詳情
function displaySignedDetails(signedData) {
    try {
        
        const signedState = document.getElementById('signedState');
        if (!signedState) {
            return;
        }
        
        // 更新已簽名狀態的內容
        const userInfo = signedData.userInfo;
        
        let signedContent = `
            <div class="alert alert-success" role="alert">
                <h4 class="alert-heading">
                    <i class="fas fa-check-circle"></i> 簽名確認完成
                </h4>
                <hr>
                <p class="mb-2">
                    <strong>員工資訊：</strong><br>
                    公司：${userInfo.company}<br>
                    部門：${userInfo.department}<br>
                    員編：${userInfo.employeeId}<br>
                    姓名：${userInfo.employeeName}
                </p>`;
        
        // 如果有簽名圖片，直接在確認完成區域內顯示
        if (signedData.signatureData) {
            signedContent += `
                <div class="mt-3 text-center">
                    <strong class="d-block mb-2">您的簽名：</strong>
                    <img src="${signedData.signatureData}" 
                         alt="您的簽名" 
                         class="img-fluid" 
                         style="max-width: 300px; max-height: 150px; border: 1px solid #ddd; border-radius: 5px; background-color: #fff;">
                </div>`;
        }
        
        signedContent += `
            </div>
            
            <!-- 關閉視窗按鈕 -->
            <div class="text-center mt-4">
                <button type="button" 
                        class="btn btn-outline-secondary btn-lg" 
                        onclick="closeWindow()"
                        style="min-width: 150px;">
                    <i class="fas fa-times"></i> 關閉視窗
                </button>
            </div>
        `;
        
        signedState.innerHTML = signedContent;
        
    } catch (error) {
    }
}

// 初始化畫布
function initializeCanvas() {
    
    canvas = document.getElementById('signatureCanvas');
    if (!canvas) {
        return false;
    }
    
    ctx = canvas.getContext('2d');
    if (!ctx) {
        return false;
    }
    
    // 設定畫布尺寸 - 最大化簽名區域
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = 300; // 增加高度從200到300
    
    
    // 設定繪製樣式
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // 清空畫布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 事件監聽器
    setupCanvasEvents();
    
    return true;
}

// 設定畫布事件
function setupCanvasEvents() {
    
    if (!canvas) {
        return;
    }
    
    // 滑鼠事件
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // 觸控事件
    canvas.addEventListener('touchstart', handleTouch);
    canvas.addEventListener('touchmove', handleTouch);
    canvas.addEventListener('touchend', stopDrawing);
    
}

// 開始繪製
function startDrawing(e) {
    isDrawing = true;
    hasSignatureContent = true;
    const pos = getCanvasPosition(e);
    
    
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
}

// 繪製
function draw(e) {
    if (!isDrawing) return;
    
    const pos = getCanvasPosition(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
}

// 停止繪製
function stopDrawing() {
    if (isDrawing) {
        isDrawing = false;
        
        // 更新按鈕狀態
        updateButtonStates();
    }
}

// 處理觸控事件
function handleTouch(e) {
    e.preventDefault();
    
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent(e.type === 'touchstart' ? 'mousedown' : 
                                    e.type === 'touchmove' ? 'mousemove' : 'mouseup', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    
    canvas.dispatchEvent(mouseEvent);
}

// 獲取畫布位置
function getCanvasPosition(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
}

// 清除簽名
function clearSignature() {
    
    // 清除模態框中的簽名板
    const signaturePad = document.getElementById('signaturePad');
    if (signaturePad) {
        const ctx = signaturePad.getContext('2d');
        ctx.clearRect(0, 0, signaturePad.width, signaturePad.height);
    }
    
    // 清除一般畫布（如果存在）
    if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    // 清除簽名畫布（主畫布）
    const signatureCanvas = document.getElementById('signatureCanvas');
    if (signatureCanvas) {
        const canvasCtx = signatureCanvas.getContext('2d');
        canvasCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
    }
    
    // 重置狀態變數
    hasSignatureContent = false;
    currentSignatureData = null;
    
    // 更新按鈕狀態
    updateButtonStates();
    updateSaveButton();
    // 確保主頁面按鈕可用
    ensureSignatureButtonEnabled();
    
}

// 更新按鈕狀態
function updateButtonStates() {
    const clearButton = document.getElementById('clearButton');
    const submitButton = document.getElementById('submitButton');
    
    if (clearButton) {
        clearButton.disabled = !hasSignatureContent;
    }
    
    if (submitButton) {
        submitButton.disabled = !hasSignatureContent;
    }
}

// 提交簽名（改為開啟模態框）
function submitSignature() {
    openSignatureModal();
}

// 顯示提交成功狀態
function showSubmissionSuccess() {
    
    const signatureCard = document.getElementById('signatureCard');
    if (signatureCard) {
        signatureCard.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-check-circle text-success" style="font-size: 4rem; margin-bottom: 1rem;"></i>
                <h3 class="text-success mb-3">簽名確認完成</h3>
                <p class="mb-4">感謝您的配合，簽名已成功提交。</p>
                <div class="alert alert-success">
                    <i class="fas fa-info-circle me-2"></i>
                    您可以關閉此頁面。
                </div>
            </div>
        `;
    }
}

// 顯示載入中
function showLoading(message = '載入中...') {
    
    const existingLoading = document.getElementById('loadingIndicator');
    if (existingLoading) {
        existingLoading.remove();
    }
    
    const loading = document.createElement('div');
    loading.id = 'loadingIndicator';
    loading.className = 'position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center';
    loading.style.zIndex = '9999';
    loading.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
    loading.innerHTML = `
        <div class="text-center">
            <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mb-0">${message}</p>
        </div>
    `;
    
    document.body.appendChild(loading);
}

// 隱藏載入中
// 顯示訊息
function showMessage(message, type = 'info') {
    
    const alertClass = {
        'success': 'alert-success',
        'error': 'alert-danger',
        'warning': 'alert-warning',
        'info': 'alert-info'
    }[type] || 'alert-info';
    
    const icon = {
        'success': 'fa-check-circle',
        'error': 'fa-exclamation-circle',
        'warning': 'fa-exclamation-triangle',
        'info': 'fa-info-circle'
    }[type] || 'fa-info-circle';
    
    // 移除現有的訊息
    const existingMessage = document.getElementById('globalMessage');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // 建立新訊息
    const messageDiv = document.createElement('div');
    messageDiv.id = 'globalMessage';
    messageDiv.className = `alert ${alertClass} alert-dismissible fade show position-fixed`;
    messageDiv.style.cssText = 'top: 20px; left: 50%; transform: translateX(-50%); z-index: 10000; min-width: 300px; max-width: 500px;';
    messageDiv.innerHTML = `
        <i class="fas ${icon} me-2"></i>${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(messageDiv);
    
    // 5秒後自動移除
    setTimeout(() => {
        if (messageDiv && messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 5000);
}

// 顯示錯誤訊息
function showError(message) {
    showMessage(message, 'error');
}

// 工具函數：格式化日期
function formatDate(dateString) {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    } catch (error) {
        return dateString;
    }
}

// 工具函數：檢查是否為行動裝置
function isMobileDevice() {
    const userAgent = navigator.userAgent;
    const mobileKeywords = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i;
    const result = mobileKeywords.test(userAgent);
    
    // 額外檢查觸控支援
    const hasTouchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // 檢查螢幕尺寸（小螢幕通常是手機）
    const isSmallScreen = window.innerWidth <= 768 || window.innerHeight <= 768;
    
    const isMobile = result || (hasTouchSupport && isSmallScreen);
    
    return isMobile;
}

// 工具函數：安全的 HTML 轉義
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// 初始化頁面
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
});


// 從 URL 中獲取用戶 ID
function getUserIdFromUrl() {
    try {
        
        // 從 URL query parameters 獲取 userId 參數
        const urlParams = new URLSearchParams(window.location.search);
        let userId = urlParams.get('userId');
        
        
        if (userId) {
            return userId;
        }
        
        // 如果沒有找到，嘗試從 hash 部分獲取（備用方案）
        if (window.location.hash) {
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            userId = hashParams.get('userId');
            if (userId) {
                return userId;
            }
        }
        
        return null;
        
    } catch (error) {
        return null;
    }
}

// HTML encode 簡單防 XSS 用（僅供顯示用）
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// 初始化頁面
async function initializePage() {
    try {
        
        // 從 URL 獲取宣導 ID - 支援多種 URL 格式
        announcementId = getAnnouncementIdFromUrl();
        
        if (!announcementId) {
            // 等待一會兒再重試，有時候頁面需要時間來加載完成
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // 重新嘗試解析
            announcementId = getAnnouncementIdFromUrl();
            
            if (!announcementId) {
                
                // 檢查是否為 LIFF 登入回調
                if (window.location.search.includes('code=') && window.location.search.includes('state=')) {
                    // 重導向至用戶頁面
                    window.location.href = 'user.html';
                    return;
                }
                
                // 如果仍然沒有ID，重導向到用戶頁面
                showError('無法獲取宣導資訊，將返回主頁面...');
                setTimeout(() => {
                    window.location.href = 'user.html';
                }, 2000);
                return;
            }
        }
        
        // 載入宣導內容
        await loadAnnouncementContent();
        
        // 在內容載入完成後進行身份驗證
        try {
            await initializeAuthentication();
            
            // 檢查用戶是否已經簽名過此宣導
            if (currentUserInfo && currentUserInfo.userId) {
                const signatureStatus = await checkSignatureStatus(announcementId, currentUserInfo.userId);
                if (signatureStatus.signed) {
                    showSignedState(signatureStatus.recordId);
                } else {
                    showSignatureInterface();
                }
            }
        } catch (error) {
            // 詳細錯誤資訊，用於除錯
            // 即使身份驗證失敗，也保證內容顯示，只是不能簽名
            // 禁用簽名按鈕
            const signatureButton = document.getElementById('signatureButton');
            if (signatureButton) {
                signatureButton.disabled = true;
                signatureButton.innerHTML = '<i class="fas fa-exclamation-triangle me-2"></i>身份驗證失敗，無法簽名';
                signatureButton.className = 'btn btn-secondary btn-lg w-100';
            }
            
            let alertMessage = '用戶身份驗證失敗，您可以瀏覽內容但無法簽名：';
            if (error.message.includes('缺少')) {
                alertMessage = 'URL缺少用戶 ID 參數，無法進行身份驗證。您可以瀏覽內容但無法簽名。';
            } else if (error.message.includes('查無此用戶')) {
                alertMessage = '查無此用戶ID，請確認您是否有權限。您可以瀏覽內容但無法簽名。';
            } else if (error.message.includes('網路')) {
                alertMessage = '網路連線異常，無法驗證用戶身份。您可以瀏覽內容但無法簽名。';
            }
            
            showMessage(alertMessage, 'warning');
        }
        
        // 顯示主要內容
        hideLoading();
        
    } catch (error) {
        
        const errorMessage = error.message || '未知錯誤';
        showError(`載入失敗: ${errorMessage}`);
        
        // 確保載入狀態被隱藏
        const loadingElement = document.getElementById('loadingState');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }
}

// 初始化身份驗證（使用 URL 參數）
async function initializeAuthentication() {
    try {
        
        const urlUserId = getUserIdFromUrl();
        
        if (!urlUserId) {
            throw new Error('URL 中缺少 userId 參數');
        }
        
        
        // 驗證並獲取用戶資訊
        await fetchAndSetUserInfo(urlUserId);
        
        
    } catch (error) {
        
        throw error;
    }
}

// 獲取並設定用戶資訊
async function fetchAndSetUserInfo(verifiedUserId) {
    try {
        
        const requestBody = {
            userId: verifiedUserId,
            channelId: channelId
        };
        
        
        const response = await fetch(`${API_BASE}/User/checkUser`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        
        if (response.ok) {
            const userData = await response.json();
            
            // 設定全域用戶資訊
            currentUserInfo = {
                userId: verifiedUserId,
                name: userData.Name || userData.name || '未知用戶',
                displayName: userData.Name || userData.name || '未知用戶',
                company: userData.Company || userData.company || '未知公司',
                dept: userData.Dept || userData.dept || '未知部門',
                empId: userData.EmpId || userData.empId || '',
                source: 'url'
            };
            
            
        } else {
            const errorText = await response.text();
            
            if (errorText.includes('查無此用戶')) {
                throw new Error('查無此用戶');
            } else {
                throw new Error('網路連線失敗');
            }
        }
        
    } catch (error) {
        throw error;
    }
}

// 載入宣導內容
async function loadAnnouncementContent() {
    
    try {
        // 顯示載入狀態
        const loadingElement = document.getElementById('loadingState');
        if (loadingElement) {
            loadingElement.style.display = 'flex';
        }
        
        // 驗證 announcementId
        if (!announcementId) {
            throw new Error('宣導 ID 為空或無效');
        }
        
        const apiUrl = `${API_BASE}/EAnnouncement/${announcementId}`;
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        
        if (result.success && result.data) {
            currentAnnouncement = result.data;
            
            
            // 檢查是否為封存專案
            if (currentAnnouncement.isArchived) {
                showMessage('此宣導專案已封存', 'warning');
                return;
            }
            
            // 更新頁面內容
            const titleElement = document.getElementById('announcementTitle');
            if (titleElement) {
                titleElement.textContent = currentAnnouncement.title;
            }
            
            const docTypeElement = document.getElementById('documentType');
            if (docTypeElement) {
                docTypeElement.textContent = currentAnnouncement.documentType;
            }
            
            const publishInfoElement = document.getElementById('publishInfo');
            if (publishInfoElement) {
                publishInfoElement.textContent = `${getPublishUnit()} | ${currentAnnouncement.publishDate}`;
            }
            
            // 渲染內容區塊
            const contentBlocks = currentAnnouncement.contentBlocks;
            if (Array.isArray(contentBlocks)) {
                const contentArea = document.getElementById('contentArea');
                if (contentArea) {
                    const generatedContent = await generateContent(contentBlocks);
                    contentArea.innerHTML = generatedContent;
                } else {
                    throw new Error('找不到內容區域元素');
                }
            }
            
            // 顯示主要內容
            showMainContent();
            
        } else {
            throw new Error(result.message || '載入宣導內容失敗');
        }
        
    } catch (error) {
        
        throw error;
    }
}

// 顯示主要內容
function showMainContent() {
    hideLoading();
    const mainContent = document.getElementById('mainContent');
    if (mainContent) {
        mainContent.style.display = 'block';
    }
}

// 隱藏載入狀態
function hideLoading() {
    
    const loadingElement = document.getElementById('loadingState');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    } else {
    }
}

// 顯示錯誤訊息
function showError(message) {
    hideLoading();
    const errorElement = document.getElementById('errorState');
    const errorMessage = document.getElementById('errorMessage');
    
    if (errorElement && errorMessage) {
        errorMessage.textContent = message;
        errorElement.style.display = 'block';
    } else {
        // 使用 showMessage 來顯示錯誤，避免使用 alert
        showMessage(message, 'error');
    }
}

// 顯示一般訊息
function showMessage(message, type = 'info') {
    // 可以擴展為 toast 通知或其他UI組件
    const alertClass = type === 'warning' ? 'alert-warning' : type === 'error' ? 'alert-danger' : 'alert-info';
    
    // 創建臨時訊息元素
    const messageDiv = document.createElement('div');
    messageDiv.className = `alert ${alertClass} alert-dismissible fade show position-fixed`;
    messageDiv.style.top = '20px';
    messageDiv.style.right = '20px';
    messageDiv.style.zIndex = '9999';
    messageDiv.style.maxWidth = '400px';
    messageDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(messageDiv);
    
    // 5秒後自動移除
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.parentNode.removeChild(messageDiv);
        }
    }, 5000);
}

// 獲取發佈單位
function getPublishUnit() {
    if (currentAnnouncement && currentAnnouncement.customPublishUnit) {
        return currentAnnouncement.customPublishUnit;
    } else if (currentAnnouncement && currentAnnouncement.publishUnit) {
        return currentAnnouncement.publishUnit;
    } else {
        return '未知單位';
    }
}

// 獲取目標部門
function getTargetDepartments() {
    if (currentAnnouncement) {
        if (typeof currentAnnouncement.targetDepartments === 'string') {
            try {
                return JSON.parse(currentAnnouncement.targetDepartments).join('、');
            } catch {
                return currentAnnouncement.targetDepartments;
            }
        } else if (Array.isArray(currentAnnouncement.targetDepartments)) {
            return currentAnnouncement.targetDepartments.join('、');
        }
    }
    return '所有部門';
}

// 生成內容HTML
async function generateContent(contentBlocks) {
    let html = '';
    
    for (const block of contentBlocks) {
        if (block.type === 'text' && (block.text || block.content)) {
            const textContent = block.text || block.content;
            html += `<div class="content-block text-block mb-3">
                <p class="mb-0">${textContent.replace(/\n/g, '<br>')}</p>
            </div>`;
        }
        else if (block.type === 'image' && block.content) {
            html += `<div class="content-block image-block mb-3 text-center">
                <img src="${block.content}" 
                     class="img-fluid content-image clickable-image" 
                     alt="宣導圖片" 
                     style="max-width: 100%; height: auto; border-radius: 8px; cursor: pointer;" 
                     onclick="openImageModal('${block.content}', '宣導圖片')">
            </div>`;
        }
        else if (block.type === 'html' && block.content) {
            try {
                // 解析 JSON 格式的連結
                let linkData;
                let isDirectHtml = false;
                
                try {
                    linkData = JSON.parse(block.content);
                } catch {
                    // 如果解析失敗，檢查是否為直接URL
                    if (block.content.startsWith('http')) {
                        linkData = { url: block.content, title: '外部連結' };
                    } else {
                        // 直接作為HTML內容處理
                        isDirectHtml = true;
                    }
                }
                
                if (isDirectHtml) {
                    html += `<div class="content-block html-block mb-3">
                        <div class="border rounded p-3 position-relative" style="background-color: #f8f9fa;">
                            <div class="d-flex justify-content-end mb-2">
                                <button type="button" 
                                        class="btn btn-outline-primary btn-sm me-1" 
                                        onclick="openHtmlModal(\`${block.content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`, 'HTML 內容')"
                                        title="放大檢視">
                                    <i class="fas fa-search-plus"></i>
                                </button>
                                <button type="button" 
                                        class="btn btn-outline-secondary btn-sm" 
                                        onclick="openHtmlInNewWindow(\`${block.content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)"
                                        title="新視窗開啟">
                                    <i class="fas fa-external-link-alt"></i>
                                </button>
                            </div>
                            ${block.content}
                        </div>
                    </div>`;
                } else if (linkData && linkData.url) {
                    // 創建iframe來載入網頁內容而不是外部連結
                    html += `<div class="content-block html-iframe-block mb-3">
                        <div class="border rounded position-relative" style="background-color: #f8f9fa;">
                            <!-- 浮動控制按鈕 -->
                            <div class="iframe-floating-controls" style="position: sticky; top: 10px; right: 10px; float: right; z-index: 1000; background: rgba(255,255,255,0.95); border-radius: 8px; padding: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); backdrop-filter: blur(5px); margin-bottom: 10px;">
                                <div class="btn-group" role="group">
                                    <button type="button" 
                                            class="btn btn-primary btn-sm" 
                                            onclick="openUrlInModal('${linkData.url}', '${escapeHtml(linkData.title || '網頁內容').replace(/'/g, '\\\'')}')"
                                            title="放大檢視">
                                        <i class="fas fa-search-plus"></i>
                                    </button>
                                    <button type="button" 
                                            class="btn btn-secondary btn-sm" 
                                            onclick="window.open('${linkData.url}', '_blank')"
                                            title="新視窗開啟">
                                        <i class="fas fa-external-link-alt"></i>
                                    </button>
                                </div>
                            </div>
                            ${linkData.title ? `
                            <div class="d-flex justify-content-between align-items-center p-2 bg-light border-bottom" style="position: relative; z-index: 100;">
                                <small class="text-muted">
                                    <i class="fas fa-globe me-1"></i>
                                    ${escapeHtml(linkData.title)}
                                </small>
                            </div>
                            ` : ''}
                            <div class="iframe-container position-relative" style="height: 90vh; width: 100%; margin: 0 auto; overflow: hidden !important;">
                                <iframe src="${linkData.url}" 
                                        style="width: 100%; height: 100%; border: none; transform: scale(1.02) translateY(-40px); transform-origin: top center;" 
                                        frameborder="0"
                                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
                                        loading="lazy"
                                        onload="hideIframeUrlBars()">
                                        loading="lazy">
                                    <div class="p-3 text-center">
                                        <p>您的瀏覽器不支援 iframe，請點擊以下連結：</p>
                                        <a href="${linkData.url}" target="_blank" class="btn btn-primary">
                                            開啟網頁
                                        </a>
                                    </div>
                                </iframe>
                            </div>
                        </div>
                    </div>`;
                }
            } catch (error) {
                html += `<div class="content-block error-block mb-3">
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        無法載入此內容區塊
                    </div>
                </div>`;
            }
        }
        else if (block.type === 'youtube' && block.content) {
            // 支援兩種情況：1) block.content 為 JSON（包含 url/videoId/title） 2) block.content 為純 URL
            let videoUrl = '';
            let videoId = '';
            let videoTitle = 'YouTube 影片';

            // 先嘗試解析 JSON
            try {
                const youtubeData = JSON.parse(block.content);
                if (youtubeData.url) videoUrl = youtubeData.url;
                if (youtubeData.videoId) videoId = youtubeData.videoId;
                if (youtubeData.title) videoTitle = youtubeData.title;
            } catch (e) {
                // 不是 JSON，當作 URL 處理
                videoUrl = block.content;
            }

            // 如果尚未取得 videoId，嘗試從 URL 擷取
            if (!videoId && videoUrl) {
                // 常見的 YouTube 連結格式
                // https://www.youtube.com/watch?v=VIDEOID
                // https://youtu.be/VIDEOID
                // https://www.youtube.com/embed/VIDEOID
                try {
                    const urlObj = new URL(videoUrl);
                    if (urlObj.hostname.includes('youtu.be')) {
                        videoId = urlObj.pathname.slice(1);
                    } else if (urlObj.searchParams && urlObj.searchParams.get('v')) {
                        videoId = urlObj.searchParams.get('v');
                    } else if (urlObj.pathname.includes('/embed/')) {
                        const parts = urlObj.pathname.split('/');
                        videoId = parts[parts.indexOf('embed') + 1] || '';
                    }
                } catch (e) {
                    // 如果 URL 解析失敗，嘗試用正則
                    const match = block.content.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
                    if (match && match[1]) videoId = match[1];
                }
            }

            // 優先使用 videoId 來建立嵌入 URL，否則退回到原始 URL
            const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : (videoUrl || '');

            if (embedUrl) {
                html += `<div class="content-block youtube-block mb-3">
                    <div class="border rounded p-3" style="background-color: #fff3cd;">
                        <i class="fab fa-youtube text-danger me-2"></i>
                        <strong>YouTube 影片：</strong> ${escapeHtml(videoTitle)}
                        <div class="ratio ratio-16x9 mt-2">
                            <iframe src="${embedUrl}" title="${escapeHtml(videoTitle)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                        </div>
                    </div>
                </div>`;
            } else {
                // 無法取得可嵌入的影片，回退顯示可點連結
                const displayUrl = videoUrl || block.content;
                html += `<div class="content-block youtube-block mb-3">
                    <div class="border rounded p-3" style="background-color: #fff3cd;">
                        <i class="fab fa-youtube text-danger me-2"></i>
                        <strong>YouTube 影片：</strong>
                        <a href="${displayUrl}" target="_blank" class="text-primary">${displayUrl}<i class="fas fa-external-link-alt ms-1"></i></a>
                    </div>
                </div>`;
            }
        }
    }
    
    return html;
}

// 初始化簽名板
function initializeSignaturePad() {
    canvas = document.getElementById('signatureCanvas');
    if (!canvas) {
        return;
    }
    
    ctx = canvas.getContext('2d');
    
    // 設定 canvas 尺寸
    resizeCanvas();
    
    // 設定繪圖樣式
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // 綁定事件
    bindCanvasEvents();
    
    // 監聽視窗大小改變
    window.addEventListener('resize', resizeCanvas);
}

// 調整 Canvas 尺寸 - 手機優化
function resizeCanvas() {
    if (!canvas) return;
    
    const container = canvas.parentElement;
    if (!container) return;
    
    // 獲取容器實際寬度
    const containerWidth = container.offsetWidth;
    
    // 手機版使用更大的簽名高度
    const isMobile = window.innerWidth <= 768;
    const containerHeight = isMobile ? 350 : Math.min(300, window.innerHeight * 0.3);
    
    canvas.width = containerWidth;
    canvas.height = containerHeight;
    
    // 重新設定繪圖樣式（調整大小後會重置）
    if (ctx) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = isMobile ? 3 : 2; // 手機版用更粗的線條
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }
}

// 綁定 Canvas 事件
function bindCanvasEvents() {
    if (!canvas) return;
    
    // 防止簽名板被移動的全域事件處理
    const preventDefaultHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
    };
    
    // 防止滑動和縮放
    canvas.addEventListener('touchstart', (e) => {
        if (e.target === canvas) {
            e.preventDefault();
            e.stopPropagation();
            startDrawing(e);
        }
    }, { passive: false });
    
    canvas.addEventListener('touchmove', (e) => {
        if (e.target === canvas) {
            e.preventDefault();
            e.stopPropagation();
            draw(e);
        }
    }, { passive: false });
    
    canvas.addEventListener('touchend', (e) => {
        if (e.target === canvas) {
            e.preventDefault();
            e.stopPropagation();
            stopDrawing(e);
        }
    }, { passive: false });
    
    // 滑鼠事件
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // 觸控事件
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
}

// 開始繪圖
function startDrawing(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    
    hasSignatureContent = true;
    updateSignatureButton();
}

// 繪圖
function draw(e) {
    if (!isDrawing) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
}

// 停止繪圖
function stopDrawing() {
    if (isDrawing) {
        isDrawing = false;
        ctx.beginPath();
    }
}

// 觸控開始
function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
}

// 觸控移動
function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
}

// 觸控結束
function handleTouchEnd(e) {
    e.preventDefault();
    const mouseEvent = new MouseEvent('mouseup', {});
    canvas.dispatchEvent(mouseEvent);
}

// 更新簽名按鈕狀態
function updateSignatureButton() {
    const button = document.getElementById('signatureButton');
    if (button) {
        // 「我已閱讀」按鈕應該始終可用，不依賴簽名狀態
        // 除非是身份驗證失敗的情況
        if (!button.innerHTML.includes('身份驗證失敗')) {
            button.disabled = false;
        }
    }
}

// 確保按鈕狀態正確的輔助函數
function ensureSignatureButtonEnabled() {
    const button = document.getElementById('signatureButton');
    if (button && !button.innerHTML.includes('身份驗證失敗')) {
        button.disabled = false;
    }
}

// 提交簽名
async function submitSignature() {
    try {
        if (!hasSignatureContent) {
            showMessage('請先完成簽名', 'warning');
            return;
        }
        
        if (!currentUserInfo) {
            showMessage('用戶身份驗證失敗，無法提交簽名', 'error');
            return;
        }
        
        // 獲取簽名資料
        const signatureData = canvas.toDataURL('image/png');
        
        // 檢測是否為行動裝置和橫向簽名
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isLandscape = window.innerWidth > window.innerHeight;
        
        // 準備提交資料
        const submitData = {
            announcementId: announcementId,
            userId: currentUserInfo.userId,
            signatureData: signatureData,
            isMobileDevice: isMobile,
            isLandscapeSignature: isMobile && isLandscape
        };
        
        // 顯示載入狀態
        const button = document.getElementById('signatureButton');
        if (button) {
            button.disabled = true;
            button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>提交中...';
        }
        
        // 發送到後端
        const response = await fetch(`${API_BASE}/EAnnouncement/signature`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(submitData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('簽名提交成功！', 'success');
            
            // 獲取新建立的記錄ID並顯示已簽名狀態
            const newRecordId = result.data?.id;
            setTimeout(() => {
                showSignedState(newRecordId);
            }, 1000);
            
        } else {
            throw new Error(result.message || '提交失敗');
        }
        
    } catch (error) {
        showMessage(`提交失敗：${error.message}`, 'error');
        
        // 恢復按鈕狀態
        const button = document.getElementById('signatureButton');
        if (button) {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-signature me-2"></i>提交簽名';
        }
    }
}

// 返回列表
function goBackToList() {
    window.location.href = 'user.html';
}

// 綁定全域函數到 window 對象（供 HTML 調用）
window.clearSignature = clearSignature;
window.submitSignature = submitSignature;
window.goBackToList = goBackToList;

// 圖片 Modal 相關函數
window.openImageModal = openImageModal;
window.downloadImage = downloadImage;

// 模態框相關函數
window.openSignatureModal = openSignatureModal;
window.closeSignatureModal = closeSignatureModal;
window.saveSignature = saveSignature;
window.enterLandscapeMode = enterLandscapeMode;
window.exitLandscapeMode = exitLandscapeMode;
window.showNormalSignature = showNormalSignature;
window.clearLandscapeSignature = clearLandscapeSignature;
window.saveLandscapeSignature = saveLandscapeSignature;
window.confirmSignature = confirmSignature;
window.cancelPreview = cancelPreview;
window.exportToPDF = exportToPDF;
window.closeWindow = closeWindow;
window.showCompleteDocumentPreview = showCompleteDocumentPreview;

// 模態框相關函數實作
function openSignatureModal() {
    
    if (!currentUserInfo) {
        showMessage('用戶身份驗證失敗，無法簽名', 'error');
        return;
    }
    
    // 所有裝置都使用相同的簽名模態框
    const signatureModalElement = document.getElementById('signatureModal');
    if (!signatureModalElement) {
        showMessage('無法開啟簽名視窗，請重新整理頁面', 'error');
        return;
    }
    
    // 顯示簽名模態框
    try {
        const signatureModal = new bootstrap.Modal(signatureModalElement);
        signatureModal.show();
        
        // 延遲一點再顯示一般簽名模式，避免 DOM 還沒準備好
        setTimeout(() => {
            showNormalSignature();
        }, 100);
        
    } catch (error) {
        showMessage('開啟簽名視窗失敗，請確認 Bootstrap 已正確載入', 'error');
    }
}

function closeSignatureModal() {
    
    const signatureModalElement = document.getElementById('signatureModal');
    if (!signatureModalElement) {
        return;
    }
    
    try {
        const signatureModal = bootstrap.Modal.getInstance(signatureModalElement);
        if (signatureModal) {
            signatureModal.hide();
        }
        
        // 確保主頁面的「我已閱讀」按鈕保持可用
        ensureSignatureButtonEnabled();
    } catch (error) {
        console.error('關閉簽名模態框時發生錯誤:', error);
    }
}

function showNormalSignature() {
    
    // 安全地隱藏簽名選擇區域（如果存在）
    const signatureSelection = document.getElementById('signatureSelection');
    if (signatureSelection) {
        signatureSelection.style.display = 'none';
    }
    
    // 確保簽名模態框內容可見 - 使用 mobile-signature-container
    const mobileSignatureContainer = document.querySelector('.mobile-signature-container');
    if (mobileSignatureContainer) {
        mobileSignatureContainer.style.display = 'block';
    }
    
    // 初始化一般簽名板
    initializeNormalSignaturePad();
}

function initializeNormalSignaturePad() {
    
    const canvas = document.getElementById('signaturePad');
    if (!canvas) {
        return false;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        showMessage('您的瀏覽器不支援 Canvas 繪圖功能', 'error');
        return;
    }
    
    // 設定畫布尺寸 - 完全最大化寬度
    const container = canvas.parentElement;
    const containerWidth = container ? container.offsetWidth : window.innerWidth;
    // 使用容器的完整寬度，只保留5px的極小邊距
    const canvasWidth = Math.max(containerWidth - 5, window.innerWidth - 30); 
    canvas.width = canvasWidth;
    canvas.height = 350; // 保持高度不變
    
    // 確保畫布樣式也是100%寬度
    canvas.style.width = '100%';
    canvas.style.maxWidth = 'none';
    
    
    // 設定繪製樣式
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // 清空畫布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 重置簽名狀態
    hasSignatureContent = false;
    
    // 設定事件監聽器
    setupSignaturePadEvents(canvas, ctx);
    
    // 添加視窗大小改變時的響應式調整
    const resizeHandler = () => {
        const container = canvas.parentElement;
        const containerWidth = container ? container.offsetWidth : window.innerWidth;
        const newCanvasWidth = Math.max(containerWidth - 5, window.innerWidth - 30);
        
        // 只有當寬度真的改變時才調整
        if (Math.abs(canvas.width - newCanvasWidth) > 10) {
            // 保存當前繪製內容
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            canvas.width = newCanvasWidth;
            canvas.style.width = '100%';
            // 恢復繪製內容
            ctx.putImageData(imageData, 0, 0);
        }
    };
    
    // 綁定視窗調整事件
    window.addEventListener('resize', resizeHandler);
    window.addEventListener('orientationchange', resizeHandler);
    
    return true;
}

function setupSignaturePadEvents(canvas, ctx) {
    let isDrawing = false;
    
    // 滑鼠事件
    canvas.addEventListener('mousedown', function(e) {
        isDrawing = true;
        hasSignatureContent = true;
        const pos = getCanvasPos(canvas, e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        updateSaveButton();
    });
    
    canvas.addEventListener('mousemove', function(e) {
        if (!isDrawing) return;
        const pos = getCanvasPos(canvas, e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    });
    
    canvas.addEventListener('mouseup', function() {
        isDrawing = false;
    });
    
    // 觸控事件
    canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    });
    
    canvas.addEventListener('touchmove', function(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    });
    
    canvas.addEventListener('touchend', function(e) {
        e.preventDefault();
        const mouseEvent = new MouseEvent('mouseup', {});
        canvas.dispatchEvent(mouseEvent);
    });
}

function getCanvasPos(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
}

function updateSaveButton() {
    const saveBtn = document.getElementById('saveSignatureBtn');
    if (saveBtn) {
        saveBtn.disabled = !hasSignatureContent;
        if (hasSignatureContent) {
            saveBtn.style.display = 'block';
        } else {
            saveBtn.style.display = 'none';
        }
    }
}

function saveSignature() {
    
    if (!hasSignatureContent) {
        showMessage('請先完成簽名', 'warning');
        return;
    }
    
    // 獲取簽名數據
    const canvas = document.getElementById('signaturePad');
    if (canvas) {
        const signatureData = canvas.toDataURL('image/png');
        
        // 關閉簽名模態框
        closeSignatureModal();
        
        // 延遲顯示完整文件預覽
        setTimeout(() => {
            showCompleteDocumentPreview(signatureData);
        }, 500);
    }
}

async function actuallySubmitSignature() {
    try {
        
        if (!currentSignatureData) {
            showMessage('簽名數據遺失', 'error');
            return;
        }
        
        if (!currentUserInfo) {
            showMessage('用戶資訊缺失，無法提交簽名', 'error');
            return;
        }
        
        // 檢測裝置和螢幕方向
        const isMobile = isMobileDevice();
        const isCurrentlyLandscape = window.innerWidth > window.innerHeight;
        
        const submitData = {
            announcementId: announcementId,
            userId: currentUserInfo.userId,
            signatureData: currentSignatureData,
            isLandscapeSignature: false, // 一般簽名標記為直式 (false)
            isMobileDevice: isMobile
        };
        
        const response = await fetch(`${API_BASE}/EAnnouncement/signature`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submitData)
        });
        
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showMessage('簽名確認完成！感謝您的配合。', 'success');
            
            // 清除預覽狀態並重新整理頁面
            setTimeout(() => {
                // 清除所有簽名相關的暫存數據
                currentSignatureData = null;
                
                // 重新載入頁面以顯示正確的簽名完成狀態
                window.location.reload();
            }, 1500);
            
        } else {
            throw new Error(result.message || '提交失敗');
        }
        
    } catch (error) {
        showMessage(`提交失敗: ${error.message}`, 'error');
    }
}

// 其他模態框函數的實作
// 手機版全屏橫式簽名模式
async function enterFullscreenLandscapeMode() {
    
    // 強制設定螢幕為橫向
    await forceScreenOrientation('landscape-primary');
    
    // 創建全屏橫式簽名界面
    const fullscreenSignatureHTML = `
        <div id="fullscreenSignatureOverlay" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #f8f9fa;
            z-index: 9999;
            display: flex;
            overflow: hidden;
        ">
            <!-- 簽名區域（佔9/10） -->
            <div style="
                width: 90%;
                height: 100%;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                padding: 20px;
                box-sizing: border-box;
            ">
                <h5 style="margin-bottom: 20px; text-align: center; color: #333;">
                    請在下方區域簽名
                </h5>
                <canvas id="fullscreenLandscapeSignaturePad" 
                        style="
                            border: 2px solid #dee2e6;
                            border-radius: 8px;
                            background-color: #fff;
                            cursor: crosshair;
                            touch-action: none;
                            width: 100%;
                            max-width: 600px;
                            height: 60%;
                            max-height: 300px;
                        ">
                </canvas>
            </div>
            
            <!-- 按鈕區域（佔1/5，放在右側） -->
            <div style="
                width: 20%;
                height: 100%;
                background: #e9ecef;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                gap: 20px;
                padding: 20px 10px;
                box-sizing: border-box;
            ">
                <button type="button" 
                        class="btn btn-outline-secondary btn-lg" 
                        onclick="clearFullscreenLandscapeSignature()"
                        style="
                            width: 100%;
                            max-width: 120px;
                            writing-mode: horizontal-tb;
                            font-size: 16px;
                        ">
                    <i class="fas fa-eraser"></i><br>清除
                </button>
                
                <button type="button" 
                        class="btn btn-success btn-lg" 
                        onclick="confirmFullscreenLandscapeSignature()"
                        id="fullscreenConfirmBtn"
                        disabled
                        style="
                            width: 100%;
                            max-width: 120px;
                            writing-mode: horizontal-tb;
                            font-size: 16px;
                        ">
                    <i class="fas fa-check"></i><br>確認
                </button>
                
                <button type="button" 
                        class="btn btn-outline-danger btn-lg" 
                        onclick="exitFullscreenLandscapeMode()"
                        style="
                            width: 100%;
                            max-width: 120px;
                            writing-mode: horizontal-tb;
                            font-size: 16px;
                        ">
                    <i class="fas fa-times"></i><br>取消
                </button>
            </div>
        </div>
    `;
    
    // 添加到 body
    document.body.insertAdjacentHTML('beforeend', fullscreenSignatureHTML);
    
    // 延遲初始化全屏簽名畫布，確保DOM完全準備好
    setTimeout(() => {
        initializeFullscreenLandscapeSignaturePad();
    }, 300);
    
}

function enterLandscapeMode() {
    
    // 檢查是否為行動裝置
    if (!isMobileDevice()) {
        showMessage('橫式簽名僅適用於行動裝置', 'warning');
        return;
    }
    
    // 關閉一般簽名模態框
    closeSignatureModal();
    
    // 顯示橫式簽名模態框
    setTimeout(() => {
        const landscapeModal = new bootstrap.Modal(document.getElementById('landscapeSignatureModal'));
        landscapeModal.show();
        
        // 檢查螢幕方向
        setTimeout(() => {
            checkScreenOrientation();
            initializeLandscapeSignaturePad();
        }, 300);
    }, 300);
}

// 檢查螢幕方向並提示用戶
function checkScreenOrientation() {
    const isLandscape = window.innerWidth > window.innerHeight;
    const orientationTip = document.getElementById('orientationTip');
    
    if (!isLandscape) {
        showMessage('請將手機旋轉為橫式以獲得最佳簽名體驗', 'info');
    } else {
    }
    
    // 監聽方向變化
    window.addEventListener('resize', function() {
        const newIsLandscape = window.innerWidth > window.innerHeight;
        if (newIsLandscape !== isLandscape) {
            if (newIsLandscape) {
                // 重新初始化畫布以適應新尺寸
                setTimeout(() => {
                    initializeLandscapeSignaturePad();
                }, 100);
            }
        }
    });
}

function exitLandscapeMode() {
    
    const landscapeModal = bootstrap.Modal.getInstance(document.getElementById('landscapeSignatureModal'));
    if (landscapeModal) {
        landscapeModal.hide();
    }
    
    // 回到一般簽名模式
    setTimeout(() => {
        openSignatureModal();
    }, 300);
}

function initializeLandscapeSignaturePad() {
    
    const canvas = document.getElementById('landscapeSignaturePad');
    if (!canvas) {
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    // 獲取畫布容器的實際尺寸
    const rect = canvas.getBoundingClientRect();
    
    // 設定畫布內部尺寸等於顯示尺寸，避免座標偏移
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    
    // 設定繪製樣式
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3; // 橫式簽名用較粗的線
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // 清空畫布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 設定事件監聽器
    setupLandscapeSignaturePadEvents(canvas, ctx);
    
}

function setupLandscapeSignaturePadEvents(canvas, ctx) {
    let isDrawing = false;
    
    // 滑鼠事件
    canvas.addEventListener('mousedown', function(e) {
        isDrawing = true;
        hasSignatureContent = true;
        const pos = getCanvasPos(canvas, e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        updateLandscapeSaveButton();
    });
    
    canvas.addEventListener('mousemove', function(e) {
        if (!isDrawing) return;
        const pos = getCanvasPos(canvas, e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    });
    
    canvas.addEventListener('mouseup', function() {
        if (isDrawing) {
            isDrawing = false;
        }
    });
    
    // 觸控事件（手機專用）
    canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        const touch = e.touches[0];
        isDrawing = true;
        hasSignatureContent = true;
        
        const rect = canvas.getBoundingClientRect();
        const pos = {
            x: (touch.clientX - rect.left) * (canvas.width / rect.width),
            y: (touch.clientY - rect.top) * (canvas.height / rect.height)
        };
        
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        updateLandscapeSaveButton();
    });
    
    canvas.addEventListener('touchmove', function(e) {
        e.preventDefault();
        if (!isDrawing) return;
        
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const pos = {
            x: (touch.clientX - rect.left) * (canvas.width / rect.width),
            y: (touch.clientY - rect.top) * (canvas.height / rect.height)
        };
        
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    });
    
    canvas.addEventListener('touchend', function(e) {
        e.preventDefault();
        if (isDrawing) {
            isDrawing = false;
        }
    });
    
    // 防止頁面滾動
    canvas.addEventListener('touchmove', function(e) {
        e.preventDefault();
    }, { passive: false });
}

function updateLandscapeSaveButton() {
    const saveBtn = document.getElementById('saveLandscapeSignatureBtn');
    if (saveBtn) {
        saveBtn.disabled = !hasSignatureContent;
        saveBtn.style.display = hasSignatureContent ? 'block' : 'none';
    }
}

function clearLandscapeSignature() {
    
    const canvas = document.getElementById('landscapeSignaturePad');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasSignatureContent = false;
        updateLandscapeSaveButton();
    }
}

function saveLandscapeSignature() {
    
    if (!hasSignatureContent) {
        showMessage('請先完成簽名', 'warning');
        return;
    }
    
    // 獲取橫式簽名數據
    const canvas = document.getElementById('landscapeSignaturePad');
    if (canvas) {
        const signatureData = canvas.toDataURL('image/png');
        
        // 關閉橫式模態框
        exitLandscapeMode();
        
        // 延遲顯示完整文件預覽
        setTimeout(() => {
            showCompleteDocumentPreview(signatureData);
        }, 500);
    }
}

async function actuallySubmitLandscapeSignature() {
    try {
        
        if (!currentSignatureData) {
            showMessage('簽名數據遺失', 'error');
            return;
        }
        
        if (!currentUserInfo) {
            showMessage('用戶資訊缺失，無法提交簽名', 'error');
            return;
        }
        
        // 檢測螢幕方向
        const isCurrentlyLandscape = window.innerWidth > window.innerHeight;
        const isMobile = isMobileDevice();
        
        const submitData = {
            announcementId: announcementId,
            userId: currentUserInfo.userId,
            signatureData: currentSignatureData,
            isLandscapeSignature: true, // 橫式簽名標記為 true
            isMobileDevice: isMobile
        };
        
        // 顯示載入狀態
        showMessage('正在提交橫式簽名...', 'info');
        
        const response = await fetch(`${API_BASE}/EAnnouncement/signature`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submitData)
        });
        
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showMessage('橫式簽名確認完成！感謝您的配合。', 'success');
            
            // 獲取新建立的記錄ID並顯示已簽名狀態
            const newRecordId = result.data?.id;
            setTimeout(() => {
                showSignedState(newRecordId);
            }, 1000);
            
        } else {
            throw new Error(result.message || '橫式簽名提交失敗');
        }
        
    } catch (error) {
        showMessage(`橫式簽名提交失敗: ${error.message}`, 'error');
    }
}

function confirmSignature() {
    
    if (!hasSignatureContent) {
        showMessage('請先完成簽名', 'warning');
        return;
    }
    
    // 獲取簽名數據
    const canvas = document.getElementById('signaturePad');
    if (canvas) {
        const signatureData = canvas.toDataURL('image/png');
        
        // 關閉簽名模態框
        closeSignatureModal();
        
        // 延遲顯示完整文件預覽
        setTimeout(() => {
            showCompleteDocumentPreview(signatureData);
        }, 500);
    } else {
        showMessage('無法獲取簽名數據', 'error');
    }
}

function cancelPreview() {
    
    // 關閉預覽模態框
    const previewModal = document.getElementById('previewModal');
    if (previewModal) {
        const bsPreviewModal = bootstrap.Modal.getInstance(previewModal);
        if (bsPreviewModal) {
            bsPreviewModal.hide();
        }
    }
    
    // 重新開啟簽名模態框讓用戶重新簽名
    setTimeout(() => {
        openSignatureModal();
    }, 500);
}

function exportToPDF() {
    showMessage('PDF 匯出功能開發中', 'info');
}

// 圖片放大 Modal 功能
function openImageModal(imageSrc, imageAlt = '圖片') {
    
    // 檢查是否已存在 modal
    let imageModal = document.getElementById('imageModal');
    
    if (!imageModal) {
        // 創建 modal HTML
        const modalHTML = `
            <div class="modal fade" id="imageModal" tabindex="-1" aria-labelledby="imageModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="imageModalLabel">圖片檢視</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="關閉"></button>
                        </div>
                        <div class="modal-body text-center p-0">
                            <img id="modalImage" src="" alt="" class="img-fluid" style="max-width: 100%; height: auto;">
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">關閉</button>
                            <button type="button" class="btn btn-primary" onclick="downloadImage()">
                                <i class="fas fa-download"></i> 下載圖片
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 添加到 body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        imageModal = document.getElementById('imageModal');
        
    }
    
    // 設置圖片來源和替代文字
    const modalImage = document.getElementById('modalImage');
    const modalTitle = document.getElementById('imageModalLabel');
    
    if (modalImage) {
        modalImage.src = imageSrc;
        modalImage.alt = imageAlt;
        currentModalImageSrc = imageSrc; // 保存當前圖片來源用於下載
    }
    
    if (modalTitle) {
        modalTitle.textContent = imageAlt;
    }
    
    // 顯示 modal
    if (window.bootstrap && bootstrap.Modal) {
        const modal = new bootstrap.Modal(imageModal);
        modal.show();
    } else {
        if (window.$ && $.fn.modal) {
            $(imageModal).modal('show');
        } else {
            // 備用方案：簡單的全螢幕顯示
            showFullscreenImage(imageSrc, imageAlt);
        }
    }
}

// 備用的全螢幕圖片顯示
function showFullscreenImage(imageSrc, imageAlt) {
    const fullscreenDiv = document.createElement('div');
    fullscreenDiv.id = 'fullscreenImageOverlay';
    fullscreenDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        cursor: pointer;
    `;
    
    const img = document.createElement('img');
    img.src = imageSrc;
    img.alt = imageAlt;
    img.style.cssText = `
        max-width: 90%;
        max-height: 90%;
        object-fit: contain;
    `;
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
        position: absolute;
        top: 20px;
        right: 30px;
        background: none;
        border: none;
        color: white;
        font-size: 30px;
        cursor: pointer;
        z-index: 10000;
    `;
    
    closeBtn.onclick = () => document.body.removeChild(fullscreenDiv);
    fullscreenDiv.onclick = (e) => {
        if (e.target === fullscreenDiv) {
            document.body.removeChild(fullscreenDiv);
        }
    };
    
    fullscreenDiv.appendChild(img);
    fullscreenDiv.appendChild(closeBtn);
    document.body.appendChild(fullscreenDiv);
    
}

// 下載圖片功能
function downloadImage() {
    if (!currentModalImageSrc) {
        showMessage('無法下載圖片', 'error');
        return;
    }
    
    
    try {
        // 創建下載連結
        const link = document.createElement('a');
        link.href = currentModalImageSrc;
        link.download = `宣導圖片_${new Date().getTime()}.png`;
        
        // 觸發下載
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showMessage('圖片下載開始', 'success');
        
    } catch (error) {
        showMessage('下載失敗，請嘗試右鍵點擊圖片另存', 'error');
    }
}

// 全域變數保存當前 modal 中的圖片來源
let currentModalImageSrc = null;

// 初始化全屏橫式簽名畫布
function initializeFullscreenLandscapeSignaturePad() {
    
    const canvas = document.getElementById('fullscreenLandscapeSignaturePad');
    if (!canvas) {
        return;
    }
    
    // 等待一個渲染週期，確保CSS樣式已應用
    requestAnimationFrame(() => {
        // 使用原生Canvas API而不是SignaturePad庫
        const ctx = canvas.getContext('2d');
        
        // 強制重新計算畫布尺寸
        resizeFullscreenCanvas();
        
        // 設定繪製樣式
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // 清空畫布並設定白色背景
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 延遲設定畫布事件，確保尺寸穩定
        setTimeout(() => {
            setupFullscreenCanvasEvents(canvas, ctx);
        }, 50);
    });
}

// 設定全屏簽名畫布事件
function setupFullscreenCanvasEvents(canvas, ctx) {
    let isDrawing = false;
    let hasDrawn = false;
    
    // 開始繪製
    const startDrawing = (e) => {
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY);
        
        if (!clientX || !clientY) {
            return;
        }
        
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        
        ctx.beginPath();
        ctx.moveTo(x, y);
    };
    
    // 繪製中
    const draw = (e) => {
        if (!isDrawing) return;
        
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;
        
        ctx.lineTo(x, y);
        ctx.stroke();
        
        if (!hasDrawn) {
            hasDrawn = true;
            updateFullscreenConfirmButton();
        }
    };
    
    // 結束繪製
    const stopDrawing = () => {
        isDrawing = false;
        ctx.beginPath();
    };
    
    // 綁定滑鼠事件
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // 綁定觸控事件
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', stopDrawing);
    
    // 保存到全域變數供其他函數使用
    window.fullscreenCanvas = canvas;
    window.fullscreenCtx = ctx;
    window.fullscreenHasDrawn = () => hasDrawn;
    window.fullscreenResetDrawn = () => { hasDrawn = false; };
}

// 調整全屏畫布尺寸
function resizeFullscreenCanvas() {
    const canvas = document.getElementById('fullscreenLandscapeSignaturePad');
    if (!canvas) {
        return;
    }
    
    // 等待CSS完全載入
    const rect = canvas.getBoundingClientRect();
    
    if (rect.width === 0 || rect.height === 0) {
        setTimeout(() => resizeFullscreenCanvas(), 100);
        return;
    }
    
    // 設定畫布內部尺寸等於顯示尺寸，避免座標偏移
    canvas.width = Math.floor(rect.width);
    canvas.height = Math.floor(rect.height);
    
    const ctx = canvas.getContext('2d');
    
    // 重新設定繪製樣式
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3; // 全屏模式使用較粗的線
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // 設定白色背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
}

// 更新全屏確認按鈕狀態
function updateFullscreenConfirmButton() {
    const confirmBtn = document.getElementById('fullscreenConfirmBtn');
    if (confirmBtn && window.fullscreenHasDrawn) {
        confirmBtn.disabled = !window.fullscreenHasDrawn();
    }
}

// 清除全屏橫式簽名
function clearFullscreenLandscapeSignature() {
    if (window.fullscreenCanvas && window.fullscreenCtx) {
        const canvas = window.fullscreenCanvas;
        const ctx = window.fullscreenCtx;
        
        // 清空畫布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 設定白色背景
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 重置繪製狀態
        if (window.fullscreenResetDrawn) {
            window.fullscreenResetDrawn();
        }
        
        // 更新按鈕狀態
        const confirmBtn = document.getElementById('fullscreenConfirmBtn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
        }
        
    }
}

// 確認全屏橫式簽名
function confirmFullscreenLandscapeSignature() {
    if (!window.fullscreenCanvas || !window.fullscreenHasDrawn || !window.fullscreenHasDrawn()) {
        alert('請先簽名');
        return;
    }
    
    // 獲取簽名數據
    const signatureData = window.fullscreenCanvas.toDataURL();
    
    
    // 退出全屏模式
    exitFullscreenLandscapeMode();
    
    // 延遲顯示完整文件預覽
    setTimeout(() => {
        showCompleteDocumentPreview(signatureData);
    }, 500);
}

// 顯示全屏簽名預覽
function showFullscreenSignaturePreview(signatureData) {
    const previewHTML = `
        <div id="fullscreenPreviewOverlay" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #f8f9fa;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 20px;
            box-sizing: border-box;
        ">
            <h4 style="margin-bottom: 30px; text-align: center; color: #333;">
                簽名預覽
            </h4>
            
            <div style="
                border: 2px solid #dee2e6;
                border-radius: 8px;
                padding: 20px;
                background: #fff;
                margin-bottom: 30px;
                max-width: 80%;
                max-height: 50%;
            ">
                <img src="${signatureData}" alt="簽名預覽" style="
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                ">
            </div>
            
            <div style="display: flex; gap: 20px;">
                <button type="button" 
                        class="btn btn-outline-secondary btn-lg" 
                        onclick="returnToFullscreenSignature()">
                    <i class="fas fa-arrow-left"></i> 重新簽名
                </button>
                
                <button type="button" 
                        class="btn btn-success btn-lg" 
                        onclick="submitFullscreenSignature('${signatureData}')">
                    <i class="fas fa-check"></i> 確認送出
                </button>
            </div>
        </div>
    `;
    
    // 隱藏簽名界面，顯示預覽
    const signatureOverlay = document.getElementById('fullscreenSignatureOverlay');
    if (signatureOverlay) {
        signatureOverlay.style.display = 'none';
    }
    
    document.body.insertAdjacentHTML('beforeend', previewHTML);
}

// 返回全屏簽名界面
function returnToFullscreenSignature() {
    const previewOverlay = document.getElementById('fullscreenPreviewOverlay');
    if (previewOverlay) {
        previewOverlay.remove();
    }
    
    const signatureOverlay = document.getElementById('fullscreenSignatureOverlay');
    if (signatureOverlay) {
        signatureOverlay.style.display = 'flex';
    }
}

// 送出全屏簽名
function submitFullscreenSignature(signatureData) {
    
    // 這裡使用原有的簽名送出邏輯
    if (window.currentAnnouncementId && signatureData) {
        // 將簽名數據設定到原有的簽名欄位
        const hiddenSignatureInput = document.querySelector('input[name="signatureData"]') || 
                                    document.querySelector('#signatureData');
        
        if (hiddenSignatureInput) {
            hiddenSignatureInput.value = signatureData;
        }
        
        // 執行原有的送出邏輯
        submitSignature();
    }
    
    // 清理全屏界面
    exitFullscreenLandscapeMode();
}

// 退出全屏橫式簽名模式
async function exitFullscreenLandscapeMode() {
    const signatureOverlay = document.getElementById('fullscreenSignatureOverlay');
    const previewOverlay = document.getElementById('fullscreenPreviewOverlay');
    
    if (signatureOverlay) {
        signatureOverlay.remove();
    }
    
    if (previewOverlay) {
        previewOverlay.remove();
    }
    
    // 清理全域變數
    window.fullscreenCanvas = null;
    window.fullscreenCtx = null;
    window.fullscreenHasDrawn = null;
    window.fullscreenResetDrawn = null;
    
    // 恢復原始螢幕方向
    await restoreScreenOrientation();
    
}

// HTML 內容 Modal 功能
function openHtmlModal(htmlContent, title = 'HTML 內容') {
    
    // 檢查是否已存在 modal
    let htmlModal = document.getElementById('htmlModal');
    
    if (!htmlModal) {
        // 創建 modal HTML
        const modalHTML = `
            <div class="modal fade" id="htmlModal" tabindex="-1" aria-labelledby="htmlModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-xl modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="htmlModalLabel">HTML 內容檢視</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="關閉"></button>
                        </div>
                        <div class="modal-body" id="htmlModalBody" style="max-height: 70vh; overflow-y: auto;">
                            <!-- HTML 內容將在這裡顯示 -->
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">關閉</button>
                            <button type="button" class="btn btn-primary" onclick="openHtmlInNewWindow(currentModalHtmlContent)">
                                <i class="fas fa-external-link-alt"></i> 新視窗開啟
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 添加到 body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        htmlModal = document.getElementById('htmlModal');
        
    }
    
    // 設置 HTML 內容
    const modalBody = document.getElementById('htmlModalBody');
    const modalTitle = document.getElementById('htmlModalLabel');
    
    if (modalBody) {
        modalBody.innerHTML = htmlContent;
        currentModalHtmlContent = htmlContent; // 保存當前 HTML 內容用於新視窗開啟
    }
    
    if (modalTitle) {
        modalTitle.textContent = title;
    }
    
    // 使用 Bootstrap Modal 顯示
    if (window.bootstrap && htmlModal) {
        const bsModal = new bootstrap.Modal(htmlModal);
        bsModal.show();
    } else {
        // 備用顯示方式 - 顯示 modal 元素
        if (htmlModal) {
            htmlModal.style.display = 'block';
            htmlModal.classList.add('show');
        }
    }
}

// 在新視窗開啟 HTML 內容
function openHtmlInNewWindow(htmlContent) {
    
    try {
        // 創建完整的 HTML 文件
        const fullHtml = `
            <!DOCTYPE html>
            <html lang="zh-TW">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>HTML 內容檢視</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
                <style>
                    body { 
                        margin: 20px; 
                        background-color: #f8f9fa;
                    }
                    .content-container {
                        background: white;
                        padding: 30px;
                        border-radius: 10px;
                        box-shadow: 0 0 15px rgba(0,0,0,0.1);
                    }
                </style>
            </head>
            <body>
                <div class="container-fluid">
                    <div class="row justify-content-center">
                        <div class="col-md-10">
                            <div class="content-container">
                                ${htmlContent}
                            </div>
                        </div>
                    </div>
                </div>
                <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
            </body>
            </html>
        `;
        
        // 開啟新視窗
        const newWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
        newWindow.document.write(fullHtml);
        newWindow.document.close();
        
        
    } catch (error) {
        alert('無法開啟新視窗，請檢查瀏覽器的彈出視窗設定');
    }
}

// 全域變數保存當前 modal 中的 HTML 內容
let currentModalHtmlContent = null;

// URL 網頁 Modal 功能
function openUrlInModal(url, title = '網頁內容') {
    
    // 檢查是否已存在 modal
    let urlModal = document.getElementById('urlModal');
    
    if (!urlModal) {
        // 創建 modal HTML
        const modalHTML = `
            <div class="modal fade" id="urlModal" tabindex="-1" aria-labelledby="urlModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-xl modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="urlModalLabel">網頁檢視</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="關閉"></button>
                        </div>
                        <div class="modal-body p-0 position-relative" style="height: 95vh; overflow: hidden;">
                            <iframe id="urlModalFrame" 
                                    style="width: 100%; height: 100%; border: none; transform: scale(1.1) translateY(-30px); transform-origin: top left;" 
                                    frameborder="0"
                                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation">
                            </iframe>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">關閉</button>
                            <button type="button" class="btn btn-primary" onclick="window.open(currentModalUrl, '_blank')">
                                <i class="fas fa-external-link-alt"></i> 新視窗開啟
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 添加到 body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        urlModal = document.getElementById('urlModal');
        
    }
    
    // 設置網頁來源
    const modalFrame = document.getElementById('urlModalFrame');
    const modalTitle = document.getElementById('urlModalLabel');
    
    if (modalFrame) {
        modalFrame.src = url;
        currentModalUrl = url; // 保存當前網址用於新視窗開啟
    }
    
    if (modalTitle) {
        modalTitle.textContent = title;
    }
    
    // 使用 Bootstrap Modal 顯示
    if (window.bootstrap && urlModal) {
        const bsModal = new bootstrap.Modal(urlModal);
        bsModal.show();
    } else {
        // 備用顯示方式 - 顯示 modal 元素
        if (urlModal) {
            urlModal.style.display = 'block';
            urlModal.classList.add('show');
        }
    }
}

// 全域變數保存當前 modal 中的網址
let currentModalUrl = null;

function closeWindow() {
    window.close();
}

// 統一的完整文件預覽功能
function generateCompleteDocumentPreview(signatureData) {
    
    if (!currentAnnouncement || !signatureData) {
        return null;
    }
    
    const userName = currentUserInfo?.displayName || '用戶';
    
    // 生成完整的文件HTML，包含宣導內容和簽名
    const previewHTML = `
        <div class="document-preview" style="max-width: 100%; margin: 0 auto; font-size: 14px; line-height: 1.6;">
            <!-- 文件標題 -->
            <div class="document-header text-center mb-4">
                <h3 class="mb-3">${escapeHtml(currentAnnouncement.title)}</h3>
                <div class="d-flex justify-content-between align-items-center">
                    <span class="badge bg-primary">${escapeHtml(currentAnnouncement.documentType || 'E宣導')}</span>
                    <span class="text-muted">${escapeHtml(currentAnnouncement.publishInfo || '')}</span>
                </div>
                <hr>
            </div>
            
            <!-- 文件內容 -->
            <div class="document-body">
                ${renderContentBlocksForPreview(currentAnnouncement.contentBlocks)} 
            </div>
            
            <!-- 簽名區域 -->
            <div class="signature-section mt-4">
                <!-- 簽名人員資訊 -->
                <div class="row mb-3">
                    <div class="col-12">
                        <div class="signature-info bg-light p-3 rounded">
                            <div class="row">
                                <div class="col-md-6">
                                    <p class="mb-1"><strong>簽名人員：</strong></p>
                                    <p class="text-primary">${escapeHtml(userName)}</p>
                                </div>
                                <div class="col-md-6">
                                    <p class="mb-1"><strong>狀態：</strong></p>
                                    <p><span class="badge bg-success fs-6">已確認閱覽</span></p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 數位簽名 -->
                <div class="row">
                    <div class="col-12 text-center">
                        <img src="${signatureData}" 
                             alt="數位簽名" 
                             class="signature-display"
                             style="max-width: 150px; max-height: 75px; min-width: 100px; border: 1px solid #dee2e6; border-radius: 4px; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    </div>
                </div>
            </div>
            
            <!-- 確認資訊 -->
            <div class="mt-4 p-3 bg-light border-start border-5 border-success">
                <h6 class="text-success"><i class="fas fa-check-circle"></i> 簽名確認</h6>
                <p class="mb-0 small text-muted">
                    本人已詳細閱讀上述宣導內容，並以數位簽名方式確認收悉。
                </p>
            </div>
        </div>
    `;
    
    return previewHTML;
}

// 專門用於預覽的內容渲染函數（簡化版，無按鈕）
function renderContentBlocksForPreview(blocks) {
    let html = '';
    
    if (!blocks || !Array.isArray(blocks)) {
        return '<p class="text-muted">無內容可顯示</p>';
    }
    
    blocks.forEach((block, index) => {
        console.log('Processing block:', block); // 調試用
        
        // 處理文字內容
        if (block.text && block.text.trim()) {
            html += `<div class="content-block text-block mb-3">
                <div class="border rounded p-3" style="background-color: #f8f9fa;">
                    <p class="mb-0">${escapeHtml(block.text)}</p>
                </div>
            </div>`;
        }
        // 處理圖片內容
        else if (block.type === 'image' && block.content) {
            html += `<div class="content-block image-block mb-3 text-center">
                <img src="${block.content}" 
                     class="img-fluid content-image" 
                     alt="宣導圖片" 
                     style="max-width: 100%; height: auto; border-radius: 8px; max-height: 400px;">
            </div>`;
        }
        // 處理影片內容（YouTube等）
        else if (block.type === 'video' && block.content) {
            html += `<div class="content-block video-block mb-3">
                <div class="border rounded p-3" style="background-color: #f0f0f0;">
                    <div class="text-center">
                        <i class="fas fa-play-circle me-2" style="color: #ff0000;"></i>
                        <span class="text-muted">影片內容：${block.title || '影片'}</span>
                        <br><small class="text-muted">${block.content}</small>
                    </div>
                </div>
            </div>`;
        }
        // 處理HTML/網頁內容
        else if ((block.type === 'html' || block.type === 'iframe') && block.content) {
            // 檢查內容類型
            let content = block.content;
            let isLikelyHtml = content.includes('<') && content.includes('>');
            let isUrlLike = content.startsWith('http://') || content.startsWith('https://');
            let isJsonLike = false;
            
            // 嘗試解析JSON
            if (!isUrlLike && !isLikelyHtml) {
                try {
                    const parsed = JSON.parse(content);
                    if (parsed.url) {
                        isJsonLike = true;
                        html += `<div class="content-block iframe-block mb-3">
                            <div class="border rounded p-3" style="background-color: #f0f0f0;">
                                <div class="text-center">
                                    <i class="fas fa-globe me-2"></i>
                                    <span class="text-muted">網頁內容：${parsed.title || parsed.url}</span>
                                </div>
                            </div>
                        </div>`;
                    }
                } catch (e) {
                    // 不是有效的JSON
                }
            }
            
            // 如果是HTML內容，直接顯示
            if (isLikelyHtml && !isJsonLike) {
                html += `<div class="content-block html-block mb-3">
                    <div class="border rounded p-3" style="background-color: #f8f9fa;">
                        ${content}
                    </div>
                </div>`;
            }
            // 如果是URL，顯示連結信息
            else if (isUrlLike && !isJsonLike) {
                html += `<div class="content-block iframe-block mb-3">
                    <div class="border rounded p-3" style="background-color: #f0f0f0;">
                        <div class="text-center">
                            <i class="fas fa-globe me-2"></i>
                            <span class="text-muted">網頁內容：${content}</span>
                        </div>
                    </div>
                </div>`;
            }
        }
        // 處理其他任何內容類型
        else if (block.content) {
            html += `<div class="content-block other-block mb-3">
                <div class="border rounded p-3" style="background-color: #f9f9f9;">
                    <p class="mb-0 text-muted">內容類型：${block.type || '未知'}</p>
                    <div style="max-height: 200px; overflow-y: auto;">
                        <pre style="font-size: 12px; margin: 0;">${escapeHtml(block.content.toString().substring(0, 500))}${block.content.length > 500 ? '...' : ''}</pre>
                    </div>
                </div>
            </div>`;
        }
    });
    
    if (html === '') {
        html = '<p class="text-muted text-center">無內容可顯示</p>';
    }
    
    return html;
}

// 顯示完整文件預覽（直接在當前頁面顯示）
function showCompleteDocumentPreview(signatureData) {
    
    if (!currentAnnouncement || !signatureData) {
        showMessage('無法生成文件預覽', 'error');
        return;
    }
    
    const userName = currentUserInfo?.displayName || '用戶';
    
    // 隱藏簽名區域
    const signatureArea = document.getElementById('signatureArea');
    if (signatureArea) {
        signatureArea.style.display = 'none';
    }
    
    // 找到"我已閱讀"按鈕區域並替換為預覽控制區域
    const readButton = document.querySelector('button[onclick*="readAnnouncement"]') || 
                      document.querySelector('.btn-success') ||
                      document.querySelector('#confirmReadBtn');
    
    if (readButton) {
        const buttonContainer = readButton.parentElement;
        
        // 暫存簽名數據
        currentSignatureData = signatureData;
        
        // 替換按鈕區域為預覽控制
        buttonContainer.innerHTML = `
            <div class="signature-preview-area">
                <!-- 簽名資訊區域 -->
                <div class="row mb-4">
                    <div class="col-12">
                        <div class="signature-info bg-light p-3 rounded">
                            <div class="row">
                                <div class="col-md-6">
                                    <p class="mb-1"><strong>簽名人員：</strong></p>
                                    <p class="text-primary">${escapeHtml(userName)}</p>
                                </div>
                                <div class="col-md-6">
                                    <p class="mb-1"><strong>狀態：</strong></p>
                                    <p><span class="badge bg-success fs-6">已確認閱覽</span></p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 數位簽名顯示 -->
                <div class="row">
                    <div class="col-12 text-center">
                        <div class="signature-display-container" style="transform: scale(1.8); margin: 0.5rem auto; padding: 0.2rem; max-width: 200px;">
                            <img src="${signatureData}" 
                                 alt="數位簽名" 
                                 class="signature-display"
                                 style="max-width: 120px; max-height: 60px; min-width: 80px; border: 1px solid #dee2e6; border-radius: 4px; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        </div>
                    </div>
                </div>
                
                <!-- 確認資訊 -->
                <div class="p-2 bg-light border-start border-4 border-success" style="margin: 1rem 0;">
                    <p class="mb-0 small text-muted">
                        本人已詳細閱讀上述宣導內容，並以數位簽名方式確認收悉。
                    </p>
                </div>
                
                <!-- 控制按鈕 - 固定在底部 -->
                <div class="fixed-bottom bg-white p-3 border-top" style="z-index: 1000;">
                    <div class="text-center">
                        <button type="button" class="btn btn-success btn-lg me-3" onclick="confirmSignature()">
                            <i class="fas fa-check"></i> 確認送出
                        </button>
                        <button type="button" class="btn btn-secondary btn-lg" onclick="cancelSignaturePreview()">
                            <i class="fas fa-times"></i> 取消重簽
                        </button>
                    </div>
                </div>
                
                <!-- 為固定按鈕預留空間 -->
                <div style="height: 100px;"></div>
            </div>
        `;
    }
}

// 取消簽名預覽，回到原始狀態
function cancelSignaturePreview() {
    // 重新載入頁面回到原始狀態
    window.location.reload();
}

// 取消預覽，返回宣導頁面
function cancelPreview() {
    
    const previewModal = document.getElementById('previewModal');
    if (previewModal) {
        const bsPreviewModal = bootstrap.Modal.getInstance(previewModal);
        if (bsPreviewModal) {
            bsPreviewModal.hide();
        }
    }
    
    // 清除簽名數據
    currentSignatureData = null;
    
}

// 確認提交簽名（從預覽模態框）
function confirmSignature() {
    
    if (!currentSignatureData) {
        showMessage('簽名數據遺失，請重新簽名', 'error');
        return;
    }
    
    // 關閉預覽模態框
    const previewModal = document.getElementById('previewModal');
    if (previewModal) {
        const bsPreviewModal = bootstrap.Modal.getInstance(previewModal);
        if (bsPreviewModal) {
            bsPreviewModal.hide();
        }
    }
    
    // 實際提交簽名
    setTimeout(() => {
        actuallySubmitSignature();
    }, 500);
}

// 強制隱藏URL顯示的CSS注入函數
function injectHideUrlStyles() {
    // 創建強力隱藏URL的CSS樣式
    const hideUrlCSS = `
        <style id="hideUrlStyles">
            /* 隱藏所有可能的URL顯示元素 */
            .text-muted .fas.fa-globe,
            .bg-light .text-muted,
            .iframe-title,
            .url-display,
            .content-url,
            .source-url {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                overflow: hidden !important;
            }
            
            /* 確保iframe容器不顯示任何文字內容 */
            .iframe-container .d-flex.justify-content-between,
            .iframe-container .bg-light.border-bottom,
            .border.rounded .bg-light.border-bottom,
            .border-bottom {
                display: none !important;
            }
            
            /* 隱藏可能的邊框線 */
            .iframe-container .border,
            .iframe-container .border-top,
            .iframe-container .border-bottom,
            .html-iframe-block .border {
                border: none !important;
            }
            
            /* 強制隱藏包含globe圖標的父元素 */
            .fa-globe {
                display: none !important;
            }
            
            .fa-globe + span,
            .fa-globe ~ span {
                display: none !important;
            }
            
            /* 手機優化 - 完全不遮蔽內容 */
            @media (max-width: 768px) {
                .iframe-container {
                    margin: 0 !important;
                    width: 100vw !important;
                    height: 90vh !important;
                    position: relative !important;
                    overflow: visible !important;
                }
                
                .iframe-container iframe {
                    width: 100vw !important;
                    height: 90vh !important;
                    position: relative !important;
                    top: 0 !important;
                    left: 0 !important;
                    border: none !important;
                    transform: none !important;
                }
                
                /* 確保浮動按鈕在手機上正確顯示 */
                .iframe-floating-controls {
                    position: fixed !important;
                    top: 20px !important;
                    right: 10px !important;
                    z-index: 9999 !important;
                }
                
                /* 隱藏可能影響iframe顯示的元素 */
                .border.rounded {
                    border: none !important;
                    padding: 0 !important;
                    margin: 0 !important;
                }
            }
            
            /* 電腦版優化 */
            @media (min-width: 769px) {
                .iframe-container {
                    margin: 0 auto !important;
                    width: 100% !important;
                    max-width: none !important;
                }
                
                .iframe-container iframe {
                    width: 100% !important;
                    height: 100% !important;
                    transform: scale(1.01) translateY(0px) !important;
                    transform-origin: top center !important;
                }
            }
        </style>
    `;
    
    // 注入到head
    if (!document.getElementById('hideUrlStyles')) {
        document.head.insertAdjacentHTML('beforeend', hideUrlCSS);
    }
    
    // 也嘗試用JavaScript直接隱藏
    const hideElements = () => {
        // 隱藏任何包含URL的元素
        const allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
            if (el.textContent && 
                (el.textContent.includes('https://') || 
                 el.textContent.includes('http://') ||
                 el.textContent.includes('github.io') ||
                 el.textContent.includes('.html'))) {
                // 只隱藏小的文字元素，不隱藏iframe本身
                if (el.tagName !== 'IFRAME' && el.offsetHeight < 50) {
                    el.style.display = 'none';
                }
            }
        });
        
        // 特別隱藏帶有地球圖標的元素
        const globeElements = document.querySelectorAll('.fa-globe');
        globeElements.forEach(globe => {
            const parent = globe.closest('.text-muted') || globe.closest('small');
            if (parent) {
                parent.style.display = 'none';
            }
        });
    };
    
    hideElements();
    
    // 設定定期檢查，因為內容可能動態載入
    setInterval(hideElements, 1000);
}

// 清空iframe中的URL顯示函數
function hideIframeUrlBars() {
    // 等待iframe載入後再執行
    setTimeout(() => {
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            try {
                // 嘗試操作iframe內部文檔
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                if (iframeDoc) {
                    // 隱藏常見的URL顯示元素
                    const urlElements = iframeDoc.querySelectorAll('input[type="url"], .url-bar, .address-bar, .location-bar');
                    urlElements.forEach(el => {
                        el.style.display = 'none';
                    });
                }
            } catch (e) {
                // 如果無法訪問iframe內容（跨域），就在父文檔中處理
                console.log('跨域iframe，使用CSS隱藏方式');
            }
        });
    }, 1000);
}

// 當文檔載入完成後執行
document.addEventListener('DOMContentLoaded', () => {
    injectHideUrlStyles();
    hideIframeUrlBars();
});

// 當內容更新後也執行
document.addEventListener('contentUpdated', () => {
    injectHideUrlStyles();
    hideIframeUrlBars();
});

// 立即執行一次
injectHideUrlStyles();
