// 全域變數
const API_BASE = (() => {
    // 檢查是否為本地開發環境
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return window.location.origin + '/api';
    }
    // 生產環境使用指定的後端地址
     return 'https://35.221.146.143.nip.io/linehook';
})();

let currentUserInfo = null;
let userAnnouncements = [];

// LIFF 設定
const channelId = "2006992891"; // 服務 ID
const LIFF_ID = "2006993665-qYDYM1DW".trim(); // LIFF ID

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeLiff();
});

// 初始化 LIFF
async function initializeLiff() {
    try {
        
        // 初始化 LIFF
        await liff.init({ liffId: LIFF_ID });
        
        if (!liff.isLoggedIn()) {
            liff.login();
            return;
        }
        
        // 取得用戶資訊
        await getUserInfo();
        
        // 載入用戶的宣導專案
        await loadUserAnnouncements();
        
        // 隱藏載入畫面，顯示主要內容
        showMainContent();
        
    } catch (error) {
        
        // 如果是本地開發環境，使用測試用戶資訊
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            await useTestUser();
            await loadUserAnnouncements();
            showMainContent();
        } else {
            showError('身份驗證失敗，請重新開啟頁面');
        }
    }
}

// 取得用戶資訊
async function getUserInfo() {
    try {
        if (liff.isLoggedIn()) {
            
            const profile = await liff.getProfile();
            const context = liff.getContext();
            
            currentUserInfo = {
                userId: profile.userId,
                displayName: profile.displayName,
                pictureUrl: profile.pictureUrl,
                source: 'line'
            };
            
            // 查詢用戶在系統中的詳細資訊
            await fetchUserDetails();
            
        } else {
            throw new Error('用戶未登入');
        }
    } catch (error) {
        throw error;
    }
}

// 使用測試用戶（本地開發）
async function useTestUser() {
    currentUserInfo = {
        userId: 'test_user_001',
        displayName: '測試用戶',
        source: 'test',
        empId: 'EMP001',
        name: '測試用戶',
        company: '測試公司',
        dept: '資訊部'
    };
    
    updateUserInfoDisplay();
}

// 查詢用戶詳細資訊
async function fetchUserDetails() {
    try {
        
        const response = await fetch(`${API_BASE}/User/checkUser`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                UserId: currentUserInfo.userId,
                ChannelId: channelId
            })
        });
        
        if (response.ok) {
            const userDetails = await response.json();
            
            // 合併用戶資訊
            currentUserInfo = {
                ...currentUserInfo,
                empId: userDetails.empId || userDetails.EmpId,
                name: userDetails.name || userDetails.Name,
                company: userDetails.company || userDetails.Company,
                dept: userDetails.dept || userDetails.Dept,
                job: userDetails.job || userDetails.Job,
                groupCode: userDetails.groupCode || userDetails.GroupCode,
                phone: userDetails.phone || userDetails.Phone
            };
            
        } else {
            const errorText = await response.text();
            throw new Error(`用戶驗證失敗: ${errorText}`);
        }
        
        updateUserInfoDisplay();
        
    } catch (error) {
        
        // 如果是生產環境，不允許訪問
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            showError('您沒有權限訪問此系統，請聯絡系統管理員');
            return;
        }
        
        // 本地開發環境使用基本資訊
        currentUserInfo.empId = currentUserInfo.userId;
        currentUserInfo.name = currentUserInfo.displayName;
        currentUserInfo.company = '未知';
        currentUserInfo.dept = '未知';
        
        updateUserInfoDisplay();
    }
}

// 更新用戶資訊顯示
function updateUserInfoDisplay() {
    document.getElementById('userName').textContent = currentUserInfo.name || currentUserInfo.displayName;
    document.getElementById('userDept').textContent = `${currentUserInfo.company} - ${currentUserInfo.dept}`;
    document.getElementById('userInfo').style.display = 'block';
}

// 載入用戶的宣導專案
async function loadUserAnnouncements() {
    try {
        
        hideAllStates();
        document.getElementById('loadingState').style.display = 'block';
        
        if (!currentUserInfo) {
            throw new Error('用戶資訊不完整');
        }
        
        
        // 構建查詢參數
        const params = new URLSearchParams({
            userId: currentUserInfo.userId,
            empId: currentUserInfo.empId || currentUserInfo.userId,
            company: currentUserInfo.company || '測試公司',
            dept: currentUserInfo.dept || '測試部門'
        });
        
        
        const response = await fetch(`${API_BASE}/EAnnouncement/user-announcements?${params}`);
        
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        
        if (result.success) {
            userAnnouncements = result.data || [];
            
            // 按發佈時間排序，最新的在前面
            userAnnouncements.sort((a, b) => {
                const dateA = new Date(a.publishDate);
                const dateB = new Date(b.publishDate);
                return dateB - dateA; // 降序排列（最新在前）
            });
            
            
            renderAnnouncementsList();
            updateStatistics();
            
        } else {
            throw new Error(result.message || '載入宣導專案失敗');
        }
        
    } catch (error) {
        showErrorState(error.message);
    }
}

// 渲染宣導專案列表
function renderAnnouncementsList() {
    hideAllStates();
    
    if (userAnnouncements.length === 0) {
        document.getElementById('emptyState').style.display = 'block';
        return;
    }
    
    // 分離待確認和已確認的宣導專案
    const pendingAnnouncements = userAnnouncements.filter(a => !a.hasSignature);
    const completedAnnouncements = userAnnouncements.filter(a => a.hasSignature);
    
    // 顯示標籤頁容器
    document.getElementById('tabsContainer').style.display = 'block';
    
    // 渲染待確認列表
    renderTabContent(pendingAnnouncements, 'pendingList', 'pendingEmptyState', '待確認');
    
    // 渲染已確認列表
    renderTabContent(completedAnnouncements, 'completedList', 'completedEmptyState', '已確認');
}

function renderTabContent(announcements, containerId, emptyStateId, statusType) {
    const container = document.getElementById(containerId);
    const emptyState = document.getElementById(emptyStateId);
    
    if (announcements.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    
    const html = announcements.map(announcement => {
        const isCompleted = announcement.hasSignature || false;
        const statusClass = isCompleted ? 'status-completed' : 'status-pending';
        const statusText = isCompleted ? '已確認' : '待確認';
        const statusIcon = isCompleted ? 'check-circle' : 'clock';
        
        // 格式化日期
        const publishDate = formatDate(announcement.publishDate);
        const signedDate = announcement.signedAt ? formatDate(announcement.signedAt) : null;
        
        // 根據狀態類型決定是否顯示確認時間
        const showSignedDate = statusType === '待確認' && signedDate;
        
        return `
            <div class="announcement-item" onclick="openAnnouncement('${announcement.id}', ${isCompleted})">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <h6 class="mb-1 fw-bold">${announcement.title}</h6>
                        <div class="announcement-content">
                            <small class="text-muted">
                                <i class="fas fa-building me-1"></i>${announcement.publishUnit}
                            </small>
                        </div>
                        <div class="announcement-content">
                            <small class="text-muted">
                                <i class="fas fa-tags me-1"></i>${announcement.documentType}
                            </small>
                        </div>
                        <div class="date-info mt-2">
                            <i class="fas fa-calendar me-1"></i>發佈：${publishDate}
                            ${showSignedDate ? `<br><i class="fas fa-signature me-1"></i>確認：${signedDate}` : ''}
                        </div>
                    </div>
                    <div class="text-end">
                        <span class="status-badge ${statusClass}">
                            <i class="fas fa-${statusIcon} me-1"></i>${statusText}
                        </span>
                        <div class="mt-2">
                            <i class="fas fa-chevron-right text-muted"></i>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
    
    document.getElementById('statsRow').style.display = 'block';
}

// 更新統計資訊
function updateStatistics() {
    const completed = userAnnouncements.filter(a => a.hasSignature).length;
    const pending = userAnnouncements.length - completed;
    
    document.getElementById('completedCount').textContent = completed;
    document.getElementById('pendingCount').textContent = pending;
}

// 開啟宣導專案
async function openAnnouncement(announcementId, isCompleted) {
    try {
        // 檢測環境並決定使用哪個URL
        const hostname = window.location.hostname;
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
        const isGitHubPages = hostname === 'ianhsu1205.github.io';
        const isBackendDomain = hostname.includes('35.221.146.143.nip.io');
        
        // 檢測是否為 LINE 環境
        const userAgent = navigator.userAgent || "";
        const isLineApp = userAgent.includes("Line") || 
                         userAgent.toLowerCase().includes("line") ||
                         currentUserInfo?.source === 'line';
        
        let fullSignatureUrl;
        
        if (isLocalhost) {
            // 開發環境：使用本地URL
            fullSignatureUrl = `${window.location.origin}/e-announcement/signature.html?id=${announcementId}`;
            console.log('使用本地開發URL');
        } else if (isLineApp) {
            // LINE 環境：根據當前環境決定 URL
            if (isGitHubPages) {
                // 在 GitHub Pages 中，使用 GitHub Pages URL 但添加 LINE 標記
                fullSignatureUrl = `https://ianhsu1205.github.io/liffhook/e-announcement/signature.html?id=${announcementId}&fromLine=true`;
                console.log('LINE 環境在 GitHub Pages：使用 GitHub Pages URL 並添加 fromLine 參數');
            } else {
                // 在其他環境，使用後端 URL（後端有靜態檔案服務）
                fullSignatureUrl = `https://35.221.146.143.nip.io/linehook/e-announcement/signature.html?id=${announcementId}`;
                console.log('LINE 環境在其他環境：使用後端URL');
            }
        } else if (isGitHubPages) {
            // 非 LINE 的 GitHub Pages 環境：使用 GitHub Pages URL
            fullSignatureUrl = `https://ianhsu1205.github.io/liffhook/e-announcement/signature.html?id=${announcementId}`;
            console.log('使用 GitHub Pages URL');
        } else if (isBackendDomain) {
            // 直接從後端域名存取：使用後端相對路徑
            fullSignatureUrl = `${window.location.origin}/e-announcement/signature.html?id=${announcementId}`;
            console.log('使用後端相對路徑URL');
        } else {
            // 其他環境：默認使用 GitHub Pages URL
            fullSignatureUrl = `https://ianhsu1205.github.io/liffhook/e-announcement/signature.html?id=${announcementId}`;
            console.log('使用默認 GitHub Pages URL');
        }
        
        // 如果有用戶資訊，添加 userId 參數
        if (currentUserInfo && currentUserInfo.userId) {
            fullSignatureUrl += `&userId=${encodeURIComponent(currentUserInfo.userId)}`;
        }
        
        console.log('開啟宣導專案URL:', fullSignatureUrl);
        console.log('當前環境資訊:', {
            hostname: hostname,
            isLineApp: isLineApp,
            userAgent: userAgent,
            userSource: currentUserInfo?.source
        });
        
        // 根據來源環境決定開啟方式
        if (isLineApp) {
            // 在 LINE 內瀏覽器中開啟，使用 try-catch 和 Promise 處理
            try {
                console.log('使用 LIFF openWindow 開啟:', fullSignatureUrl);
                
                // 使用 Promise 包裝 LIFF 調用，避免異步錯誤
                Promise.resolve().then(() => {
                    return liff.openWindow({
                        url: fullSignatureUrl,
                        external: false
                    });
                }).catch(liffError => {
                    console.error('LIFF openWindow 失敗:', liffError);
                    // 備援：嘗試使用普通的 window.open
                    console.log('嘗試使用 window.open 作為備援');
                    window.open(fullSignatureUrl, '_blank');
                });
            } catch (syncError) {
                console.error('同步 LIFF 調用失敗:', syncError);
                // 立即備援
                window.open(fullSignatureUrl, '_blank');
            }
        } else {
            // 在新分頁中開啟（開發環境或其他瀏覽器）
            window.open(fullSignatureUrl, '_blank');
        }
        
    } catch (error) {
        console.error('開啟宣導專案失敗:', error);
        
        // 備援方案：優先使用 GitHub Pages URL，再用後端URL
        const hostname = window.location.hostname;
        let backupUrl;
        
        if (hostname === 'ianhsu1205.github.io') {
            backupUrl = `https://ianhsu1205.github.io/liffhook/e-announcement/signature.html?id=${announcementId}${currentUserInfo?.userId ? `&userId=${encodeURIComponent(currentUserInfo.userId)}` : ''}`;
        } else {
            backupUrl = `https://35.221.146.143.nip.io/linehook/e-announcement/signature.html?id=${announcementId}${currentUserInfo?.userId ? `&userId=${encodeURIComponent(currentUserInfo.userId)}` : ''}`;
        }
        
        console.log('使用備援URL:', backupUrl);
        
        // 安全的備援調用
        if (currentUserInfo?.source === 'line') {
            try {
                Promise.resolve().then(() => {
                    return liff.openWindow({
                        url: backupUrl,
                        external: false
                    });
                }).catch(liffError => {
                    console.error('備援 LIFF openWindow 失敗:', liffError);
                    window.open(backupUrl, '_blank');
                });
            } catch (syncError) {
                console.error('備援同步 LIFF 調用失敗:', syncError);
                window.open(backupUrl, '_blank');
            }
        } else {
            window.open(backupUrl, '_blank');
        }
    }
}

// 格式化日期
function formatDate(dateString) {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return dateString;
    }
}

// 顯示主要內容
function showMainContent() {
    document.getElementById('liffLoading').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
}

// 隱藏所有狀態
function hideAllStates() {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('errorState').style.display = 'none';
    document.getElementById('statsRow').style.display = 'none';
    document.getElementById('tabsContainer').style.display = 'none';
}

// 顯示錯誤狀態
function showErrorState(message) {
    hideAllStates();
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorState').style.display = 'block';
}

// 顯示錯誤訊息
function showError(message) {
    hideAllStates();
    document.getElementById('liffLoading').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    showErrorState(message);
}

// 下拉刷新功能
let startY = 0;
let currentY = 0;
let pullDistance = 0;
const pullThreshold = 80;
let isPulling = false;

document.addEventListener('touchstart', function(e) {
    startY = e.touches[0].clientY;
    isPulling = false;
});

document.addEventListener('touchmove', function(e) {
    if (window.scrollY > 0) return;
    
    currentY = e.touches[0].clientY;
    pullDistance = currentY - startY;
    
    if (pullDistance > 10) {
        isPulling = true;
        e.preventDefault();
        
        // 視覺反饋
        if (pullDistance > pullThreshold) {
            document.body.style.transform = `translateY(${Math.min(pullDistance * 0.5, 40)}px)`;
            document.body.style.opacity = '0.8';
        }
    }
});

document.addEventListener('touchend', function() {
    if (isPulling && pullDistance > pullThreshold) {
        // 執行刷新
        loadUserAnnouncements();
    }
    
    // 重置視覺效果
    document.body.style.transform = '';
    document.body.style.opacity = '';
    isPulling = false;
    pullDistance = 0;
});

// 處理 LIFF 視窗關閉
window.addEventListener('beforeunload', function() {
    if (currentUserInfo?.source === 'line') {
        try {
            // 通知 LIFF 應用即將關閉
        } catch (error) {
        }
    }
});

// 監聽來自子窗口的消息（LINE 環境中的 404 頁面關閉通知）
window.addEventListener('message', function(event) {
    console.log('收到子窗口消息:', event.data);
    
    try {
        if (event.data === 'child-closing') {
            // 404 子窗口即將關閉，不需要特別處理
            console.log('404 子窗口正在關閉');
        } else if (event.data === 'signature-closing') {
            // signature 窗口即將關閉，重新載入列表
            console.log('signature 窗口正在關閉，重新載入列表');
            
            // 延遲重新載入，確保窗口已完全關閉
            setTimeout(() => {
                try {
                    loadUserAnnouncements();
                } catch (error) {
                    console.error('重新載入列表失敗:', error);
                }
            }, 500);
        }
    } catch (error) {
        console.error('處理子窗口消息時發生錯誤:', error);
    }
});

// Debug 資訊（僅在開發環境顯示）
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    
    // 添加調試按鈕
    window.addEventListener('load', function() {
        const debugBtn = document.createElement('button');
        debugBtn.innerHTML = '🔧 Debug';
        debugBtn.style.position = 'fixed';
        debugBtn.style.bottom = '10px';
        debugBtn.style.right = '10px';
        debugBtn.style.zIndex = '9999';
        debugBtn.style.padding = '5px 10px';
        debugBtn.style.fontSize = '12px';
        debugBtn.className = 'btn btn-secondary btn-sm';
        
        debugBtn.onclick = function() {
        };
        
        document.body.appendChild(debugBtn);
    });
}
