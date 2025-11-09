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
function openAnnouncement(announcementId, isCompleted) {
    
    // 構建簽名頁面 URL，包含必要的參數
    let signatureUrl = `signature.html?id=${announcementId}`;
    
    // 如果有用戶資訊，添加 userId 參數以支援另開視窗功能
    if (currentUserInfo && currentUserInfo.userId) {
        signatureUrl += `&userId=${encodeURIComponent(currentUserInfo.userId)}`;
    }
    
    
    if (currentUserInfo?.source === 'line') {
        // 在 LINE 內瀏覽器中開啟
        liff.openWindow({
            url: signatureUrl,
            external: false
        });
    } else {
        // 在新分頁中開啟
        window.open(signatureUrl, '_blank');
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
