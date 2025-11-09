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

// LIFF 設定
const channelId = "2006992891"; // 服務 ID
const LIFF_ID = "2006993665-xkeLlPeW".trim(); // LIFF ID

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
        
        // 初始化 LIFF 並獲取用戶資訊
        await initializeLiffAndAuth();
        
        // 載入宣導內容
        await loadAnnouncementContent();
        
        // 檢查是否已簽名 - 如果已簽名會直接顯示已簽名狀態
        const hasSignature = await checkSignatureStatus();
        
        // 只有在尚未簽名時才顯示主要內容
        if (!hasSignature) {
            showMainContent();
        }
        
    } catch (error) {
        console.error('初始化失敗:', error);
        showError(error.message || '載入失敗');
    }
}

// 初始化 LIFF 並進行身份驗證
async function initializeLiffAndAuth() {
    try {
        console.log('🔄 初始化 LIFF 身份驗證...');
        
        // 初始化 LIFF
        await liff.init({ liffId: LIFF_ID });
        
        if (!liff.isLoggedIn()) {
            console.log('❌ 用戶未登入，重導向到登入頁面');
            liff.login();
            return;
        }
        
        console.log('✅ LIFF 初始化成功，獲取用戶資訊...');
        
        // 從 LIFF 獲取真實用戶資訊
        const profile = await liff.getProfile();
        
        // 檢查用戶是否在系統中註冊
        await getUserInfo(profile.userId);
        
    } catch (error) {
        console.error('❌ LIFF 初始化失敗:', error);
        
        // 如果是本地開發環境，使用測試模式
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('🔧 本地開發模式，使用測試用戶');
            await useTestUser();
        } else {
            throw new Error('身份驗證失敗，請重新開啟頁面');
        }
    }
}

// 獲取用戶資訊（使用 LIFF 驗證後的真實 UserId）
async function getUserInfo(verifiedUserId) {
    try {
        console.log('📋 查詢用戶資訊，UserId:', verifiedUserId, 'ChannelId:', channelId);
        
        // 呼叫後端API獲取用戶資訊
        const response = await fetch(`${API_BASE}/User/checkUser`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                UserId: verifiedUserId,
                ChannelId: channelId
            })
        });
        
        if (response.ok) {
            const userData = await response.json();
            console.log('✅ 從API獲取的用戶資訊:', userData);
            
            currentUserInfo = {
                userId: verifiedUserId,
                employeeName: userData.name || userData.Name || '未知姓名',
                employeeId: userData.empId || userData.EmpId || '未知編號',
                department: userData.dept || userData.Dept || '未知部門',
                company: userData.company || userData.Company || '未知公司',
                job: userData.job || userData.Job || '未知職務',
                groupCode: userData.groupCode || userData.GroupCode || '',
                phone: userData.phone || userData.Phone || '',
                source: 'line'
            };
            
            console.log('✅ 設定的用戶資訊:', currentUserInfo);
            return;
        } else {
            console.warn('⚠️ API回應失敗，狀態碼:', response.status);
            const errorText = await response.text();
            throw new Error(`用戶驗證失敗: ${errorText}`);
        }
    } catch (error) {
        console.error('❌ 獲取用戶資訊失敗:', error);
        throw new Error('無法獲取用戶資訊，您可能沒有權限訪問此宣導內容');
    }
}

// 使用測試用戶（僅限本地開發）
async function useTestUser() {
    const urlParams = new URLSearchParams(window.location.search);
    const testUserId = urlParams.get('userId') || 'test_user_001';
    
    currentUserInfo = {
        userId: testUserId,
        employeeName: '測試用戶',
        employeeId: 'TEST001',
        department: '測試部門',
        company: '測試公司',
        job: '測試職務',
        groupCode: 'TEST',
        phone: '0900-000-000',
        source: 'test'
    };
    
    console.log('🔧 使用測試用戶:', currentUserInfo);
}

// 載入宣導內容
async function loadAnnouncementContent() {
    try {
        const response = await fetch(`${API_BASE}/EAnnouncement/${announcementId}`);
        const result = await response.json();
        
        if (result.success) {
            currentAnnouncement = result.data; // 儲存到全域變數
            
            // 檢查專案是否已封存
            if (currentAnnouncement.isArchived) {
                showAnnouncementEndedMessage();
                return;
            }
            
            // 更新標題區域
            document.getElementById('announcementTitle').textContent = currentAnnouncement.title;
            document.getElementById('documentType').textContent = currentAnnouncement.documentType;
            document.getElementById('publishInfo').textContent = 
                `${currentAnnouncement.publishUnit} • ${currentAnnouncement.publishDate.split(' ')[0]}`;
            
            // 生成內容區域
            const contentArea = document.getElementById('contentArea');
            contentArea.innerHTML = generateContentBlocks(currentAnnouncement.contentBlocks);
            
        } else {
            // 專案不存在或其他錯誤
            showAnnouncementEndedMessage();
        }
    } catch (error) {
        // 網路錯誤或其他問題
        showAnnouncementEndedMessage();
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
        if (!currentUserInfo || !announcementId) {
            return false;
        }

        // 檢查用戶是否已經簽名過
        const response = await fetch(`${API_BASE}/EAnnouncement/${announcementId}/records?pageSize=1000`);
        const result = await response.json();
        
        if (result.success && result.data) {
            // 查找當前用戶的簽名記錄
            const userRecord = result.data.find(record => record.userId === currentUserInfo.userId);
            
            if (userRecord) {
                console.log('用戶已完成簽名:', userRecord);
                
                // 開啟新視窗顯示簽名文件
                await openSignedDocumentWindow(userRecord);
                return true;
            }
        }
        
        return false;
    } catch (error) {
        console.warn('檢查簽名狀態失敗:', error);
        return false;
    }
}

// 開啟新視窗顯示已簽名文件
async function openSignedDocumentWindow(userRecord) {
    try {
        // 獲取簽名圖片
        const signatureResponse = await fetch(`${API_BASE}/EAnnouncement/records/${userRecord.id}/signature`);
        const signatureResult = await signatureResponse.json();
        
        let signatureData = '';
        if (signatureResult.success && signatureResult.data.signatureData) {
            signatureData = signatureResult.data.signatureData;
        }

        // 生成完整的已簽名文件HTML
        const signedDocumentHtml = generateSignedDocumentHTML(userRecord, signatureData);
        
        // 檢測是否為手機裝置
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
        
        if (isMobile) {
            // 手機版：在當前頁面顯示並提供關閉功能
            showSignedDocumentInCurrentWindow(signedDocumentHtml);
        } else {
            // 桌面版：開啟新視窗
            openSignedDocumentInNewWindow(signedDocumentHtml);
        }
        
    } catch (error) {
        console.error('開啟簽名文件失敗:', error);
        // 如果無法載入簽名，仍然顯示已簽名狀態
        showSignedState();
    }
}

// 在當前視窗顯示簽名文件（手機版）
function showSignedDocumentInCurrentWindow(htmlContent) {
    // 隱藏所有其他元素
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('errorState').style.display = 'none';
    document.getElementById('signedState').style.display = 'none';
    
    // 創建或更新簽名文件顯示區域
    let signedDocumentDiv = document.getElementById('signedDocumentView');
    if (!signedDocumentDiv) {
        signedDocumentDiv = document.createElement('div');
        signedDocumentDiv.id = 'signedDocumentView';
        document.querySelector('.container').appendChild(signedDocumentDiv);
    }
    
    signedDocumentDiv.innerHTML = htmlContent;
    signedDocumentDiv.style.display = 'block';
}

// 在新視窗顯示簽名文件（桌面版）
function openSignedDocumentInNewWindow(htmlContent) {
    const newWindow = window.open('', '_blank', 'width=900,height=700,scrollbars=yes,resizable=yes');
    
    if (newWindow) {
        newWindow.document.write(`
            <!DOCTYPE html>
            <html lang="zh-TW">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>簽名確認書</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                        background-color: #f8f9fa;
                        margin: 0;
                        padding: 0;
                    }
                    .document-preview {
                        max-width: 800px;
                        margin: 20px auto;
                        background: white;
                        padding: 40px;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                        border-radius: 8px;
                    }
                    .signature-display img {
                        border-radius: 4px;
                    }
                    .document-info {
                        background-color: #f8f9fa;
                        padding: 15px;
                        border-radius: 6px;
                        border-left: 4px solid #007bff;
                    }
                    .signature-confirmation {
                        background-color: #f0f9f0;
                        padding: 25px;
                        border-radius: 8px;
                        border: 1px solid #d4edda;
                    }
                    @media print {
                        .btn { display: none; }
                        .document-preview { box-shadow: none; margin: 0; }
                    }
                </style>
            </head>
            <body>
                ${htmlContent}
                <script>
                    function closeWindow() {
                        window.close();
                    }
                </script>
            </body>
            </html>
        `);
        newWindow.document.close();
        
        // 關閉原視窗
        setTimeout(() => {
            window.close();
        }, 500);
    } else {
        // 如果無法開啟新視窗，回退到當前視窗顯示
        showSignedDocumentInCurrentWindow(htmlContent);
    }
}

// 生成簽名文件HTML
function generateSignedDocumentHTML(userRecord, signatureData) {
    const targetDepartments = (() => {
        try {
            if (typeof currentAnnouncement.targetDepartments === 'string') {
                return JSON.parse(currentAnnouncement.targetDepartments).join('、');
            } else if (Array.isArray(currentAnnouncement.targetDepartments)) {
                return currentAnnouncement.targetDepartments.join('、');
            } else {
                return currentAnnouncement.targetDepartments;
            }
        } catch (e) {
            return currentAnnouncement.targetDepartments;
        }
    })();

    return `
        <div class="document-preview">
            <div class="document-content">
                <!-- 文件標頭 -->
                <div class="document-header text-center mb-4">
                    <h3 class="mb-3">${currentAnnouncement.title}</h3>
                    <div class="d-flex justify-content-center align-items-center mb-2">
                        <span class="badge bg-primary me-3">${currentAnnouncement.documentType}</span>
                        <span class="text-muted">${currentAnnouncement.publishUnit} • ${currentAnnouncement.publishDate.split(' ')[0]}</span>
                    </div>
                    <hr style="border-top: 2px solid #000; margin: 20px 0;">
                </div>
                
                <!-- 文件資訊 -->
                <div class="document-info mb-4">
                    <div class="row mb-2">
                        <div class="col-3"><strong>發佈單位：</strong></div>
                        <div class="col-9">${currentAnnouncement.publishUnit}</div>
                    </div>
                    <div class="row mb-2">
                        <div class="col-3"><strong>目標公司：</strong></div>
                        <div class="col-9">${currentAnnouncement.targetCompany}</div>
                    </div>
                    <div class="row mb-2">
                        <div class="col-3"><strong>目標部門：</strong></div>
                        <div class="col-9">${targetDepartments}</div>
                    </div>
                    <hr style="margin: 20px 0;">
                </div>
                
                <!-- 宣導內容 -->
                <div class="document-body mb-5">
                    <h5 class="mb-3">宣導內容</h5>
                    <div class="content-area">
                        ${generateContentBlocks(currentAnnouncement.contentBlocks)}
                    </div>
                </div>
                
                <!-- 簽名確認區域 -->
                <div class="signature-confirmation mt-5 pt-4" style="border-top: 2px solid #000;">
                    <div class="text-center mb-4">
                        <h5>簽名確認</h5>
                        <p class="text-success"><i class="fas fa-check-circle me-2"></i>已完成簽名確認</p>
                    </div>
                    
                    <div class="signature-section">
                        <div class="row align-items-center">
                            <div class="col-md-6">
                                <div class="mb-2"><strong>簽名人員：</strong>${userRecord.employeeName}</div>
                                <div class="mb-2"><strong>員工編號：</strong>${userRecord.employeeId}</div>
                                <div class="mb-2"><strong>部門：</strong>${userRecord.company} ${userRecord.department}</div>
                                <div class="mt-3"><strong>確認聲明：</strong><span class="text-primary">我已閱讀並知悉以上內容</span></div>
                            </div>
                            <div class="col-md-6 text-center">
                                <div class="signature-display">
                                    <div class="mb-2"><strong>數位簽名：</strong></div>
                                    ${signatureData ? 
                                        `<div class="border rounded p-3" style="background-color: #f8f9fa;">
                                            <img src="${signatureData}" alt="數位簽名" style="max-width: 200px; max-height: 100px; border: 1px solid #dee2e6; background: white; padding: 10px;">
                                        </div>` : 
                                        '<div class="text-muted">無簽名圖片</div>'
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 關閉按鈕 -->
                    <div class="text-center mt-5 pt-4" style="border-top: 1px solid #dee2e6;">
                        <button
                            type="button"
                            class="btn btn-lg btn-outline-secondary"
                            onclick="closeWindow()"
                            style="min-width: 200px;"
                        >
                            <i class="fas fa-times me-2"></i>關閉視窗
                        </button>
                    </div>
                </div>
                
                <!-- 頁腳 -->
                <div class="document-footer mt-5 pt-3 text-center" style="border-top: 1px solid #eee;">
                    <small class="text-muted">
                        此為數位簽名確認書
                    </small>
                </div>
            </div>
        </div>
    `;
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

// 共用的簽名資料提交函數
async function submitSignatureData(signatureData) {
    try {
        if (!signatureData || !currentUserInfo) {
            showAlert('簽名資料錯誤，請重新簽名', 'error');
            return;
        }
        
        // 設置當前簽名資料
        currentSignatureData = signatureData;
        
        // 直接提交簽名（橫式簽名跳過預覽）
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
            
            // 延遲後跳轉
            setTimeout(() => {
                if (currentUserInfo?.source === 'line' && typeof liff !== 'undefined') {
                    // 如果是從 LINE 來的，關閉 LIFF 視窗
                    try {
                        liff.closeWindow();
                    } catch (e) {
                        closeWindow();
                    }
                } else {
                    // 返回用戶頁面或關閉視窗
                    if (document.referrer.includes('user.html')) {
                        window.location.href = 'user.html';
                    } else {
                        goBack();
                    }
                }
            }, 2000);
        } else {
            throw new Error(result.message || '簽名提交失敗');
        }
    } catch (error) {
        console.error('簽名提交失敗:', error);
        showAlert('簽名提交失敗：' + error.message, 'error');
    }
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
                    <strong>目標部門：</strong>${(() => {
                        try {
                            if (typeof currentAnnouncement.targetDepartments === 'string') {
                                return JSON.parse(currentAnnouncement.targetDepartments).join('、');
                            } else if (Array.isArray(currentAnnouncement.targetDepartments)) {
                                return currentAnnouncement.targetDepartments.join('、');
                            } else {
                                return currentAnnouncement.targetDepartments;
                            }
                        } catch (e) {
                            return currentAnnouncement.targetDepartments;
                        }
                    })()}
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
                            <span class="me-3"><strong>${currentUserInfo.company} ${currentUserInfo.department} ${currentUserInfo.employeeId}</strong></span>
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

// 確認簽名並提交（用於一般簽名預覽模式）
async function confirmSignature() {
    try {
        if (!currentSignatureData || !currentUserInfo) {
            showAlert('簽名資料錯誤，請重新簽名', 'error');
            return;
        }
        
        // 關閉預覽 Modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('previewModal'));
        if (modal) {
            modal.hide();
        }
        
        // 使用共用的提交函數
        await submitSignatureData(currentSignatureData);
        
    } catch (error) {
        console.error('確認簽名失敗:', error);
        showAlert('簽名確認失敗：' + error.message, 'error');
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
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('errorState').style.display = 'none';
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

// 關閉視窗函數
function closeWindow() {
    try {
        // 如果是從 LINE 進入的，使用 LIFF 關閉
        if (currentUserInfo?.source === 'line' && typeof liff !== 'undefined') {
            try {
                liff.closeWindow();
                return;
            } catch (liffError) {
                console.warn('LIFF 關閉失敗，使用備用方式:', liffError);
            }
        }
        
        // 檢測是否為手機裝置
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
        
        if (isMobile) {
            // 手機版：嘗試多種關閉方式
            if (window.history.length > 1) {
                window.history.back();
            } else if (window.opener) {
                window.close();
            } else {
                // 如果是在 APP 內嵌的 WebView，嘗試發送關閉信號
                if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.close) {
                    window.webkit.messageHandlers.close.postMessage('close');
                } else if (window.Android && typeof window.Android.close === 'function') {
                    window.Android.close();
                } else {
                    // 最後備用方案：導向到用戶頁面
                    if (confirm('無法自動關閉視窗，是否要返回用戶頁面？')) {
                        window.location.href = 'user.html';
                    }
                }
            }
        } else {
            // 桌面版：嘗試關閉視窗
            if (window.opener) {
                window.close();
            } else {
                // 如果不是彈出視窗，導向到歷史記錄上一頁
                if (window.history.length > 1) {
                    window.history.back();
                } else {
                    // 嘗試導向到用戶頁面
                    window.location.href = 'user.html';
                }
            }
        }
    } catch (error) {
        console.error('關閉視窗失敗:', error);
        // 備用方案：導向到用戶頁面
        if (confirm('關閉視窗失敗，是否要返回用戶頁面？')) {
            window.location.href = 'user.html';
        }
    }
}

// PDF匯出功能 - 匯出當前使用者的簽名記錄
async function exportToPDF() {
    try {
        if (!announcementId || !currentUserInfo) {
            showAlert('匯出資料不完整，請重新整理頁面', 'error');
            return;
        }
        
        showAlert('正在產生PDF文件...', 'info');
        
        // 先取得當前使用者的簽名記錄ID
        const recordResponse = await fetch(`${API_BASE}/EAnnouncement/${announcementId}/records`);
        if (!recordResponse.ok) {
            showAlert('無法取得簽名記錄', 'error');
            return;
        }
        
        const recordsResult = await recordResponse.json();
        const userRecord = recordsResult.data.find(record => 
            record.employeeId === currentUserInfo.employeeId
        );
        
        if (!userRecord) {
            showAlert('找不到您的簽名記錄', 'error');
            return;
        }
        
        // 呼叫單一記錄匯出API
        const response = await fetch(`${API_BASE}/EAnnouncement/records/${userRecord.id}/export-pdf`);
        
        if (response.ok) {
            // 取得PDF Blob
            const pdfBlob = await response.blob();
            
            // 從response header取得正確檔名，或使用預設格式
            const contentDisposition = response.headers.get('Content-Disposition');
            let fileName = `${currentAnnouncement ? currentAnnouncement.title.replace(/[/\\]/g, '-') : '宣導內容'}_${currentUserInfo.employeeId}_${currentUserInfo.employeeName}_${new Date().toISOString().split('T')[0]}.pdf`;
            
            if (contentDisposition) {
                const fileNameMatch = contentDisposition.match(/filename\*?=([^;]+)/);
                if (fileNameMatch) {
                    const encodedFileName = fileNameMatch[1].trim();
                    if (encodedFileName.startsWith("UTF-8''")) {
                        fileName = decodeURIComponent(encodedFileName.substring(7));
                    } else {
                        fileName = encodedFileName.replace(/"/g, '');
                    }
                }
            }
            
            // 建立下載連結
            const downloadUrl = window.URL.createObjectURL(pdfBlob);
            const downloadLink = document.createElement('a');
            downloadLink.href = downloadUrl;
            downloadLink.download = fileName;
            
            // 觸發下載
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
            // 清理URL物件
            window.URL.revokeObjectURL(downloadUrl);
            
            showAlert('PDF已下載完成', 'success');
        } else {
            const errorResult = await response.json();
            throw new Error(errorResult.message || 'PDF產生失敗');
        }
        
    } catch (error) {
        console.error('匯出PDF失敗:', error);
        showAlert(`匯出 PDF 失敗: ${error.message}`, 'error');
    }
}

// 顯示宣導已結束訊息並自動返回
function showAnnouncementEndedMessage() {
    // 隱藏主要內容
    const mainContent = document.querySelector('.container');
    if (mainContent) {
        mainContent.style.display = 'none';
    }
    
    // 創建結束訊息頁面
    const endMessage = document.createElement('div');
    endMessage.className = 'container-fluid d-flex align-items-center justify-content-center';
    endMessage.style.minHeight = '100vh';
    endMessage.style.backgroundColor = '#f8f9fa';
    
    endMessage.innerHTML = `
        <div class="text-center">
            <div class="mb-4">
                <i class="fas fa-info-circle text-warning" style="font-size: 5rem;"></i>
            </div>
            <h2 class="text-muted mb-3">此宣導已結束或失效</h2>
            <p class="lead text-muted mb-4">很抱歉，您要查看的宣導內容已經結束或不再有效。</p>
            <div class="d-flex gap-2 justify-content-center">
                <button class="btn btn-primary btn-lg" onclick="goBack()">
                    <i class="fas fa-arrow-left me-2"></i>返回上一頁
                </button>
                <button class="btn btn-outline-secondary btn-lg" onclick="closeWindow()">
                    <i class="fas fa-times me-2"></i>關閉視窗
                </button>
            </div>
            <div id="autoRedirectInfo" class="mt-3">
                <small class="text-muted">將在 <span id="countdown">5</span> 秒後自動返回上一頁...</small>
            </div>
        </div>
    `;
    
    document.body.appendChild(endMessage);
    
    // 自動倒數返回
    let countdown = 5;
    const countdownElement = document.getElementById('countdown');
    const timer = setInterval(() => {
        countdown--;
        if (countdownElement) {
            countdownElement.textContent = countdown;
        }
        
        if (countdown <= 0) {
            clearInterval(timer);
            goBack();
        }
    }, 1000);
}

// 返回上一頁
function goBack() {
    if (window.history.length > 1) {
        window.history.back();
    } else {
        // 如果沒有上一頁，嘗試關閉視窗
        closeWindow();
    }
}

// 關閉視窗
function closeWindow() {
    try {
        window.close();
    } catch (e) {
        // 如果無法關閉視窗，顯示提示
        showAlert('請手動關閉此頁面', 'info');
    }
}

// ================= 橫式簽名功能 =================

let landscapeCanvas = null;
let landscapeCtx = null;
let landscapeIsDrawing = false;
let landscapeHasContent = false;

// 顯示一般簽名模式
function showNormalSignature() {
    const normalArea = document.getElementById('normalSignatureArea');
    const saveBtn = document.getElementById('saveSignatureBtn');
    
    normalArea.style.display = 'block';
    saveBtn.style.display = 'block';
    
    // 重新初始化簽名板
    setTimeout(() => {
        initializeSignaturePad();
    }, 100);
}

// 進入橫式簽名模式
function enterLandscapeMode() {
    const signatureModal = bootstrap.Modal.getInstance(document.getElementById('signatureModal'));
    signatureModal.hide();
    
    // 顯示橫式簽名模態
    const landscapeModal = new bootstrap.Modal(document.getElementById('landscapeSignatureModal'));
    landscapeModal.show();
    
    // 添加全螢幕樣式
    const modalElement = document.getElementById('landscapeSignatureModal');
    modalElement.classList.add('landscape-signature-mode');
    
    // 初始化橫式簽名板
    setTimeout(() => {
        initializeLandscapeSignaturePad();
    }, 300);
}

// 初始化橫式簽名板
function initializeLandscapeSignaturePad() {
    landscapeCanvas = document.getElementById('landscapeSignaturePad');
    if (!landscapeCanvas) return;
    
    landscapeCtx = landscapeCanvas.getContext('2d');
    
    // 設定Canvas大小為全螢幕減去控制區域
    const availableHeight = window.innerHeight - 120; // 扣除標題和控制區域
    landscapeCanvas.width = window.innerWidth - 20;
    landscapeCanvas.height = availableHeight;
    
    // 重置簽名狀態
    landscapeHasContent = false;
    
    // 設置畫筆樣式 - 橫式時使用更粗的筆觸
    landscapeCtx.strokeStyle = '#000000';
    landscapeCtx.lineWidth = 5;
    landscapeCtx.lineCap = 'round';
    landscapeCtx.lineJoin = 'round';
    
    // 清空畫布並設置白色背景
    landscapeCtx.fillStyle = '#ffffff';
    landscapeCtx.fillRect(0, 0, landscapeCanvas.width, landscapeCanvas.height);
    
    // 綁定觸摸事件
    bindLandscapeTouchEvents();
    
    // 更新按鈕狀態
    updateLandscapeButtons();
}

// 綁定橫式簽名板觸摸事件
function bindLandscapeTouchEvents() {
    // 觸摸事件
    landscapeCanvas.addEventListener('touchstart', handleLandscapeTouchStart, { passive: false });
    landscapeCanvas.addEventListener('touchmove', handleLandscapeTouchMove, { passive: false });
    landscapeCanvas.addEventListener('touchend', handleLandscapeTouchEnd, { passive: false });
    
    // 滑鼠事件（用於桌面測試）
    landscapeCanvas.addEventListener('mousedown', handleLandscapeMouseDown);
    landscapeCanvas.addEventListener('mousemove', handleLandscapeMouseMove);
    landscapeCanvas.addEventListener('mouseup', handleLandscapeMouseUp);
    landscapeCanvas.addEventListener('mouseleave', handleLandscapeMouseUp);
}

// 橫式簽名 - 觸摸開始
function handleLandscapeTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = landscapeCanvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    landscapeIsDrawing = true;
    landscapeCtx.beginPath();
    landscapeCtx.moveTo(x, y);
}

// 橫式簽名 - 觸摸移動
function handleLandscapeTouchMove(e) {
    e.preventDefault();
    if (!landscapeIsDrawing) return;
    
    const touch = e.touches[0];
    const rect = landscapeCanvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    landscapeCtx.lineTo(x, y);
    landscapeCtx.stroke();
    
    landscapeHasContent = true;
    updateLandscapeButtons();
}

// 橫式簽名 - 觸摸結束
function handleLandscapeTouchEnd(e) {
    e.preventDefault();
    landscapeIsDrawing = false;
}

// 橫式簽名 - 滑鼠按下
function handleLandscapeMouseDown(e) {
    const rect = landscapeCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    landscapeIsDrawing = true;
    landscapeCtx.beginPath();
    landscapeCtx.moveTo(x, y);
}

// 橫式簽名 - 滑鼠移動
function handleLandscapeMouseMove(e) {
    if (!landscapeIsDrawing) return;
    
    const rect = landscapeCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    landscapeCtx.lineTo(x, y);
    landscapeCtx.stroke();
    
    landscapeHasContent = true;
    updateLandscapeButtons();
}

// 橫式簽名 - 滑鼠放開
function handleLandscapeMouseUp(e) {
    landscapeIsDrawing = false;
}

// 更新橫式簽名按鈕狀態
function updateLandscapeButtons() {
    const saveBtn = document.getElementById('saveLandscapeSignatureBtn');
    if (landscapeHasContent) {
        saveBtn.disabled = false;
        saveBtn.classList.remove('btn-secondary');
        saveBtn.classList.add('btn-success');
    } else {
        saveBtn.disabled = true;
        saveBtn.classList.remove('btn-success');
        saveBtn.classList.add('btn-secondary');
    }
}

// 清除橫式簽名
function clearLandscapeSignature() {
    if (!landscapeCtx) return;
    
    landscapeCtx.fillStyle = '#ffffff';
    landscapeCtx.fillRect(0, 0, landscapeCanvas.width, landscapeCanvas.height);
    
    landscapeHasContent = false;
    updateLandscapeButtons();
}

// 儲存橫式簽名
function saveLandscapeSignature() {
    if (!landscapeHasContent) {
        showAlert('請先完成簽名', 'warning');
        return;
    }
    
    try {
        // 取得簽名資料
        const signatureData = landscapeCanvas.toDataURL('image/png');
        
        // 關閉橫式模態
        exitLandscapeMode();
        
        // 提交簽名
        submitSignatureData(signatureData);
        
    } catch (error) {
        console.error('儲存橫式簽名失敗:', error);
        showAlert('簽名儲存失敗，請重試', 'error');
    }
}

// 退出橫式簽名模式
function exitLandscapeMode() {
    const modalElement = document.getElementById('landscapeSignatureModal');
    const landscapeModal = bootstrap.Modal.getInstance(modalElement);
    
    if (landscapeModal) {
        landscapeModal.hide();
    }
    
    // 移除全螢幕樣式
    modalElement.classList.remove('landscape-signature-mode');
    
    // 重新顯示原本的簽名模態
    setTimeout(() => {
        const signatureModal = new bootstrap.Modal(document.getElementById('signatureModal'));
        signatureModal.show();
    }, 300);
}

// 處理視窗方向變化
window.addEventListener('orientationchange', function() {
    // 如果在橫式簽名模式中，重新初始化canvas大小
    if (document.getElementById('landscapeSignatureModal').classList.contains('landscape-signature-mode')) {
        setTimeout(() => {
            if (landscapeCanvas) {
                const availableHeight = window.innerHeight - 120;
                landscapeCanvas.width = window.innerWidth - 20;
                landscapeCanvas.height = availableHeight;
                
                // 重新設置背景
                landscapeCtx.fillStyle = '#ffffff';
                landscapeCtx.fillRect(0, 0, landscapeCanvas.width, landscapeCanvas.height);
                
                landscapeHasContent = false;
                updateLandscapeButtons();
            }
        }, 500); // 等待方向變化完成
    }
});