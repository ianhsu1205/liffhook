// 全域變數
const API_BASE = (() => {
    // 檢查是否為本地開發環境
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return window.location.origin + '/api';
    }
    // 生產環境使用指定的後端地址
    return 'https://35.221.146.143.nip.io/linehook';
})();
let announcementId = '';
let canvas, ctx;
let isDrawing = false;
let currentUserInfo = null;
let hasSignatureContent = false;
let currentSignatureData = null;
let currentAnnouncement = null; // 儲存當前宣導內容

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('API Base URL:', API_BASE);
    initializePage();
});

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
            currentAnnouncement = result.data; // 儲存到全域變數
            
            // 更新標題區域
            document.getElementById('announcementTitle').textContent = currentAnnouncement.title;
            document.getElementById('documentType').textContent = currentAnnouncement.documentType;
            document.getElementById('publishInfo').textContent = 
                `${currentAnnouncement.publishUnit} • ${currentAnnouncement.publishDate.split(' ')[0]}`;
            
            // 生成內容區域
            const contentArea = document.getElementById('contentArea');
            contentArea.innerHTML = generateContentBlocks(currentAnnouncement.contentBlocks);
            
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

// 開啟簽名 Modal
function openSignatureModal() {
    const modal = new bootstrap.Modal(document.getElementById('signatureModal'));
    modal.show();
    
    // 延遲初始化簽名板，確保 Modal 完全載入
    setTimeout(() => {
        initializeSignaturePad();
    }, 300);
}

// 關閉簽名 Modal
function closeSignatureModal() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('signatureModal'));
    if (modal) {
        modal.hide();
    }
}

// 初始化簽名板
function initializeSignaturePad() {
    canvas = document.getElementById('signaturePad');
    if (!canvas) return;
    
    ctx = canvas.getContext('2d');
    
    // 動態設定Canvas大小以適應容器
    const container = canvas.parentElement;
    const containerWidth = container.clientWidth - 20; // 留一些邊距
    const isMobile = window.innerWidth <= 768;
    
    // 根據裝置類型設定大小
    if (isMobile) {
        canvas.width = Math.min(containerWidth, 600);
        canvas.height = 250;
    } else {
        canvas.width = Math.min(containerWidth, 700);
        canvas.height = 300;
    }
    
    // 重置簽名狀態
    hasSignatureContent = false;
    
    // 設置畫筆樣式
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = isMobile ? 4 : 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // 清空畫布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 移除之前的事件監聽器
    canvas.removeEventListener('mousedown', startDrawing);
    canvas.removeEventListener('mousemove', draw);
    canvas.removeEventListener('mouseup', stopDrawing);
    canvas.removeEventListener('mouseout', stopDrawing);
    canvas.removeEventListener('touchstart', handleTouch);
    canvas.removeEventListener('touchmove', handleTouch);
    canvas.removeEventListener('touchend', stopDrawing);
    
    // 重新添加事件監聽器
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // 觸控事件
    canvas.addEventListener('touchstart', handleTouch);
    canvas.addEventListener('touchmove', handleTouch);
    canvas.addEventListener('touchend', stopDrawing);
}

// 開始繪圖
function startDrawing(e) {
    isDrawing = true;
    hasSignatureContent = true;
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
    if (isDrawing) {
        isDrawing = false;
        ctx.beginPath(); // 重要：結束當前路徑，準備下一筆
    }
}

// 處理觸控事件
function handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0] || e.changedTouches[0];
    if (!touch) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseEvent = new MouseEvent(
        e.type === 'touchstart' ? 'mousedown' : 
        e.type === 'touchmove' ? 'mousemove' : 'mouseup', 
        {
            clientX: touch.clientX,
            clientY: touch.clientY,
            bubbles: true,
            cancelable: true
        }
    );
    canvas.dispatchEvent(mouseEvent);
}

// 清除簽名
function clearSignature() {
    if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasSignatureContent = false;
    }
}

// 檢查簽名是否為空
function isSignatureEmpty() {
    return !hasSignatureContent;
}

// 儲存簽名並顯示預覽
function saveSignature() {
    if (isSignatureEmpty()) {
        showAlert('請先完成簽名', 'warning');
        return;
    }
    
    // 獲取簽名圖片 base64
    currentSignatureData = canvas.toDataURL('image/png');
    
    // 顯示預覽
    showPreview();
}

// 顯示簽名預覽
function showPreview() {
    // 關閉簽名 Modal
    closeSignatureModal();
    
    // 生成完整文件預覽
    generateDocumentPreview();
    
    // 顯示預覽 Modal
    const modal = new bootstrap.Modal(document.getElementById('previewModal'));
    modal.show();
}

// 生成完整文件預覽
function generateDocumentPreview() {
    if (!currentAnnouncement || !currentSignatureData || !currentUserInfo) {
        showAlert('預覽資料不完整', 'error');
        return;
    }
    
    const previewHtml = `
        <div class="document-content">
            <div class="document-header">
                <h4 class="mb-0">${currentAnnouncement.title}</h4>
                <div class="d-flex justify-content-between align-items-center mt-2">
                    <span class="badge bg-light text-dark">${currentAnnouncement.documentType}</span>
                    <span>${currentAnnouncement.publishUnit} • ${currentAnnouncement.publishDate.split(' ')[0]}</span>
                </div>
            </div>
            <div class="document-body">
                <div class="mb-3">
                    <strong>發佈單位：</strong>${currentAnnouncement.publishUnit}
                </div>
                <div class="mb-3">
                    <strong>目標公司：</strong>${currentAnnouncement.targetCompany}
                </div>
                <div class="mb-3">
                    <strong>目標部門：</strong>${Array.isArray(currentAnnouncement.targetDepartments) ? currentAnnouncement.targetDepartments.join('、') : currentAnnouncement.targetDepartments}
                </div>
                <hr>
                <div class="content-area">
                    ${generateContentBlocks(currentAnnouncement.contentBlocks)}
                </div>
                
                <!-- 文件底部簽名確認區域 -->
                <div class="mt-5 pt-4" style="padding-bottom: 100px;">
                    <hr style="border-top: 1px solid #000; margin-bottom: 20px;">
                    <div class="signature-section">
                        <div class="signature-text mb-3 text-end">
                            <span><strong>我已閱讀並知悉以上內容</strong></span>
                        </div>
                        <div class="signature-line d-flex justify-content-end align-items-center">
                            <span class="me-3"><strong>${currentUserInfo.department} ${currentUserInfo.employeeId}</strong></span>
                            <div class="signature-placeholder" style="width: 150px; text-align: center;">
                                <img src="${currentSignatureData}" class="signature-image" alt="數位簽名" style="max-width: 120px; max-height: 60px; border: none; background: transparent;">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('documentPreview').innerHTML = previewHtml;
}

// 確認簽名並提交
async function confirmSignature() {
    try {
        if (!currentSignatureData || !currentUserInfo) {
            showAlert('簽名資料錯誤，請重新簽名', 'error');
            return;
        }
        
        // 提交簽名
        const response = await fetch(`${API_BASE}/EAnnouncement/signature`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                announcementId: announcementId,
                userId: currentUserInfo.userId,
                signatureData: currentSignatureData
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 關閉預覽 Modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('previewModal'));
            if (modal) {
                modal.hide();
            }
            
            showAlert('簽名確認完成！', 'success');
            
            // 10秒後關閉視窗
            setTimeout(() => {
                showSignedState();
                setTimeout(() => {
                    window.close();
                }, 10000);
            }, 1500);
        } else {
            throw new Error(result.message || '簽名提交失敗');
        }
        
    } catch (error) {
        console.error('提交簽名失敗:', error);
        showAlert(error.message || '簽名提交失敗', 'error');
    }
}

// 取消預覽，返回簽名
function cancelPreview() {
    // 關閉預覽 Modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('previewModal'));
    if (modal) {
        modal.hide();
    }
    
    // 重新開啟簽名 Modal
    setTimeout(() => {
        openSignatureModal();
    }, 300);
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