// Global variables
const API_BASE = (() => {
    // Check if it's local development environment
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
       return window.location.origin + '/api';
    }
    // Production environment uses specified backend address
    return 'https://35.221.146.143.nip.io/linehook';
})();
let announcementId = '';
let currentPage = 1;
let totalPages = 1;
let allRecords = [];
let filteredRecords = [];

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('API Base URL:', API_BASE);
    initializePage();
});

// Initialize page
async function initializePage() {
    try {
        showLoading();
        console.log('Starting page initialization...');
        
        // Get announcement ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        announcementId = urlParams.get('id');
        
        console.log('Announcement ID from URL:', announcementId);
        
        if (!announcementId) {
            console.error('Missing announcement ID');
            showAlert('缺少宣導 ID，請從宣導列表頁面進入', 'error');
            hideLoading();
            return;
        }
        
        // Validate announcement ID format
        if (!isValidGuid(announcementId)) {
            console.error('Invalid announcement ID format:', announcementId);
            showAlert('無效的宣導 ID 格式', 'error');
            hideLoading();
            return;
        }
        
        console.log('Starting to load announcement management information...');
        // Load announcement management information (including statistics) - continue even if fails
        try {
            await loadRecordsManagement();
        } catch (managementError) {
            console.error('Management information loading failed, but continue loading records:', managementError);
        }
        
        console.log('Starting to load records...');
        // Load records (don't hide loading animation here, loadRecords is responsible for that)
        await loadRecords();
        
        console.log('Page initialization completed');
        
    } catch (error) {
        console.error('Page initialization failed:', error);
        showAlert(error.message || '載入頁面失敗', 'error');
        hideLoading(); // Ensure loading animation is hidden on error
    }
}

// Validate GUID format
function isValidGuid(guid) {
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return guidRegex.test(guid);
}

// Load announcement management information
async function loadRecordsManagement() {
    try {
        console.log('Calling API:', `${API_BASE}/EAnnouncement/${announcementId}/records-management`);
        
        const response = await fetch(`${API_BASE}/EAnnouncement/${announcementId}/records-management`);
        console.log('API response status:', response.status, response.statusText);
        
        if (!response.ok) {
            console.error('API response error:', response.status, response.statusText);
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('API response data:', result);
        console.log('API response data keys:', Object.keys(result));
        
        if (result.success && result.data) {
            const data = result.data;
            console.log('Parsed data:', data);
            console.log('Data keys:', Object.keys(data));
            console.log('Data.Announcement:', data.Announcement);
            
            // Check data structure
            if (!data.announcement) {
                console.error('Data structure error: missing announcement object', data);
                console.error('Available data properties:', Object.keys(data));
                throw new Error('Data structure error: missing announcement information');
            }
            
            if (!data.announcement.title) {
                console.error('Data structure error: announcement missing title property', data.announcement);
                throw new Error('Data structure error: missing announcement title');
            }
            
            // Update page title
            document.getElementById('announcementTitle').textContent = 
                `${data.announcement.title} (${data.announcement.documentType || '未指定'})`;
            
            // Update statistics
            updateManagementStatistics(data.statistics);
            
            // Show statistics cards
            const statsContainer = document.getElementById('statsContainer');
            if (statsContainer) {
                statsContainer.style.display = 'flex';
            }
            
        } else {
            console.error('API response failed:', result);
            throw new Error(result.message || '載入宣導管理資訊失敗');
        }
    } catch (error) {
        console.error('Failed to load announcement management information:', error);
        
        // If management API fails, try to load basic announcement information
        console.log('Trying to load basic announcement information as fallback...');
        try {
            await loadAnnouncementInfo();
            
            // Set empty statistics
            updateManagementStatistics({
                totalRecords: 0,
                withSignature: 0,
                withoutSignature: 0
            });
            
            console.log('Successfully loaded basic announcement information');
        } catch (fallbackError) {
            console.error('Loading basic announcement information also failed:', fallbackError);
            
            // Final fallback: show error state
            document.getElementById('announcementTitle').textContent = '載入失敗 - 請檢查宣導ID或重新整理頁面';
            
            showAlert('無法載入宣導資訊，請檢查宣導ID或稍後重試', 'error');
        }
        
        // Don't re-throw error, let page continue to try loading records
        console.log('Management information loading failed, but continue loading records...');
    }
}

// Update management statistics
function updateManagementStatistics(stats) {
    console.log('Updating management statistics:', stats);
    
    if (!stats) {
        console.warn('Stats is null or undefined, using default values');
        stats = {};
    }
    
    document.getElementById('totalCount').textContent = stats.totalRecords || 0;
    document.getElementById('withSignatureCount').textContent = stats.withSignature || 0;
    
    // Calculate completion rate
    const total = stats.totalRecords || 0;
    const withSignature = stats.withSignature || 0;
    const completionRate = total > 0 ? Math.round((withSignature / total) * 100) : 0;
    document.getElementById('completionRate').textContent = `${completionRate}%`;
    
    // Today's count (placeholder)
    document.getElementById('todayCount').textContent = 0;
}

// Load announcement information
async function loadAnnouncementInfo() {
    try {
        console.log('Loading basic announcement info for ID:', announcementId);
        const response = await fetch(`${API_BASE}/EAnnouncement/${announcementId}`);
        console.log('Basic announcement API response status:', response.status, response.statusText);
        
        const result = await response.json();
        console.log('Basic announcement API response data:', result);
        
        if (result.success) {
            console.log('Basic announcement data:', result.data);
            document.getElementById('announcementTitle').textContent = 
                `${result.data.title} (${result.data.documentType})`;
        } else {
            throw new Error(result.message || '載入公告資訊失敗');
        }
    } catch (error) {
        console.error('Failed to load announcement information:', error);
        throw error;
    }
}

// Load records
async function loadRecords() {
    try {
        console.log(`Loading records, announcement ID: ${announcementId}, page: ${currentPage}`);
        
        // Build query parameters
        const params = new URLSearchParams({
            page: currentPage,
            pageSize: 50
        });
        
        // Add search parameters
        const nameSearch = document.getElementById('nameSearch')?.value?.trim();
        const departmentFilter = document.getElementById('departmentFilter')?.value?.trim();
        const signatureFilter = document.getElementById('signatureFilter')?.value?.trim();
        
        if (nameSearch) {
            params.append('search', nameSearch);
        }
        if (departmentFilter) {
            params.append('department', departmentFilter);
        }
        if (signatureFilter) {
            params.append('signatureFilter', signatureFilter);
        }
        
        const response = await fetch(`${API_BASE}/EAnnouncement/${announcementId}/records?${params}`);
        console.log('Records API response status:', response.status, response.statusText);
        
        const result = await response.json();
        console.log('Records API response data:', result);
        console.log('Records API result.data:', result.data);
        console.log('Records API result.data type:', typeof result.data);
        console.log('Records API result.data.length:', result.data?.length);
        
        if (result.success) {
            allRecords = result.data || [];
            totalPages = result.totalPages || 1;
            filteredRecords = allRecords;
            
            console.log('Processed records:', allRecords);
            console.log('Sample record:', allRecords[0]);
            
            displayRecords(filteredRecords);
            updatePagination();
            updateDepartmentFilter(allRecords);
            
            console.log(`Loaded ${filteredRecords.length} records successfully`);
        } else {
            throw new Error(result.message || '載入記錄失敗');
        }
    } catch (error) {
        console.error('Failed to load records:', error);
        showAlert('載入記錄失敗: ' + error.message, 'error');
        
        // Show empty state
        const recordsList = document.getElementById('recordsList');
        if (recordsList) {
            recordsList.innerHTML = '<div class="alert alert-warning">Unable to load records</div>';
        }
    } finally {
        hideLoading();
    }
}

// Display records
function displayRecords(records) {
    const recordsContainer = document.getElementById('recordsList');
    
    if (!records || records.length === 0) {
        recordsContainer.innerHTML = '<div class="alert alert-info">找不到簽名記錄</div>';
        return;
    }
    
    const recordsHtml = records.map(record => {
        console.log('Rendering record:', record);
        console.log('Record keys:', Object.keys(record));
        
        // 根據簽名狀態設定卡片樣式
        const cardClass = record.hasSignature ? 'card mb-3 border-success' : 'card mb-3 border-warning';
        const bgClass = record.hasSignature ? 'bg-light' : 'bg-warning bg-opacity-10';
        
        return `
        <div class="${cardClass}">
            <div class="card-body ${bgClass}">
                <div class="row align-items-center">
                    <div class="col-md-3">
                        <h6 class="mb-1">${record.employeeName}</h6>
                        <small class="text-muted">員工編號: ${record.employeeId}</small>
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
                            `<span class="badge bg-success fs-6">
                                <i class="fas fa-check-circle me-1"></i>已簽名確認
                             </span>` :
                            `<span class="badge bg-danger fs-6">
                                <i class="fas fa-exclamation-triangle me-1"></i>尚未簽名
                             </span>`
                        }
                    </div>
                    <div class="col-md-2 text-end">
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline-primary" onclick="viewRecord('${record.id}')">
                                <i class="fas fa-eye"></i> 檢視
                            </button>
                            ${record.hasSignature ? 
                                `<button class="btn btn-sm btn-outline-success" onclick="viewSignature('${record.id}')">
                                    <i class="fas fa-signature"></i> 簽名
                                 </button>` : 
                                 `<button class="btn btn-sm btn-outline-secondary" disabled>
                                    <i class="fas fa-signature"></i> 簽名
                                 </button>`
                            }
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    }).join('');
    
    recordsContainer.innerHTML = recordsHtml;
}

// Apply filters
function applyFilters() {
    // Reload records to apply search
    currentPage = 1;
    loadRecords();
}

// Update pagination
function updatePagination() {
    const paginationNav = document.getElementById('paginationNav');
    const pagination = document.getElementById('pagination');
    
    if (totalPages <= 1) {
        paginationNav.style.display = 'none';
        return;
    }
    
    paginationNav.style.display = 'block';
    
    let paginationHtml = '';
    
    // Previous page
    paginationHtml += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <button class="page-link" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
                Previous
            </button>
        </li>
    `;
    
    // Page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHtml += `
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <button class="page-link" onclick="changePage(${i})">${i}</button>
            </li>
        `;
    }
    
    // Next page
    paginationHtml += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <button class="page-link" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
                Next
            </button>
        </li>
    `;
    
    pagination.innerHTML = paginationHtml;
}

// Change page
function changePage(page) {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
        currentPage = page;
        loadRecords();
    }
}

// Update department filter
function updateDepartmentFilter(records) {
    const departmentFilter = document.getElementById('departmentFilter');
    const departments = [...new Set(records.map(r => r.department))].sort();
    
    // Save current selection
    const currentValue = departmentFilter.value;
    
    // Clear and rebuild options
    departmentFilter.innerHTML = '<option value="">所有部門</option>';
    departments.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept;
        option.textContent = dept;
        departmentFilter.appendChild(option);
    });
    
    // Restore selection if still valid
    if (departments.includes(currentValue)) {
        departmentFilter.value = currentValue;
    }
}

// Show complete record
async function viewRecord(recordId) {
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE}/EAnnouncement/records/${recordId}/detail`);
        const result = await response.json();

        if (result.success) {
            showRecordModal(result.data);
        } else {
            throw new Error(result.message || 'Unable to load record details');
        }
    } catch (error) {
        console.error('View record failed:', error);
        showAlert('檢視記錄失敗: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Show record view Modal
function showRecordModal(data) {
    const modal = document.getElementById('recordModal');
    const recordContent = document.getElementById('recordContent');
    
    // Set Modal title
    document.getElementById('recordModalLabel').innerHTML = 
        `<i class="fas fa-file-alt me-2"></i>${data.announcement.title} - ${data.recordInfo.employeeName}`;
    
    // Build content HTML
    const contentHtml = `
        <div class="container-fluid">
            <!-- 宣導專案資訊 -->
            <div class="card mb-4">
                <div class="card-header bg-primary text-white">
                    <h5 class="mb-0"><i class="fas fa-bullhorn me-2"></i>宣導專案資訊</h5>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <table class="table table-borderless">
                                <tr><td class="fw-bold">標題:</td><td>${data.announcement.title}</td></tr>
                                <tr><td class="fw-bold">文件類型:</td><td><span class="badge bg-info">${data.announcement.documentType}</span></td></tr>
                                <tr><td class="fw-bold">發佈單位:</td><td>${data.announcement.publishUnit}</td></tr>
                            </table>
                        </div>
                        <div class="col-md-6">
                            <table class="table table-borderless">
                                <tr><td class="fw-bold">目標公司:</td><td>${data.announcement.targetCompany}</td></tr>
                                <tr><td class="fw-bold">發佈日期:</td><td>${new Date(data.announcement.publishDate).toLocaleDateString('zh-TW')}</td></tr>
                                <tr><td class="fw-bold">目標部門:</td><td>${data.announcement.targetDepartments.map(dept => `<span class="badge bg-secondary me-1">${dept}</span>`).join('')}</td></tr>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 宣導內容 -->
            <div class="card mb-4">
                <div class="card-header bg-info text-white">
                    <h5 class="mb-0"><i class="fas fa-file-text me-2"></i>宣導內容</h5>
                </div>
                <div class="card-body">
                    ${renderContentBlocks(data.announcement.contentBlocks)}
                </div>
            </div>

            <!-- 簽名者資訊 -->
            <div class="card mb-4">
                <div class="card-header bg-success text-white">
                    <h5 class="mb-0"><i class="fas fa-user me-2"></i>簽名者資訊</h5>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <table class="table table-borderless">
                                <tr><td class="fw-bold">姓名:</td><td>${data.recordInfo.employeeName}</td></tr>
                                <tr><td class="fw-bold">員工編號:</td><td>${data.recordInfo.employeeId}</td></tr>
                                <tr><td class="fw-bold">公司:</td><td>${data.recordInfo.company}</td></tr>
                                <tr><td class="fw-bold">部門:</td><td>${data.recordInfo.department}</td></tr>
                            </table>
                        </div>
                        <div class="col-md-6">
                            <table class="table table-borderless">
                                <tr><td class="fw-bold">簽名時間:</td><td>${new Date(data.recordInfo.signedAt).toLocaleString('zh-TW')}</td></tr>
                                <tr><td class="fw-bold">簽名狀態:</td><td>${data.recordInfo.hasSignature ? 
                                    '<span class="badge bg-success"><i class="fas fa-check me-1"></i>已簽名</span>' : 
                                    '<span class="badge bg-warning"><i class="fas fa-times me-1"></i>未簽名</span>'}</td></tr>
                            </table>
                        </div>
                    </div>

                    ${data.recordInfo.hasSignature ? `
                        <div class="mt-3">
                            <h6><i class="fas fa-signature me-2"></i>電子簽名</h6>
                            <div class="text-center p-3 border rounded bg-light">
                                <img src="${data.recordInfo.signatureData}" alt="電子簽名" 
                                     class="img-fluid" style="max-height: 200px; border: 1px solid #ddd; border-radius: 4px;">
                            </div>
                        </div>
                    ` : `
                        <div class="mt-3">
                            <div class="alert alert-warning">
                                <i class="fas fa-exclamation-triangle me-2"></i>This record has no electronic signature
                            </div>
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;
    
    recordContent.innerHTML = contentHtml;
    
    // Set PDF export button event
    const exportPdfBtn = document.getElementById('exportRecordPdf');
    if (exportPdfBtn) {
        exportPdfBtn.onclick = () => exportRecordPdf(data.recordInfo.id);
    }
    
    // Show Modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

// Render content blocks
function renderContentBlocks(contentBlocks) {
    if (!contentBlocks || contentBlocks.length === 0) {
        return '<div class="alert alert-info">無內容</div>';
    }

    return contentBlocks.map((block, index) => {
        let blockHtml = `<div class="content-block mb-3 p-3 border rounded">`;
        
        if (block.subTitle) {
            blockHtml += `<h6 class="fw-bold text-primary mb-2">${block.subTitle}</h6>`;
        }
        
        if (block.type === 'text' && block.content) {
            blockHtml += `<p class="mb-2">${block.content.replace(/\n/g, '<br>')}</p>`;
        } else if (block.text) {
            blockHtml += `<p class="mb-2">${block.text.replace(/\n/g, '<br>')}</p>`;
        }
        
        if (block.type === 'image' && block.content) {
            blockHtml += `
                <div class="text-center mb-2">
                    <img src="${block.content}" alt="內容圖片" 
                         class="img-fluid border rounded" 
                         style="max-height: 400px; cursor: pointer;"
                         onclick="showImagePreview('${block.content}')">
                </div>
            `;
        } else if (block.imageUrl) {
            blockHtml += `
                <div class="text-center mb-2">
                    <img src="${block.imageUrl}" alt="內容圖片" 
                         class="img-fluid border rounded" 
                         style="max-height: 400px; cursor: pointer;"
                         onclick="showImagePreview('${block.imageUrl}')">
                </div>
            `;
        }
        
        blockHtml += '</div>';
        return blockHtml;
    }).join('');
}

// Show image preview
function showImagePreview(imageUrl) {
    const previewHtml = `
        <div class="modal fade" id="imagePreviewModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">圖片預覽</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body text-center">
                        <img src="${imageUrl}" alt="圖片預覽" class="img-fluid">
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove old preview modal
    const existingModal = document.getElementById('imagePreviewModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    document.body.insertAdjacentHTML('beforeend', previewHtml);
    const modal = new bootstrap.Modal(document.getElementById('imagePreviewModal'));
    modal.show();
}

// Export single record PDF
async function exportRecordPdf(recordId) {
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE}/EAnnouncement/records/${recordId}/export-pdf`);
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `Signature_record_${new Date().toISOString().slice(0, 10)}.pdf`;
            
            if (contentDisposition) {
                // 處理UTF-8編碼的檔名
                if (contentDisposition.includes('filename*=UTF-8\'\'')) {
                    const encodedFilename = contentDisposition.split('filename*=UTF-8\'\'')[1];
                    try {
                        filename = decodeURIComponent(encodedFilename);
                    } catch (e) {
                        console.warn('Failed to decode filename:', e);
                    }
                } else if (contentDisposition.includes('filename=')) {
                    filename = contentDisposition.split('filename=')[1].replace(/"/g, '');
                }
            }
            
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showAlert('PDF匯出成功', 'success');
        } else {
            const errorResult = await response.json().catch(() => ({message: '未知錯誤'}));
            throw new Error(errorResult.message || '匯出失敗');
        }
    } catch (error) {
        console.error('Export PDF failed:', error);
        showAlert('PDF匯出失敗: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// View signature
function viewSignature(recordId) {
    // Check if modal already exists
    let modal = document.getElementById('signatureModal');
    if (!modal) {
        modal = createSignatureModal();
    }
    
    // Load signature data
    fetch(`${API_BASE}/EAnnouncement/records/${recordId}/signature`)
        .then(response => response.json())
        .then(result => {
            if (result.success && result.data) {
                console.log('Signature data loaded successfully');
                
                // Update signer information
                const signerInfo = document.getElementById('signerInfo');
                if (signerInfo) {
                    signerInfo.textContent = `${result.data.employeeName} (${result.data.employeeId}) - ${result.data.department}`;
                }
                
                // Set signature image
                const signatureImage = document.getElementById('signatureImage');
                if (signatureImage) {
                    signatureImage.src = result.data.signatureData;
                }
                
                // Show modal
                const bsModal = new bootstrap.Modal(modal);
                bsModal.show();
            } else {
                throw new Error('Unable to get signature data');
            }
        })
        .catch(error => {
            console.error('Error loading signature:', error);
            showAlert('無法載入簽名圖片: ' + error.message, 'error');
        });
}

// Create signature view dialog
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
                        <div class="mb-3">
                            <h6 id="signerInfo">載入中...</h6>
                        </div>
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

// Download PDF
async function downloadPDF() {
    try {
        showLoading();
        
        // Build export parameters
        const params = new URLSearchParams();
        const nameSearch = document.getElementById('nameSearch')?.value?.trim();
        const departmentFilter = document.getElementById('departmentFilter')?.value?.trim();
        const dateFilter = document.getElementById('dateFilter')?.value?.trim();
        
        if (nameSearch) {
            params.append('employeeName', nameSearch);
        }
        if (departmentFilter) {
            params.append('department', departmentFilter);
        }
        if (dateFilter) {
            params.append('signedDate', dateFilter);
        }
        
        const response = await fetch(`${API_BASE}/EAnnouncement/${announcementId}/export-pdf?${params}`);
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `Signature_records_${new Date().toISOString().slice(0, 10)}.pdf`;
            
            if (contentDisposition && contentDisposition.includes('filename=')) {
                filename = contentDisposition.split('filename=')[1].replace(/"/g, '');
            }
            
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showAlert('PDF匯出成功', 'success');
        } else {
            const errorResult = await response.json().catch(() => ({message: '未知錯誤'}));
            throw new Error(errorResult.message || '匯出失敗');
        }
    } catch (error) {
        console.error('Download PDF failed:', error);
        showAlert('PDF下載失敗: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Show alert
function showAlert(message, type = 'info') {
    const alertToast = document.getElementById('alertToast');
    const toastTitle = document.getElementById('toastTitle');
    const toastBody = document.getElementById('toastBody');
    
    // Set alert type
    const typeConfig = {
        'success': { title: '成功', class: 'text-success' },
        'error': { title: '錯誤', class: 'text-danger' },
        'warning': { title: '警告', class: 'text-warning' },
        'info': { title: '資訊', class: 'text-info' }
    };
    
    const config = typeConfig[type] || typeConfig['info'];
    toastTitle.textContent = config.title;
    toastTitle.className = config.class;
    toastBody.textContent = message;
    
    // Show toast
    const toast = new bootstrap.Toast(alertToast);
    toast.show();
}

// Show loading
function showLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
        console.log('showLoading() called');
    }
}

// Hide loading
function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
        console.log('hideLoading() called');
        console.log('Loading animation hidden, display set to:', loadingOverlay.style.display);
    }
}