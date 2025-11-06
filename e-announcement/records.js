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
let currentPage = 1;
let totalPages = 1;
let allRecords = [];
let filteredRecords = [];

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('API Base URL:', API_BASE);
    initializePage();
});

// 初始化頁面
async function initializePage() {
    try {
        showLoading();
        console.log('開始頁面初始化...');
        
        // 從 URL 獲取宣導 ID
        const urlParams = new URLSearchParams(window.location.search);
        announcementId = urlParams.get('id');
        
        console.log('從URL獲取的宣導ID:', announcementId);
        
        if (!announcementId) {
            console.error('缺少宣導ID');
            showAlert('缺少宣導 ID，請從宣導列表頁面進入', 'error');
            return;
        }
        
        console.log('開始載入宣導資訊...');
        // 載入宣導資訊
        await loadAnnouncementInfo();
        
        console.log('開始載入記錄...');
        // 載入記錄 (不在這裡隱藏載入動畫，由 loadRecords 負責)
        await loadRecords();
        
        console.log('頁面初始化完成');
        
    } catch (error) {
        console.error('初始化頁面失敗:', error);
        showAlert(error.message || '載入頁面失敗', 'error');
        hideLoading(); // 確保錯誤時隱藏載入動畫
    }
}

// 載入宣導資訊
async function loadAnnouncementInfo() {
    try {
        const response = await fetch(`${API_BASE}/EAnnouncement/${announcementId}`);
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('announcementTitle').textContent = 
                `${result.data.title} (${result.data.documentType})`;
        } else {
            throw new Error(result.message || '載入宣導資訊失敗');
        }
    } catch (error) {
        console.error('載入宣導資訊失敗:', error);
        throw error;
    }
}

// 載入記錄
async function loadRecords() {
    try {
        console.log(`正在載入記錄，宣導ID: ${announcementId}, 頁面: ${currentPage}`);
        const url = `${API_BASE}/EAnnouncement/${announcementId}/records?page=${currentPage}&pageSize=50`;
        console.log('API URL:', url);
        
        const response = await fetch(url);
        console.log('API 回應狀態:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('API 回應結果:', result);
        
        if (result.success) {
            allRecords = result.data || [];
            filteredRecords = [...allRecords];
            console.log(`載入了 ${allRecords.length} 筆記錄`);
            
            // 更新統計資訊
            updateStatistics();
            
            // 填入部門篩選選項
            populateDepartmentFilter();
            
            // 顯示記錄
            displayRecords();
            
            // 安全地調用 updatePagination，提供預設值
            const page = result.page || 1;
            const totalPages = result.totalPages || 1;
            const totalCount = result.totalCount || allRecords.length;
            console.log(`分頁資訊: page=${page}, totalPages=${totalPages}, totalCount=${totalCount}`);
            updatePagination(page, totalPages, totalCount);
            
            console.log('正在顯示統計卡片...');
            const statsCard = document.getElementById('statsCard');
            if (statsCard) {
                statsCard.style.display = 'block';
                console.log('統計卡片已設置為顯示狀態');
            } else {
                console.error('找不到 statsCard 元素');
            }
            
            console.log('記錄載入完成，準備隱藏載入動畫');
        } else {
            throw new Error(result.message || '載入記錄失敗');
        }
    } catch (error) {
        console.error('載入記錄失敗:', error);
        showAlert(error.message || '載入記錄失敗', 'error');
    } finally {
        console.log('loadRecords finally 區塊：正在隱藏載入動畫...');
        hideLoading();
        console.log('loadRecords finally 區塊：載入動畫隱藏完成');
    }
}

// 更新統計資訊
function updateStatistics() {
    console.log('updateStatistics() 被調用');
    const total = filteredRecords.length;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD格式
    const todayCount = filteredRecords.filter(record => {
        // 檢查記錄的簽名日期是否為今天（比較 YYYY-MM-DD 部分）
        const recordDate = record.signedAt ? record.signedAt.split(' ')[0] : '';
        return recordDate === today;
    }).length;
    const withSignature = filteredRecords.filter(record => record.hasSignature).length;
    
    console.log(`統計資料 - 總數: ${total}, 今日: ${todayCount}, 有簽名: ${withSignature}`);
    
    document.getElementById('totalCount').textContent = total;
    document.getElementById('todayCount').textContent = todayCount;
    document.getElementById('withSignatureCount').textContent = withSignature;
    document.getElementById('completionRate').textContent = 
        total > 0 ? Math.round((withSignature / total) * 100) + '%' : '0%';
    
    console.log('統計資料已更新到DOM');
}

// 填入部門篩選選項
function populateDepartmentFilter() {
    const departments = [...new Set(allRecords.map(record => record.department))].sort();
    const departmentSelect = document.getElementById('departmentFilter');
    
    departmentSelect.innerHTML = '<option value="">所有部門</option>';
    departments.forEach(dept => {
        const option = new Option(dept, dept);
        departmentSelect.appendChild(option);
    });
}

// 顯示記錄
function displayRecords() {
    console.log('displayRecords() 被調用，記錄數量:', filteredRecords.length);
    const recordsContainer = document.getElementById('recordsList');
    
    if (!recordsContainer) {
        console.error('找不到 recordsList 容器元素');
        return;
    }
    
    console.log('找到 recordsList 容器元素');
    
    if (filteredRecords.length === 0) {
        const noDataHtml = `
            <div class="text-center py-4">
                <i class="fas fa-inbox fa-3x text-muted mb-3"></i>
                <p class="text-muted">尚無符合條件的記錄</p>
            </div>
        `;
        console.log('設置空資料提示');
        recordsContainer.innerHTML = noDataHtml;
        console.log('recordsList 內容已設置:', recordsContainer.innerHTML);
        return;
    }
    
    const recordsHtml = filteredRecords.map(record => `
        <div class="card mb-3">
            <div class="card-body">
                <div class="row align-items-center">
                    <div class="col-md-3">
                        <h6 class="mb-1">${record.employeeName}</h6>
                        <small class="text-muted">員工編號：${record.employeeId}</small>
                    </div>
                    <div class="col-md-2">
                        <span class="badge bg-info">${record.company}</span>
                        <div class="small text-muted mt-1">${record.department}</div>
                    </div>
                    <div class="col-md-3">
                        <small class="text-muted">簽名時間</small>
                        <div>${record.signedAt || '未知時間'}</div>
                    </div>
                    <div class="col-md-2 text-center">
                        ${record.hasSignature ? 
                            `<button class="btn btn-sm btn-outline-success" onclick="viewSignature('${record.id}', '${record.employeeName}')">
                                <i class="fas fa-signature"></i><br>檢視簽名
                             </button>` :
                            `<div class="text-muted">
                                 <i class="fas fa-minus-circle"></i><br>無簽名圖片
                             </div>`
                        }
                    </div>
                    <div class="col-md-2 text-end">
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline-info" onclick="viewDetail('${record.id}')">
                                <i class="fas fa-eye"></i> 詳情
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    recordsContainer.innerHTML = recordsHtml;
}

// 套用篩選
function applyFilters() {
    const department = document.getElementById('departmentFilter').value;
    const date = document.getElementById('dateFilter').value;
    const name = document.getElementById('nameSearch').value.toLowerCase();
    
    filteredRecords = allRecords.filter(record => {
        const matchDepartment = !department || record.department === department;
        // 比較日期的 YYYY-MM-DD 部分
        const matchDate = !date || (record.signedAt && record.signedAt.split(' ')[0] === date);
        const matchName = !name || record.employeeName.toLowerCase().includes(name);
        
        return matchDepartment && matchDate && matchName;
    });
    
    updateStatistics();
    displayRecords();
    
    // 重置分頁
    currentPage = 1;
    updatePagination(1, 1, filteredRecords.length);
}

// 檢視詳情
async function viewDetail(recordId) {
    try {
        const record = filteredRecords.find(r => r.id === recordId);
        if (!record) {
            showAlert('找不到該記錄', 'error');
            return;
        }
        
        // 顯示詳情 Modal
        showDetailModal(record);
        
    } catch (error) {
        console.error('檢視詳情失敗:', error);
        showAlert('檢視詳情失敗', 'error');
    }
}

// 顯示詳情 Modal
function showDetailModal(record) {
    const modalHtml = `
        <div class="modal fade" id="detailModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">簽名記錄詳情</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6">
                                <h6>基本資訊</h6>
                                <table class="table table-borderless">
                                    <tr><td><strong>員工姓名：</strong></td><td>${record.employeeName}</td></tr>
                                    <tr><td><strong>員工編號：</strong></td><td>${record.employeeId}</td></tr>
                                    <tr><td><strong>公司：</strong></td><td>${record.company}</td></tr>
                                    <tr><td><strong>部門：</strong></td><td>${record.department}</td></tr>
                                </table>
                            </div>
                            <div class="col-md-6">
                                <h6>簽名資訊</h6>
                                <table class="table table-borderless">
                                    <tr><td><strong>簽名時間：</strong></td><td>${record.signedAt || '未知時間'}</td></tr>
                                    <tr><td><strong>有簽名圖片：</strong></td><td>${record.hasSignature ? '是' : '否'}</td></tr>
                                    <tr><td><strong>記錄ID：</strong></td><td>${record.id}</td></tr>
                                </table>
                            </div>
                        </div>
                        ${record.hasSignature ? `
                            <div class="mt-3">
                                <h6>簽名圖片</h6>
                                <div class="text-center">
                                    <button class="btn btn-outline-primary" onclick="viewSignature('${record.id}', '${record.employeeName}')">
                                        <i class="fas fa-signature"></i> 查看簽名
                                    </button>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">關閉</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 移除舊的 Modal（如果存在）
    const existingModal = document.getElementById('detailModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // 加入新的 Modal
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // 顯示 Modal
    const modal = new bootstrap.Modal(document.getElementById('detailModal'));
    modal.show();
}

// 匯出資料
async function exportData() {
    try {
        showLoading();
        
        // 準備匯出資料
        const exportData = filteredRecords.map(record => ({
            '員工姓名': record.employeeName,
            '員工編號': record.employeeId,
            '公司': record.company,
            '部門': record.department,
            '簽名時間': record.signedAt || '未知時間',
            '有簽名圖片': record.hasSignature ? '是' : '否'
        }));
        
        // 轉換為 CSV
        const csvContent = convertToCSV(exportData);
        
        // 下載檔案
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `簽名記錄_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showAlert('匯出成功', 'success');
        
    } catch (error) {
        console.error('匯出資料失敗:', error);
        showAlert('匯出資料失敗', 'error');
    } finally {
        hideLoading();
    }
}

// 轉換為 CSV 格式
function convertToCSV(data) {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvArray = [headers.join(',')];
    
    data.forEach(row => {
        const values = headers.map(header => {
            const value = row[header] || '';
            // 處理包含逗號的值
            return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
        });
        csvArray.push(values.join(','));
    });
    
    return csvArray.join('\n');
}

// 更新分頁
function updatePagination(page, totalPagesCount, totalCount) {
    currentPage = page;
    totalPages = totalPagesCount;
    
    const paginationNav = document.getElementById('paginationNav');
    const paginationUl = document.getElementById('pagination');
    
    if (totalPagesCount <= 1) {
        paginationNav.style.display = 'none';
        return;
    }
    
    paginationNav.style.display = 'block';
    
    let paginationHtml = '';
    
    // 上一頁
    if (page > 1) {
        paginationHtml += `<li class="page-item"><a class="page-link" href="#" onclick="changePage(${page - 1})">上一頁</a></li>`;
    }
    
    // 頁碼
    for (let i = Math.max(1, page - 2); i <= Math.min(totalPagesCount, page + 2); i++) {
        const activeClass = i === page ? 'active' : '';
        paginationHtml += `<li class="page-item ${activeClass}"><a class="page-link" href="#" onclick="changePage(${i})">${i}</a></li>`;
    }
    
    // 下一頁
    if (page < totalPagesCount) {
        paginationHtml += `<li class="page-item"><a class="page-link" href="#" onclick="changePage(${page + 1})">下一頁</a></li>`;
    }
    
    paginationUl.innerHTML = paginationHtml;
}

// 切換頁面
function changePage(page) {
    currentPage = page;
    loadRecords();
}

// 顯示載入中
function showLoading() {
    console.log('showLoading() 被調用');
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.setProperty('display', 'flex', 'important');
        console.log('載入動畫已顯示，display設為: flex !important');
    } else {
        console.error('找不到 loadingOverlay 元素');
    }
}

// 隱藏載入中
function hideLoading() {
    console.log('hideLoading() 被調用');
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.setProperty('display', 'none', 'important');
        console.log('載入動畫已隱藏，display設為: none !important');
        console.log('loadingOverlay 當前樣式:', window.getComputedStyle(loadingOverlay).display);
    } else {
        console.error('找不到 loadingOverlay 元素');
    }
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

// 設定事件監聽器
document.addEventListener('DOMContentLoaded', function() {
    // 搜尋框即時篩選
    document.getElementById('nameSearch').addEventListener('input', function() {
        // 延遲執行以避免過多API調用
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(applyFilters, 300);
    });
    
    // Enter 鍵觸發搜尋
    document.getElementById('nameSearch').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            applyFilters();
        }
    });
});

// 查看簽名
window.viewSignature = function(recordId, employeeName) {
    fetch(`${API_BASE}/EAnnouncement/records/${recordId}/signature`)
        .then(response => {
            if (!response.ok) {
                throw new Error('無法取得簽名圖片');
            }
            return response.json();
        })
        .then(result => {
            if (result.success && result.data.signatureData) {
                // 建立簽名查看對話框
                const modal = new bootstrap.Modal(document.getElementById('signatureModal') || createSignatureModal());
                document.getElementById('signatureModalLabel').textContent = `${employeeName}的簽名`;
                document.getElementById('signatureImage').src = result.data.signatureData;
                modal.show();
            } else {
                throw new Error('無法取得簽名資料');
            }
        })
        .catch(error => {
            console.error('Error loading signature:', error);
            showAlert('無法載入簽名圖片：' + error.message, 'error');
        });
};

// 建立簽名檢視對話框
function createSignatureModal() {
    const modalHtml = `
        <div class="modal fade" id="signatureModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="signatureModalLabel">簽名檢視</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body text-center">
                        <img id="signatureImage" src="" alt="簽名圖片" class="img-fluid" style="max-height: 400px;">
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">關閉</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    return document.getElementById('signatureModal');
}