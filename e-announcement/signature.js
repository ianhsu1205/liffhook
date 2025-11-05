// 全域變數
const API_BASE = (() => {
    // 檢查是否為本地開發環境
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return window.location.origin + '/';
    }
    // 生產環境使用指定的後端地址
    return 'https://35.221.146.143.nip.io/linehook/';
})();
let announcementId = '';
let canvas, ctx;
let isDrawing = false;
let currentUserInfo = null;

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('API Base URL:', API_BASE);
    initializeSignaturePad();
    initializePage();
});

// 初始化簽名板
function initializeSignaturePad() {
    canvas = document.getElementById('signaturePad');
    ctx = canvas.getContext('2d');
    
    // 設置畫筆
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    
    // 事件監聽
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // 觸控事件
    canvas.addEventListener('touchstart', handleTouch);
    canvas.addEventListener('touchmove', handleTouch);
    canvas.addEventListener('touchend', stopDrawing);
}

// 初始化頁面
async function initializePage() {
    try {
        // 從 URL 獲取宣導 ID
        const urlParams = new URLSearchParams(window.location.search);
        announcementId = urlParams.get('id');
        
        if (!announcementId) {
            showError('缺少宣導 ID');
            return;
        }
        
        // 從 LINE LIFF 或 URL 獲取用戶資訊
        await getUserInfo();
        
        // 載入宣導內容
        await loadAnnouncementContent();
        
        // 檢查是否已簽名
        await checkSignatureStatus();
        
        // 顯示主要內容
        showMainContent();
        
    } catch (error) {
        console.error('初始化失敗:', error);
        showError(error.message || '載入失敗');
    }
}

// 獲取用戶資訊
async function getUserInfo() {
    try {
        // 這裡可以整合 LINE LIFF SDK 來獲取用戶資訊
        // 目前先使用測試資料
        const testUserId = 'test_user_' + Math.random().toString(36).substr(2, 9);
        
        // 從後端獲取用戶資訊（如果有的話）
        currentUserInfo = {
            userId: testUserId,
            employeeName: '測試用戶',
            employeeId: 'E001',
            department: '資訊中心',
            company: '測試公司'
        };
        
        // 更新顯示
        document.getElementById('employeeName').textContent = currentUserInfo.employeeName;
        document.getElementById('employeeId').textContent = currentUserInfo.employeeId;
        document.getElementById('department').textContent = currentUserInfo.department;
        
        // 設定簽名時間
        document.getElementById('signTime').textContent = new Date().toLocaleString('zh-TW');
        
    } catch (error) {
        throw new Error('無法獲取用戶資訊');
    }
}

// 載入宣導內容
async function loadAnnouncementContent() {
    try {
        const response = await fetch(`${API_BASE}/EAnnouncement/${announcementId}`);
        const result = await response.json();
        
        if (result.success) {
            const announcement = result.data;
            
            // 更新標題區域
            document.getElementById('announcementTitle').textContent = announcement.title;
            document.getElementById('documentType').textContent = announcement.documentType;
            document.getElementById('publishInfo').textContent = 
                `${announcement.publishUnit} • ${announcement.publishDate.split(' ')[0]}`;
            
            // 生成內容區域
            const contentArea = document.getElementById('contentArea');
            contentArea.innerHTML = generateContentBlocks(announcement.contentBlocks);
            
        } else {
            throw new Error(result.message || '載入宣導內容失敗');
        }
    } catch (error) {
        throw new Error('載入宣導內容失敗');
    }
}

// 生成內容區塊
function generateContentBlocks(contentBlocks) {
    if (!contentBlocks || contentBlocks.length === 0) {
        return '<p class="text-muted">尚無內容</p>';
    }
    
    return contentBlocks.map(block => {
        if (block.type === 'text') {
            return `<div class="content-block">
                        <div style="white-space: pre-wrap;">${block.content}</div>
                    </div>`;
        } else if (block.type === 'image') {
            return `<div class="content-block text-center">
                        <img src="${block.content}" alt="宣導圖片" class="img-fluid">
                    </div>`;
        }
        return '';
    }).join('');
}

// 檢查簽名狀態
async function checkSignatureStatus() {
    try {
        // 這裡可以檢查用戶是否已經簽名過
        // 目前暫時跳過
    } catch (error) {
        console.warn('檢查簽名狀態失敗:', error);
    }
}

// 開始繪圖
function startDrawing(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
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
    isDrawing = false;
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

// 清除簽名
function clearSignature() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// 檢查簽名是否為空
function isSignatureEmpty() {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return !imageData.data.some(channel => channel !== 0);
}

// 提交簽名
async function submitSignature() {
    try {
        if (isSignatureEmpty()) {
            showAlert('請先完成簽名', 'warning');
            return;
        }
        
        if (!currentUserInfo) {
            showAlert('用戶資訊載入失敗', 'error');
            return;
        }
        
        // 獲取簽名圖片 base64
        const signatureData = canvas.toDataURL('image/png');
        
        // 提交簽名
        const response = await fetch(`${API_BASE}/EAnnouncement/signature`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                announcementId: announcementId,
                userId: currentUserInfo.userId,
                signatureData: signatureData
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('簽名確認完成！', 'success');
            setTimeout(() => {
                showSignedState();
            }, 1500);
        } else {
            throw new Error(result.message || '簽名提交失敗');
        }
        
    } catch (error) {
        console.error('提交簽名失敗:', error);
        showAlert(error.message || '簽名提交失敗', 'error');
    }
}

// 顯示主要內容
function showMainContent() {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
}

// 顯示已簽名狀態
function showSignedState() {
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('signedState').style.display = 'block';
}

// 顯示錯誤狀態
function showError(message) {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorState').style.display = 'block';
}

// 顯示提示訊息
function showAlert(message, type = 'info') {
    const toast = document.getElementById('alertToast');
    const title = document.getElementById('toastTitle');
    const body = document.getElementById('toastBody');
    
    // 設定樣式
    const bgClass = type === 'error' ? 'bg-danger' : 
                   type === 'success' ? 'bg-success' : 
                   type === 'warning' ? 'bg-warning' : 'bg-info';
    
    toast.className = `toast align-items-center text-white ${bgClass} border-0`;
    title.textContent = type === 'error' ? '錯誤' : 
                       type === 'success' ? '成功' : 
                       type === 'warning' ? '警告' : '通知';
    body.textContent = message;
    
    // 顯示 Toast
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
}