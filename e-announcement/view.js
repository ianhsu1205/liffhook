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
let currentUser = null;
let signaturePad = null;
let hasSignature = false;

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
        announcementId = urlParams.get('id') || window.location.pathname.split('/').pop();
        
        if (!announcementId) {
            throw new Error('缺少宣導 ID');
        }
        
        // 初始化簽名板
        initializeSignaturePad();
        
        // 模擬用戶資料（實際應從 LIFF 獲取）
        await loadUserInfo();
        
        // 載入宣導內容
        await loadAnnouncement();
        
        // 檢查是否已簽名
        await checkSignatureStatus();
        
    } catch (error) {
        console.error('初始化頁面失敗:', error);
        showAlert(error.message || '載入頁面失敗', 'error');
    } finally {
        hideLoading();
    }
}

// 載入用戶資訊（模擬）
async function loadUserInfo() {
    // 實際實作中應該從 LIFF 獲取用戶資訊
    // 這裡使用模擬資料
    currentUser = {
        userId: 'U12345678901234567890123456789012', // 模擬 LINE 用戶 ID
        name: '測試用戶',
        company: '測試公司',
        department: '資訊部',
        empId: 'EMP001'
    };
    
    // 顯示用戶資訊
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userCompany').textContent = currentUser.company;
    document.getElementById('userDepartment').textContent = currentUser.department;
    document.getElementById('userEmpId').textContent = currentUser.empId;
    document.getElementById('userInfoCard').style.display = 'block';
}

// 載入宣導內容
async function loadAnnouncement() {
    try {
        const response = await fetch(`${API_BASE}/EAnnouncement/${announcementId}`);
        const result = await response.json();
        
        if (result.success) {
            displayAnnouncement(result.data);
        } else {
            throw new Error(result.message || '載入宣導內容失敗');
        }
    } catch (error) {
        console.error('載入宣導內容失敗:', error);
        throw error;
    }
}

// 顯示宣導內容
function displayAnnouncement(data) {
    document.getElementById('announcementTitle').textContent = data.title;
    document.getElementById('documentType').textContent = data.documentType;
    document.getElementById('publishUnit').textContent = data.publishUnit;
    document.getElementById('publishDate').textContent = new Date(data.publishDate).toLocaleDateString();
    
    // 顯示內容區塊
    const contentContainer = document.getElementById('announcementContent');
    contentContainer.innerHTML = '';
    
    if (data.contentBlocks && data.contentBlocks.length > 0) {
        data.contentBlocks.forEach((block, index) => {
            const blockElement = createContentBlock(block, index + 1);
            contentContainer.appendChild(blockElement);
        });
    }
    
    document.getElementById('announcementCard').style.display = 'block';
}

// 建立內容區塊
function createContentBlock(block, index) {
    const blockDiv = document.createElement('div');
    blockDiv.className = 'content-block';
    
    if (block.type === 'text') {
        blockDiv.innerHTML = `
            <h6 class="text-primary mb-3">
                <i class="fas fa-align-left me-2"></i>內容 ${index}
            </h6>
            <div class="content-text">${block.content.replace(/\n/g, '<br>')}</div>
        `;
    } else if (block.type === 'image') {
        blockDiv.innerHTML = `
            <h6 class="text-primary mb-3">
                <i class="fas fa-image me-2"></i>圖片 ${index}
            </h6>
            <img src="${block.content}" alt="宣導圖片" class="img-fluid" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
            <div class="alert alert-warning" style="display: none;">
                <i class="fas fa-exclamation-triangle me-2"></i>圖片載入失敗
            </div>
        `;
    }
    
    return blockDiv;
}

// 檢查簽名狀態
async function checkSignatureStatus() {
    try {
        // 這裡應該調用 API 檢查用戶是否已簽名
        // 由於目前沒有對應的 API endpoint，暫時模擬
        
        // 模擬：50% 機率已簽名（測試用）
        const isAlreadySigned = Math.random() < 0.5;
        
        if (isAlreadySigned) {
            showAlreadySignedStatus();
        } else {
            showSignatureButton();
        }
    } catch (error) {
        console.error('檢查簽名狀態失敗:', error);
        // 發生錯誤時預設顯示簽名按鈕
        showSignatureButton();
    }
}

// 顯示已簽名狀態
function showAlreadySignedStatus() {
    document.getElementById('alreadySignedCard').style.display = 'block';
    document.getElementById('signedTime').textContent = new Date().toLocaleString();
    // 隱藏簽名按鈕
    document.getElementById('signatureBtn').style.display = 'none';
}

// 顯示簽名按鈕
function showSignatureButton() {
    document.getElementById('signatureBtn').style.display = 'block';
}

// 初始化簽名板
function initializeSignaturePad() {
    const canvas = document.getElementById('signatureCanvas');
    const ctx = canvas.getContext('2d');
    
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    
    // 設定畫筆樣式
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // 滑鼠事件
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // 觸控事件（手機支援）
    canvas.addEventListener('touchstart', handleTouch);
    canvas.addEventListener('touchmove', handleTouch);
    canvas.addEventListener('touchend', stopDrawing);
    
    function startDrawing(e) {
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        lastX = (e.clientX - rect.left) * scaleX;
        lastY = (e.clientY - rect.top) * scaleY;
        hasSignature = true;
    }
    
    function draw(e) {
        if (!isDrawing) return;
        
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const currentX = (e.clientX - rect.left) * scaleX;
        const currentY = (e.clientY - rect.top) * scaleY;
        
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(currentX, currentY);
        ctx.stroke();
        
        lastX = currentX;
        lastY = currentY;
    }
    
    function stopDrawing() {
        isDrawing = false;
    }
    
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
}

// 清除簽名
function clearSignature() {
    const canvas = document.getElementById('signatureCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasSignature = false;
    
    // 隱藏預覽
    document.getElementById('signaturePreview').style.display = 'none';
}

// 預覽簽名
function previewSignature() {
    if (!hasSignature) {
        showAlert('請先簽名', 'warning');
        return;
    }
    
    const canvas = document.getElementById('signatureCanvas');
    const dataURL = canvas.toDataURL('image/png');
    
    document.getElementById('signatureImage').src = dataURL;
    document.getElementById('signaturePreview').style.display = 'block';
}

// 提交簽名
async function submitSignature() {
    try {
        if (!hasSignature) {
            showAlert('請先簽名', 'warning');
            return;
        }
        
        // 禁用提交按鈕
        const submitBtn = document.getElementById('submitSignatureBtn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>提交中...';
        
        // 獲取簽名資料
        const canvas = document.getElementById('signatureCanvas');
        const signatureData = canvas.toDataURL('image/png');
        
        // 準備提交資料
        const submitData = {
            announcementId: announcementId,
            userId: currentUser.userId,
            signatureData: signatureData
        };
        
        // 提交簽名
        const response = await fetch(`${API_BASE}/EAnnouncement/signature`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(submitData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // 隱藏簽名 Modal
            bootstrap.Modal.getInstance(document.getElementById('signatureModal')).hide();
            
            // 顯示成功 Modal
            const successModal = new bootstrap.Modal(document.getElementById('successModal'));
            successModal.show();
            
            // 更新頁面狀態
            showAlreadySignedStatus();
            
        } else {
            throw new Error(result.message || '簽名提交失敗');
        }
        
    } catch (error) {
        console.error('提交簽名失敗:', error);
        showAlert(error.message || '簽名提交失敗', 'error');
        
        // 恢復提交按鈕
        const submitBtn = document.getElementById('submitSignatureBtn');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-check me-1"></i>確認提交';
    }
}

// 顯示載入中
function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

// 隱藏載入中
function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
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

// 錯誤處理
window.addEventListener('error', function(e) {
    console.error('頁面錯誤:', e.error);
    showAlert('頁面發生錯誤，請重新整理', 'error');
});

// 網路錯誤處理
window.addEventListener('unhandledrejection', function(e) {
    console.error('未處理的Promise錯誤:', e.reason);
    showAlert('網路連線錯誤，請檢查網路狀態', 'error');
});