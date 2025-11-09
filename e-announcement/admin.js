// 全域變數
const API_BASE = (() => {
    // 檢查是否為本地開發環境
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return window.location.origin + '/api';
    }
    // 生產環境使用指定的後端地址
    return 'https://35.221.146.143.nip.io/linehook';
})();
let currentPage = 1;
let totalPages = 1;
let contentBlockCounter = 0;
let companyDepartments = [];

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('API Base URL:', API_BASE);
    initializePage();
});

// 初始化頁面
async function initializePage() {
    try {
        await loadCompanyDepartments();
        await loadAnnouncements();
        setupEventListeners();
    } catch (error) {
        console.error('初始化頁面失敗:', error);
        showAlert('初始化頁面失敗', 'error');
    }
}

// 設定事件監聽器
function setupEventListeners() {
    // 表單提交
    document.getElementById('announcementForm').addEventListener('submit', handleFormSubmit);
    
    // 發佈單位變更
    document.getElementById('publishUnit').addEventListener('change', function() {
        const customDiv = document.getElementById('customPublishUnitDiv');
        if (this.value === '其它') {
            customDiv.style.display = 'block';
        } else {
            customDiv.style.display = 'none';
        }
    });
    
    // 目標公司變更
    document.getElementById('targetCompany').addEventListener('change', function() {
        updateDepartmentOptions(this.value);
    });
    
    // 公司篩選
    document.getElementById('companyFilter').addEventListener('change', function() {
        currentPage = 1;
        loadAnnouncements();
    });
    
    // 初始化第一個內容區塊
    addContentBlock();
}

// 載入公司部門資料
async function loadCompanyDepartments() {
    try {
        const response = await fetch(`${API_BASE}/EAnnouncement/company-departments`);
        const result = await response.json();
        
        if (result.success) {
            companyDepartments = result.data;
            populateCompanyOptions();
        } else {
            throw new Error(result.message || '載入公司部門資料失敗');
        }
    } catch (error) {
        console.error('載入公司部門資料失敗:', error);
        showAlert('載入公司部門資料失敗', 'error');
    }
}

// 填入公司選項
function populateCompanyOptions() {
    const targetCompanySelect = document.getElementById('targetCompany');
    const companyFilterSelect = document.getElementById('companyFilter');
    
    // 清空現有選項
    targetCompanySelect.innerHTML = '<option value="">請選擇公司</option>';
    companyFilterSelect.innerHTML = '<option value="">所有公司</option>';
    
    companyDepartments.forEach(item => {
        const option = new Option(item.company, item.company);
        targetCompanySelect.appendChild(option.cloneNode(true));
        companyFilterSelect.appendChild(option);
    });
}

// 更新部門選項
function updateDepartmentOptions(selectedCompany) {
    console.log('🏛️ updateDepartmentOptions 被調用，公司:', selectedCompany);
    console.log('📊 可用的公司部門資料:', companyDepartments);
    
    const departmentDiv = document.getElementById('departmentCheckboxes');
    if (!departmentDiv) {
        console.error('❌ 找不到 departmentCheckboxes 元素');
        return;
    }
    
    departmentDiv.innerHTML = '';
    
    if (!selectedCompany) {
        console.log('⚠️ 沒有選擇公司，跳過部門更新');
        return;
    }
    
    const companyData = companyDepartments.find(item => item.company === selectedCompany);
    console.log('🔍 找到的公司資料:', companyData);
    
    if (!companyData) {
        console.warn('⚠️ 找不到公司對應的部門資料:', selectedCompany);
        return;
    }
    
    console.log('📋 開始建立部門選項:', companyData.departments);
    companyData.departments.forEach(department => {
        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = 'form-check';
        checkboxDiv.innerHTML = `
            <input class="form-check-input" type="checkbox" value="${department}" id="dept_${department}">
            <label class="form-check-label" for="dept_${department}">
                ${department}
            </label>
        `;
        departmentDiv.appendChild(checkboxDiv);
    });
    console.log('✅ 部門選項建立完成');
}

// 新增內容區塊
function addContentBlock() {
    contentBlockCounter++;
    const blockId = `contentBlock_${contentBlockCounter}`;
    
    const blockHtml = `
        <div class="content-block" id="${blockId}" data-order="${contentBlockCounter}">
            <div class="content-block-header">
                <h6 class="mb-0">內容區塊 ${contentBlockCounter}</h6>
                <div class="btn-group">
                    <button type="button" class="btn btn-sm btn-outline-secondary" onclick="moveBlockUp('${blockId}')" title="上移">
                        <i class="fas fa-arrow-up"></i>
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-secondary" onclick="moveBlockDown('${blockId}')" title="下移">
                        <i class="fas fa-arrow-down"></i>
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeContentBlock('${blockId}')" title="刪除">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="mb-3">
                <label class="form-label">區塊類型</label>
                <select class="form-select content-type" onchange="updateContentInput('${blockId}')">
                    <option value="text">文字內容</option>
                    <option value="image">圖片</option>
                    <option value="html">HTML連結</option>
                    <option value="youtube">YouTube影片</option>
                </select>
            </div>
            <div class="content-input">
                <label class="form-label">文字內容</label>
                <textarea class="form-control" rows="4" placeholder="請輸入宣導內容..."></textarea>
            </div>
        </div>
    `;
    
    document.getElementById('contentBlocks').insertAdjacentHTML('beforeend', blockHtml);
    updateBlockNumbers();
}

// 移除內容區塊
function removeContentBlock(blockId) {
    const block = document.getElementById(blockId);
    if (block) {
        block.remove();
        updateBlockNumbers();
    }
}

// 向上移動區塊
function moveBlockUp(blockId) {
    const block = document.getElementById(blockId);
    const prevBlock = block.previousElementSibling;
    if (prevBlock) {
        block.parentNode.insertBefore(block, prevBlock);
        updateBlockNumbers();
    }
}

// 向下移動區塊
function moveBlockDown(blockId) {
    const block = document.getElementById(blockId);
    const nextBlock = block.nextElementSibling;
    if (nextBlock) {
        block.parentNode.insertBefore(nextBlock, block);
        updateBlockNumbers();
    }
}

// 更新區塊編號
function updateBlockNumbers() {
    const blocks = document.querySelectorAll('.content-block');
    blocks.forEach((block, index) => {
        const order = index + 1;
        block.setAttribute('data-order', order);
        const header = block.querySelector('.content-block-header h6');
        if (header) {
            header.textContent = `內容區塊 ${order}`;
        }
    });
}

// 更新內容輸入區塊
function updateContentInput(blockId) {
    const block = document.getElementById(blockId);
    const typeSelect = block.querySelector('.content-type');
    const contentInput = block.querySelector('.content-input');
    
    if (typeSelect.value === 'text') {
        contentInput.innerHTML = `
            <label class="form-label">文字內容</label>
            <textarea class="form-control" rows="4" placeholder="請輸入宣導內容..."></textarea>
        `;
    } else if (typeSelect.value === 'image') {
        contentInput.innerHTML = `
            <label class="form-label">圖片上傳</label>
            <div class="image-upload-container">
                <input type="file" class="form-control image-upload" accept="image/*" onchange="handleImageUpload(this, '${blockId}')">
                <div class="form-text">請選擇圖片檔案（JPG、PNG、GIF）</div>
                <div class="image-preview mt-2" style="display: none;">
                    <img src="" alt="預覽圖片" style="max-width: 300px; max-height: 200px; border: 1px solid #ddd; padding: 5px;">
                    <div class="mt-1">
                        <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeImage('${blockId}')">移除圖片</button>
                    </div>
                </div>
                <input type="hidden" class="image-data" value="">
            </div>
            <div class="mt-2">
                <label class="form-label">或輸入圖片網址</label>
                <input type="url" class="form-control image-url" placeholder="https://example.com/image.jpg" onchange="handleImageUrl(this, '${blockId}')">
                <div class="form-text">您可以選擇上傳圖片或輸入圖片網址</div>
            </div>
        `;
    } else if (typeSelect.value === 'html') {
        contentInput.innerHTML = `
            <label class="form-label">HTML連結網址</label>
            <input type="url" class="form-control html-url" placeholder="https://example.com/page.html" required>
            <div class="form-text">請輸入要嵌入的HTML網頁連結，將以最大化方式顯示該網頁內容</div>
            <div class="mt-2">
                <label class="form-label">連結標題 (選填)</label>
                <input type="text" class="form-control html-title" placeholder="網頁標題...">
                <div class="form-text">為此連結設定一個標題，幫助使用者了解內容</div>
            </div>
        `;
    } else if (typeSelect.value === 'youtube') {
        contentInput.innerHTML = `
            <label class="form-label">YouTube影片連結</label>
            <input type="url" class="form-control youtube-url" placeholder="https://youtu.be/qV_nb10ag68 或 https://www.youtube.com/watch?v=qV_nb10ag68" required>
            <div class="form-text">
                支援兩種格式：<br>
                • 分享連結：https://youtu.be/影片ID<br>
                • 完整連結：https://www.youtube.com/watch?v=影片ID
            </div>
            <div class="mt-2">
                <label class="form-label">影片標題 (選填)</label>
                <input type="text" class="form-control youtube-title" placeholder="影片標題...">
                <div class="form-text">為此影片設定一個標題，如果不填入系統會自動抓取YouTube標題</div>
            </div>
            <div class="mt-2">
                <div class="youtube-preview" style="display: none;">
                    <label class="form-label">影片預覽</label>
                    <div class="embed-responsive embed-responsive-16by9">
                        <iframe class="embed-responsive-item" frameborder="0" allowfullscreen></iframe>
                    </div>
                </div>
            </div>
        `;
        
        // 為YouTube URL輸入框添加即時預覽功能
        setTimeout(() => {
            const youtubeUrlInput = block.querySelector('.youtube-url');
            if (youtubeUrlInput) {
                youtubeUrlInput.addEventListener('input', function() {
                    updateYouTubePreview(blockId, this.value);
                });
            }
        }, 100);
    }
}

// 處理圖片上傳
function handleImageUpload(input, blockId) {
    const file = input.files[0];
    if (!file) return;
    
    // 檢查檔案大小（限制 5MB）
    if (file.size > 5 * 1024 * 1024) {
        alert('圖片檔案大小不能超過 5MB');
        input.value = '';
        return;
    }
    
    // 檢查檔案類型
    if (!file.type.startsWith('image/')) {
        alert('請選擇有效的圖片檔案');
        input.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const block = document.getElementById(blockId);
        const previewContainer = block.querySelector('.image-preview');
        const previewImg = previewContainer.querySelector('img');
        const hiddenInput = block.querySelector('.image-data');
        const urlInput = block.querySelector('.image-url');
        
        // 顯示預覽
        previewImg.src = e.target.result;
        previewContainer.style.display = 'block';
        
        // 儲存 base64 資料
        hiddenInput.value = e.target.result;
        
        // 清空網址輸入
        urlInput.value = '';
    };
    reader.readAsDataURL(file);
}

// 處理圖片網址
function handleImageUrl(input, blockId) {
    const url = input.value.trim();
    if (!url) return;
    
    const block = document.getElementById(blockId);
    const previewContainer = block.querySelector('.image-preview');
    const previewImg = previewContainer.querySelector('img');
    const hiddenInput = block.querySelector('.image-data');
    const fileInput = block.querySelector('.image-upload');
    
    // 顯示預覽
    previewImg.src = url;
    previewContainer.style.display = 'block';
    
    // 清空檔案上傳和 base64 資料
    fileInput.value = '';
    hiddenInput.value = '';
}

// 移除圖片
function removeImage(blockId) {
    const block = document.getElementById(blockId);
    const previewContainer = block.querySelector('.image-preview');
    const hiddenInput = block.querySelector('.image-data');
    const fileInput = block.querySelector('.image-upload');
    const urlInput = block.querySelector('.image-url');
    
    // 隱藏預覽
    previewContainer.style.display = 'none';
    
    // 清空所有輸入
    hiddenInput.value = '';
    fileInput.value = '';
    urlInput.value = '';
}

// 更新YouTube預覽
function updateYouTubePreview(blockId, url) {
    const block = document.getElementById(blockId);
    const previewContainer = block.querySelector('.youtube-preview');
    const iframe = previewContainer.querySelector('iframe');
    
    if (!url.trim()) {
        previewContainer.style.display = 'none';
        return;
    }
    
    // 解析YouTube URL並取得影片ID
    const videoId = extractYouTubeVideoId(url);
    if (videoId) {
        iframe.src = `https://www.youtube.com/embed/${videoId}`;
        previewContainer.style.display = 'block';
    } else {
        previewContainer.style.display = 'none';
    }
}

// 從YouTube URL提取影片ID
function extractYouTubeVideoId(url) {
    try {
        // 支援的格式：
        // https://youtu.be/VIDEO_ID
        // https://www.youtube.com/watch?v=VIDEO_ID
        // https://m.youtube.com/watch?v=VIDEO_ID
        
        const regexPatterns = [
            /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
            /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
            /(?:m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/
        ];
        
        for (const pattern of regexPatterns) {
            const match = url.match(pattern);
            if (match) {
                return match[1];
            }
        }
        
        return null;
    } catch (error) {
        console.error('解析YouTube URL時發生錯誤:', error);
        return null;
    }
}

// 載入宣導專案列表
async function loadAnnouncements() {
    try {
        const company = document.getElementById('companyFilter').value;
        const showArchived = document.getElementById('showArchivedSwitch')?.checked || false;
        const params = new URLSearchParams({
            page: currentPage,
            pageSize: 10,
            includeArchived: showArchived
        });
        
        if (company) {
            params.append('company', company);
        }
        
        const response = await fetch(`${API_BASE}/EAnnouncement?${params}`);
        const result = await response.json();
        
        if (result.success) {
            displayAnnouncements(result.data);
            updatePagination(result.page, result.totalPages, result.totalCount);
        } else {
            throw new Error(result.message || '載入宣導專案失敗');
        }
    } catch (error) {
        console.error('載入宣導專案失敗:', error);
        showAlert('載入宣導專案失敗', 'error');
    }
}

// 顯示宣導專案列表
function displayAnnouncements(announcements) {
    const listContainer = document.getElementById('announcementsList');
    
    if (announcements.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-inbox fa-3x text-muted mb-3"></i>
                <p class="text-muted">尚無宣導專案</p>
            </div>
        `;
        return;
    }
    
    const listHtml = announcements.map(item => `
        <div class="card mb-3">
            <div class="card-body">
                <div class="row align-items-center">
                    <div class="col-md-8">
                        <h6 class="card-title mb-1">${item.title}</h6>
                        <div class="d-flex gap-3 text-muted small">
                            <span><i class="fas fa-tag me-1"></i>${item.documentType}</span>
                            <span><i class="fas fa-building me-1"></i>${item.publishUnit}</span>
                            <span><i class="fas fa-calendar me-1"></i>${new Date(item.publishDate).toLocaleDateString()}</span>
                            <span><i class="fas fa-users me-1"></i>${item.recordCount} 人已簽名</span>
                        </div>
                        <div class="mt-1">
                            <span class="badge bg-info">${item.targetCompany}</span>
                            ${item.isArchived ? '<span class="badge bg-warning"><i class="fas fa-archive me-1"></i>已封存</span>' : ''}
                        </div>
                    </div>
                    <div class="col-md-4 text-end">
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline-primary" onclick="editAnnouncement('${item.id}')">
                                <i class="fas fa-edit"></i> 編輯
                            </button>
                            <button class="btn btn-sm btn-outline-info" onclick="previewAnnouncementById('${item.id}')">
                                <i class="fas fa-eye"></i> 預覽
                            </button>
                            <button class="btn btn-sm btn-outline-secondary" onclick="viewRecords('${item.id}')">
                                <i class="fas fa-list"></i> 記錄
                            </button>
                            <button class="btn btn-sm btn-outline-success" onclick="publishAnnouncement('${item.id}')">
                                <i class="fas fa-share"></i> 發佈
                            </button>
                            <button class="btn btn-sm btn-outline-warning" onclick="testPublishAnnouncement('${item.id}')">
                                <i class="fas fa-flask"></i> 測試
                            </button>
                            <button class="btn btn-sm btn-outline-warning" onclick="exportPdf('${item.id}')">
                                <i class="fas fa-file-pdf"></i> PDF
                            </button>
                            <button class="btn btn-sm ${item.isArchived ? 'btn-outline-success' : 'btn-outline-warning'}" onclick="toggleArchiveStatus('${item.id}', ${item.isArchived})" title="${item.isArchived ? '取消封存' : '封存'}">
                                <i class="fas fa-${item.isArchived ? 'folder-open' : 'archive'}"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteAnnouncement('${item.id}', '${item.title}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    listContainer.innerHTML = listHtml;
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
    loadAnnouncements();
}

// 顯示不同的視圖
function showView(viewName, skipReset = false) {
    // 隱藏所有視圖
    document.querySelectorAll('.view-content').forEach(view => {
        view.style.display = 'none';
    });
    
    // 更新按鈕狀態
    document.querySelectorAll('.btn-group button').forEach(btn => {
        btn.classList.remove('active');
        btn.classList.add('btn-outline-primary');
        btn.classList.remove('btn-primary');
    });
    
    // 顯示選中的視圖
    if (viewName === 'list') {
        document.getElementById('listView').style.display = 'block';
        document.querySelector('button[onclick="showView(\'list\')"]').classList.add('active', 'btn-primary');
        document.querySelector('button[onclick="showView(\'list\')"]').classList.remove('btn-outline-primary');
    } else if (viewName === 'create') {
        document.getElementById('createView').style.display = 'block';
        document.querySelector('button[onclick="showView(\'create\')"]').classList.add('active', 'btn-primary');
        document.querySelector('button[onclick="showView(\'create\')"]').classList.remove('btn-outline-primary');
        if (!skipReset) {
            resetForm();
        }
    }
}

// 重置表單
function resetForm() {
    document.getElementById('announcementForm').reset();
    document.getElementById('announcementId').value = '';
    document.getElementById('formTitle').textContent = '新增宣導專案';
    document.getElementById('customPublishUnitDiv').style.display = 'none';
    document.getElementById('departmentCheckboxes').innerHTML = '';
    document.getElementById('contentBlocks').innerHTML = '';
    contentBlockCounter = 0;
    addContentBlock();
    
    // 隱藏預覽按鈕（新增時不顯示）
    const previewBtn = document.getElementById('previewBtn');
    if (previewBtn) {
        previewBtn.style.display = 'none';
    }
}

// 處理表單提交
async function handleFormSubmit(event) {
    event.preventDefault();
    
    try {
        const formData = gatherFormData();
        const isEdit = !!document.getElementById('announcementId').value;
        
        if (isEdit) {
            await updateAnnouncement(formData);
        } else {
            await createAnnouncement(formData);
        }
        
        showView('list');
        loadAnnouncements();
        showAlert(isEdit ? '宣導專案更新成功' : '宣導專案建立成功', 'success');
        
    } catch (error) {
        console.error('提交表單失敗:', error);
        showAlert(error.message || '操作失敗', 'error');
    }
}

// 收集表單資料
function gatherFormData() {
    const selectedDepartments = Array.from(document.querySelectorAll('#departmentCheckboxes input:checked'))
        .map(checkbox => checkbox.value);
    
    if (selectedDepartments.length === 0) {
        throw new Error('請選擇至少一個目標部門');
    }
    
    const contentBlocks = [];
    document.querySelectorAll('.content-block').forEach((block, index) => {
        const typeElement = block.querySelector('.content-type');
        if (!typeElement) {
            console.warn(`內容區塊 ${index + 1} 缺少類型選擇器`);
            return; // 跳過這個區塊
        }
        
        const type = typeElement.value;
        let content = '';
        
        if (type === 'text') {
            const textarea = block.querySelector('textarea');
            if (textarea) {
                content = textarea.value.trim();
            }
        } else if (type === 'image') {
            // 優先使用上傳的圖片（base64）
            const imageDataElement = block.querySelector('.image-data');
            const imageUrlElement = block.querySelector('.image-url');
            
            const imageData = imageDataElement?.value;
            const imageUrl = imageUrlElement?.value?.trim();
            
            if (imageData) {
                content = imageData; // base64 格式
            } else if (imageUrl) {
                content = imageUrl; // 網址格式
            } else {
                console.warn(`內容區塊 ${index + 1} 的圖片內容為空`);
            }
        } else if (type === 'html') {
            const htmlUrlElement = block.querySelector('.html-url');
            const htmlTitleElement = block.querySelector('.html-title');
            
            const htmlUrl = htmlUrlElement?.value?.trim();
            const htmlTitle = htmlTitleElement?.value?.trim();
            
            if (htmlUrl) {
                content = JSON.stringify({
                    url: htmlUrl,
                    title: htmlTitle || htmlUrl
                });
            } else {
                console.warn(`內容區塊 ${index + 1} 的HTML連結為空`);
            }
        } else if (type === 'youtube') {
            const youtubeUrlElement = block.querySelector('.youtube-url');
            const youtubeTitleElement = block.querySelector('.youtube-title');
            
            const youtubeUrl = youtubeUrlElement?.value?.trim();
            const youtubeTitle = youtubeTitleElement?.value?.trim();
            
            if (youtubeUrl) {
                const videoId = extractYouTubeVideoId(youtubeUrl);
                if (videoId) {
                    content = JSON.stringify({
                        url: youtubeUrl,
                        videoId: videoId,
                        title: youtubeTitle || 'YouTube影片'
                    });
                } else {
                    throw new Error(`內容區塊 ${index + 1} 的YouTube連結格式不正確`);
                }
            } else {
                console.warn(`內容區塊 ${index + 1} 的YouTube連結為空`);
            }
        }
        
        if (content) {
            contentBlocks.push({ 
                type, 
                content,
                order: index + 1
            });
        }
    });
    
    if (contentBlocks.length === 0) {
        throw new Error('請至少新增一個內容區塊');
    }
    
    return {
        title: document.getElementById('title').value.trim(),
        contentBlocks: contentBlocks,
        documentType: document.getElementById('documentType').value,
        publishUnit: document.getElementById('publishUnit').value,
        customPublishUnit: document.getElementById('customPublishUnit').value.trim(),
        targetCompany: document.getElementById('targetCompany').value,
        targetDepartments: selectedDepartments,
        publishDate: formatDateTimeString(document.getElementById('publishDate').value)
    };
}

// 格式化日期時間字串為 yyyy-MM-dd HH:mm 格式
function formatDateTimeString(dateTimeInput) {
    if (!dateTimeInput) {
        return '';
    }
    
    // 如果輸入是 datetime-local 格式 (YYYY-MM-DDTHH:mm)
    if (dateTimeInput.includes('T')) {
        return dateTimeInput.replace('T', ' ');
    }
    
    // 如果輸入已經是正確格式，直接返回
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(dateTimeInput)) {
        return dateTimeInput;
    }
    
    // 嘗試解析並格式化
    try {
        const date = new Date(dateTimeInput);
        if (isNaN(date.getTime())) {
            throw new Error('無效的日期');
        }
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    } catch (error) {
        console.error('日期格式化錯誤:', error);
        return dateTimeInput; // 如果無法格式化，返回原值
    }
}

// 建立宣導專案
async function createAnnouncement(data) {
    const response = await fetch(`${API_BASE}/EAnnouncement`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });
    
    const result = await response.json();
    if (!result.success) {
        throw new Error(result.message || '建立宣導專案失敗');
    }
}

// 更新宣導專案
async function updateAnnouncement(data) {
    const id = document.getElementById('announcementId').value;
    const response = await fetch(`${API_BASE}/EAnnouncement/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });
    
    const result = await response.json();
    if (!result.success) {
        throw new Error(result.message || '更新宣導專案失敗');
    }
}

// 編輯宣導專案
async function editAnnouncement(id) {
    try {
        console.log('🔍 開始編輯宣導專案，ID:', id);
        const response = await fetch(`${API_BASE}/EAnnouncement/${id}`);
        console.log('📡 API 回應狀態:', response.status);
        
        const result = await response.json();
        console.log('📋 API 回應資料:', result);
        
        if (result.success) {
            console.log('✅ 準備填入表單資料:', result.data);
            showView('create', true); // 顯示表單但不重置
            populateFormWithData(result.data);
        } else {
            throw new Error(result.message || '載入宣導專案資料失敗');
        }
    } catch (error) {
        console.error('❌ 編輯宣導專案失敗:', error);
        showAlert('載入宣導專案資料失敗', 'error');
    }
}

// 填入表單資料
function populateFormWithData(data) {
    try {
        console.log('🎯 開始填入表單資料:', data);
        
        document.getElementById('announcementId').value = data.id;
        document.getElementById('formTitle').textContent = '編輯宣導專案';
        document.getElementById('title').value = data.title || '';
        console.log('📝 標題已設定:', data.title);
        
        document.getElementById('documentType').value = data.documentType || '';
        console.log('📄 文件類型已設定:', data.documentType);
        
        document.getElementById('publishUnit').value = data.publishUnit || '';
        console.log('🏢 發佈單位已設定:', data.publishUnit);
        
        document.getElementById('targetCompany').value = data.targetCompany || '';
        console.log('🏬 目標公司已設定:', data.targetCompany);
    
    // 處理日期格式 - 支援多種格式
    let publishDate = '';
    console.log('📅 原始發佈日期資料:', data.publishDate);
    if (data.publishDate) {
        if (data.publishDate.includes('T')) {
            // ISO 格式: 2024-01-01T00:00:00
            publishDate = data.publishDate.split('T')[0];
        } else if (data.publishDate.includes(' ')) {
            // 自訂格式: 2024-01-01 00:00
            publishDate = data.publishDate.split(' ')[0];
        } else {
            // 只有日期: 2024-01-01
            publishDate = data.publishDate;
        }
    }
    console.log('📅 處理後發佈日期:', publishDate);
    document.getElementById('publishDate').value = publishDate;
    
    // 處理自訂發佈單位
    console.log('🔧 發佈單位:', data.publishUnit, '自訂發佈單位:', data.customPublishUnit);
    if (data.publishUnit === '其它') {
        document.getElementById('customPublishUnit').value = data.customPublishUnit || '';
        document.getElementById('customPublishUnitDiv').style.display = 'block';
        console.log('✅ 顯示自訂發佈單位欄位');
    } else {
        document.getElementById('customPublishUnit').value = '';
        document.getElementById('customPublishUnitDiv').style.display = 'none';
        console.log('❌ 隱藏自訂發佈單位欄位');
    }
    
    // 更新部門選項並選中
    console.log('🏛️ 開始更新部門選項，目標公司:', data.targetCompany);
    updateDepartmentOptions(data.targetCompany);
    console.log('✅ 部門選項更新完成');
    setTimeout(() => {
        console.log('⏰ 開始處理目標部門延遲任務');
        // 處理目標部門 - 可能是陣列或字串
        let departments = [];
        if (data.targetDepartments) {
            if (Array.isArray(data.targetDepartments)) {
                departments = data.targetDepartments;
            } else if (typeof data.targetDepartments === 'string') {
                // 如果是字串，嘗試解析 JSON 或按逗號分割
                try {
                    departments = JSON.parse(data.targetDepartments);
                } catch {
                    departments = data.targetDepartments.split(',').map(d => d.trim());
                }
            }
        }
        
        departments.forEach(dept => {
            const checkbox = document.getElementById(`dept_${dept}`);
            console.log(`🔍 查找部門複選框: dept_${dept}`, checkbox ? '找到' : '未找到');
            if (checkbox) checkbox.checked = true;
        });
        console.log('✅ 目標部門處理完成');
    }, 100);
    
    // 清空並重建內容區塊
    console.log('🧹 開始清空並重建內容區塊');
    document.getElementById('contentBlocks').innerHTML = '';
    contentBlockCounter = 0;
    
    // 處理內容區塊 - 確保是陣列
    console.log('📦 開始處理內容區塊，原始資料:', data.contentBlocks);
    let contentBlocks = [];
    if (data.contentBlocks) {
        if (Array.isArray(data.contentBlocks)) {
            contentBlocks = data.contentBlocks;
        } else if (typeof data.contentBlocks === 'string') {
            try {
                contentBlocks = JSON.parse(data.contentBlocks);
            } catch {
                console.warn('無法解析 contentBlocks JSON:', data.contentBlocks);
                contentBlocks = [];
            }
        }
    }
    console.log('📋 處理後的內容區塊:', contentBlocks);
    
    contentBlocks.forEach((block, index) => {
        console.log(`📝 處理內容區塊 ${index + 1}:`, block);
        addContentBlock();
        const blockElement = document.querySelector('.content-block:last-child');
        console.log('🔍 找到的區塊元素:', blockElement);
        blockElement.querySelector('.content-type').value = block.type || 'text';
        updateContentInput(blockElement.id);
        console.log(`✅ 內容區塊 ${index + 1} 基本設定完成`);
        
        setTimeout(() => {
            console.log(`⏰ 開始填入區塊內容，類型: ${block.type}`);
            if (block.type === 'text' || !block.type) {
                // 處理文字內容（向後相容）
                const content = block.content || block.text || '';
                console.log('📝 填入文字內容:', content);
                const textarea = blockElement.querySelector('textarea');
                if (textarea) {
                    textarea.value = content;
                    console.log('✅ 文字內容已填入');
                } else {
                    console.warn('❌ 找不到文字區域元素');
                }
            } else if (block.type === 'image') {
                const content = block.content || block.imageUrl || '';
                console.log('🖼️ 填入圖片內容:', content);
                
                if (content.startsWith('data:')) {
                    // base64 圖片
                    console.log('📷 處理 base64 圖片');
                    const hiddenInput = blockElement.querySelector('.image-data');
                    const previewContainer = blockElement.querySelector('.image-preview');
                    const previewImg = previewContainer?.querySelector('img');
                    
                    if (hiddenInput) hiddenInput.value = content;
                    if (previewImg) {
                        previewImg.src = content;
                        previewContainer.style.display = 'block';
                        console.log('✅ base64 圖片已載入');
                    }
                } else if (content.startsWith('http')) {
                    // 網址圖片
                    console.log('🌐 處理網址圖片');
                    const urlInput = blockElement.querySelector('.image-url');
                    const previewContainer = blockElement.querySelector('.image-preview');
                    const previewImg = previewContainer?.querySelector('img');
                    
                    if (urlInput) urlInput.value = content;
                    if (previewImg) {
                        previewImg.src = content;
                        previewContainer.style.display = 'block';
                        console.log('✅ 網址圖片已載入');
                    }
                }
            } else if (block.type === 'html') {
                console.log('🌐 填入HTML連結內容:', block.content);
                try {
                    const htmlData = JSON.parse(block.content);
                    const urlInput = blockElement.querySelector('.html-url');
                    const titleInput = blockElement.querySelector('.html-title');
                    
                    if (urlInput) urlInput.value = htmlData.url || '';
                    if (titleInput) titleInput.value = htmlData.title || '';
                    console.log('✅ HTML連結內容已填入');
                } catch (error) {
                    console.warn('❌ 解析HTML連結資料失敗:', error);
                    // 向後相容：直接當作URL處理
                    const urlInput = blockElement.querySelector('.html-url');
                    if (urlInput) urlInput.value = block.content || '';
                }
            } else if (block.type === 'youtube') {
                console.log('🎥 填入YouTube影片內容:', block.content);
                try {
                    const youtubeData = JSON.parse(block.content);
                    const urlInput = blockElement.querySelector('.youtube-url');
                    const titleInput = blockElement.querySelector('.youtube-title');
                    
                    if (urlInput) {
                        urlInput.value = youtubeData.url || '';
                        // 觸發預覽更新
                        updateYouTubePreview(blockElement.id, youtubeData.url || '');
                    }
                    if (titleInput) titleInput.value = youtubeData.title || '';
                    console.log('✅ YouTube影片內容已填入');
                } catch (error) {
                    console.warn('❌ 解析YouTube影片資料失敗:', error);
                    // 向後相容：直接當作URL處理
                    const urlInput = blockElement.querySelector('.youtube-url');
                    if (urlInput) {
                        urlInput.value = block.content || '';
                        updateYouTubePreview(blockElement.id, block.content || '');
                    }
                }
            }
            console.log(`✅ 區塊內容填入完成`);
        }, 100);
    });
    
    console.log('🎉 所有表單資料填入完成！');
    
    // 如果沒有內容區塊，新增一個預設的
    if (contentBlocks.length === 0) {
        addContentBlock();
    }
    
    } catch (error) {
        console.error('❌ 填入表單資料時發生錯誤:', error);
        showAlert('載入表單資料時發生錯誤: ' + error.message, 'error');
    }
}

// 刪除宣導專案
function deleteAnnouncement(id, title) {
    document.getElementById('confirmDeleteBtn').onclick = async function() {
        try {
            const response = await fetch(`${API_BASE}/EAnnouncement/${id}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            if (result.success) {
                bootstrap.Modal.getInstance(document.getElementById('deleteModal')).hide();
                loadAnnouncements();
                showAlert('宣導專案刪除成功', 'success');
            } else {
                throw new Error(result.message || '刪除宣導專案失敗');
            }
        } catch (error) {
            console.error('刪除宣導專案失敗:', error);
            showAlert(error.message || '刪除宣導專案失敗', 'error');
        }
    };
    
    const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
    modal.show();
}

// 發佈宣導
async function publishAnnouncement(id) {
    try {
        const response = await fetch(`${API_BASE}/EAnnouncement/${id}/publish`, {
            method: 'POST'
        });
        
        const result = await response.json();
        if (result.success) {
            showAlert(result.message || '宣導通知發送成功', 'success');
        } else {
            throw new Error(result.message || '發送宣導通知失敗');
        }
    } catch (error) {
        console.error('發佈宣導失敗:', error);
        showAlert(error.message || '發送宣導通知失敗', 'error');
    }
}

// 測試發佈功能
let currentTestPublishId = null;

async function testPublishAnnouncement(id) {
    currentTestPublishId = id;
    
    // 顯示對話框
    const modal = new bootstrap.Modal(document.getElementById('testPublishModal'));
    modal.show();
    
    // 重置表單
    document.getElementById('testEmployeeIds').value = '';
    document.getElementById('testPublishPreview').textContent = '請輸入員工編號...';
    document.getElementById('testPublishBtn').disabled = true;
    
    // 監聽輸入變化
    document.getElementById('testEmployeeIds').addEventListener('input', updateTestPublishPreview);
}

function updateTestPublishPreview() {
    const input = document.getElementById('testEmployeeIds').value;
    const preview = document.getElementById('testPublishPreview');
    const btn = document.getElementById('testPublishBtn');
    
    if (!input.trim()) {
        preview.textContent = '請輸入員工編號...';
        preview.className = 'border rounded p-2 bg-light text-muted';
        btn.disabled = true;
        return;
    }
    
    // 解析員工編號
    const employeeIds = parseEmployeeIds(input);
    
    if (employeeIds.length === 0) {
        preview.textContent = '沒有有效的員工編號';
        preview.className = 'border rounded p-2 bg-light text-danger';
        btn.disabled = true;
    } else {
        preview.innerHTML = `
            <div class="text-success">
                <strong>將發送給 ${employeeIds.length} 位員工：</strong><br>
                ${employeeIds.join(', ')}
            </div>
        `;
        preview.className = 'border rounded p-2 bg-light';
        btn.disabled = false;
    }
}

function parseEmployeeIds(input) {
    // 支援換行和逗號分隔
    return input.split(/[,\n]/)
        .map(id => id.trim())
        .filter(id => id.length > 0)
        .filter((id, index, array) => array.indexOf(id) === index); // 去重
}

async function executeTestPublish() {
    if (!currentTestPublishId) {
        showAlert('找不到要發佈的專案ID', 'error');
        return;
    }
    
    const input = document.getElementById('testEmployeeIds').value;
    const employeeIds = parseEmployeeIds(input);
    
    if (employeeIds.length === 0) {
        showAlert('請輸入有效的員工編號', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/EAnnouncement/${currentTestPublishId}/test-publish`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                employeeIds: employeeIds
            })
        });
        
        console.log('測試發佈回應狀態:', response.status);
        console.log('測試發佈回應類型:', response.headers.get('content-type'));
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('伺服器錯誤回應:', errorText);
            throw new Error(`伺服器錯誤 (${response.status}): ${errorText || '未知錯誤'}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const responseText = await response.text();
            console.error('非 JSON 回應:', responseText);
            throw new Error('伺服器回應格式錯誤，請檢查後端 API');
        }
        
        const result = await response.json();
        console.log('測試發佈結果:', result);
        
        if (result.success) {
            // 關閉對話框
            const modal = bootstrap.Modal.getInstance(document.getElementById('testPublishModal'));
            modal.hide();
            
            showAlert(`測試發佈成功！已發送給 ${employeeIds.length} 位員工`, 'success');
        } else {
            throw new Error(result.message || '測試發佈失敗');
        }
    } catch (error) {
        console.error('測試發佈失敗:', error);
        showAlert(error.message || '測試發佈失敗', 'error');
    }
}

// 匯出 PDF
async function exportPdf(id) {
    try {
        const response = await fetch(`${API_BASE}/EAnnouncement/${id}/export-pdf`);
        
        if (response.headers.get('content-type')?.includes('application/pdf')) {
            // 實際 PDF 檔案
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            // 從回應標頭獲取正確檔名
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `宣導記錄_${new Date().toISOString().split('T')[0]}.pdf`;
            
            if (contentDisposition) {
                const fileNameMatch = contentDisposition.match(/filename\*?=([^;]+)/);
                if (fileNameMatch) {
                    const encodedFileName = fileNameMatch[1].trim();
                    if (encodedFileName.startsWith("UTF-8''")) {
                        filename = decodeURIComponent(encodedFileName.substring(7));
                    } else {
                        filename = encodedFileName.replace(/"/g, '');
                    }
                }
            }
            
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showAlert('PDF已下載完成', 'success');
        } else {
            // JSON 回應（開發中）
            const result = await response.json();
            if (result.success) {
                showAlert(result.message || 'PDF 功能開發中', 'info');
                console.log('PDF 資料:', result.data);
            } else {
                throw new Error(result.message || '匯出 PDF 失敗');
            }
        }
    } catch (error) {
        console.error('匯出 PDF 失敗:', error);
        showAlert(error.message || '匯出 PDF 失敗', 'error');
    }
}

// 顯示提示訊息
function showAlert(message, type = 'info') {
    const toast = document.getElementById('alertToast');
    const title = document.getElementById('toastTitle');
    const body = document.getElementById('toastBody');
    
    // 設定樣式
    toast.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'} border-0`;
    title.textContent = type === 'error' ? '錯誤' : type === 'success' ? '成功' : '通知';
    body.textContent = message;
    
    // 顯示 Toast
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
}

// 登出
function logout() {
    if (confirm('確定要登出嗎？')) {
        window.location.href = '/';
    }
}

// 從表單內容預覽宣導專案
function previewFormContent() {
    try {
        // 收集表單資料
        const formData = gatherFormData();
        
        // 生成預覽HTML
        const targetDepartments = Array.isArray(formData.targetDepartments) ? 
            formData.targetDepartments.join('、') : formData.targetDepartments;
            
        const publishUnit = formData.publishUnit === '其它' && formData.customPublishUnit ? 
            formData.customPublishUnit : formData.publishUnit;
        
        const previewHtml = `
            <div class="container">
                <div class="card">
                    <div class="card-header bg-primary text-white">
                        <h4 class="mb-0">${formData.title}</h4>
                        <div class="d-flex justify-content-between align-items-center mt-2">
                            <span class="badge bg-light text-dark">${formData.documentType}</span>
                            <span>${formData.publishDate}</span>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <strong>發佈單位：</strong>${publishUnit}
                        </div>
                        <div class="mb-3">
                            <strong>目標公司：</strong>${formData.targetCompany}
                        </div>
                        <div class="mb-3">
                            <strong>目標部門：</strong>${targetDepartments}
                        </div>
                        <hr>
                        <div class="content-area">
                            ${generateContentBlocksPreview(formData.contentBlocks)}
                        </div>
                        
                        <!-- 文件底部簽名區域 -->
                        <div class="signature-area mt-4 p-3 border-top">
                            <div class="row">
                                <div class="col-md-6">
                                    <p class="mb-1"><strong>簽名確認</strong></p>
                                    <p class="text-muted small">請在此區域進行電子簽名確認</p>
                                    <div class="signature-placeholder p-3 text-center" style="border: 2px dashed #ccc; background: #f8f9fa;">
                                        <i class="fas fa-signature fa-2x text-muted"></i>
                                        <p class="text-muted mt-2">簽名區域</p>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <p class="mb-1"><strong>確認資訊</strong></p>
                                    <p class="text-muted small mb-1">員工編號：___________</p>
                                    <p class="text-muted small mb-1">姓名：___________</p>
                                    <p class="text-muted small mb-1">部門：___________</p>
                                    <p class="text-muted small mb-1">簽名日期：___________</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 顯示預覽
        document.getElementById('previewContent').innerHTML = previewHtml;
        
        const previewModal = new bootstrap.Modal(document.getElementById('previewModal'));
        previewModal.show();
        
        // 記錄當前為表單預覽（沒有ID）
        window.currentPreviewId = null;
        
        console.log('✅ 表單預覽顯示成功');
        
    } catch (error) {
        console.error('❌ 表單預覽失敗:', error);
        showAlert(error.message || '預覽失敗', 'error');
    }
}

// 預覽宣導專案
function previewAnnouncement() {
    const announcementId = document.getElementById('announcementId').value;
    if (!announcementId) {
        showAlert('請先儲存專案後再預覽', 'warning');
        return;
    }
    
    generatePreviewContent(announcementId);
}

// 從列表預覽宣導專案
function previewAnnouncementById(id) {
    generatePreviewContent(id);
}

// 生成預覽內容
async function generatePreviewContent(id) {
    try {
        const response = await fetch(`${API_BASE}/EAnnouncement/${id}`);
        const result = await response.json();
        
        if (result.success) {
            const announcement = result.data;
            
            // 生成預覽HTML
            const previewHtml = `
                <div class="container">
                    <div class="card">
                        <div class="card-header bg-primary text-white">
                            <h4 class="mb-0">${announcement.title}</h4>
                            <div class="d-flex justify-content-between align-items-center mt-2">
                                <span class="badge bg-light text-dark">${announcement.documentType}</span>
                                <span>${announcement.publishDate}</span>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="mb-3">
                                <strong>發佈單位：</strong>${announcement.publishUnit}
                            </div>
                            <div class="mb-3">
                                <strong>目標公司：</strong>${announcement.targetCompany}
                            </div>
                            <div class="mb-3">
                                <strong>目標部門：</strong>${Array.isArray(announcement.targetDepartments) ? announcement.targetDepartments.join('、') : announcement.targetDepartments}
                            </div>
                            <hr>
                            <div class="content-area">
                                ${generateContentBlocksPreview(announcement.contentBlocks)}
                            </div>
                            
                            <!-- 文件底部簽名區域 -->
                            <div class="mt-5 pt-4" style="border-top: 2px solid #dee2e6;">
                                <div class="row">
                                    <div class="col-md-8">
                                        <p class="mb-2"><strong>已閱讀並了解以上內容</strong></p>
                                        <div class="mt-4">
                                            <span>日期：民國 _____ 年 _____ 月 _____ 日</span>
                                        </div>
                                    </div>
                                    <div class="col-md-4 text-end">
                                        <div class="border rounded p-3 bg-light position-relative" style="height: 120px; width: 150px; margin-left: auto;">
                                            <div id="signatureDisplay" class="position-absolute" style="top: 0; left: 0; width: 100%; height: 100%;">
                                                <div class="text-center text-muted d-flex align-items-center justify-content-center h-100">
                                                    <button class="btn btn-outline-primary btn-sm" onclick="openSignatureModal()">
                                                        <i class="fas fa-pen"></i> 點擊簽名
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            document.getElementById('previewContent').innerHTML = previewHtml;
            
            // 儲存當前ID供簽名頁面使用
            window.currentPreviewId = id;
            
            // 顯示預覽Modal
            const modal = new bootstrap.Modal(document.getElementById('previewModal'));
            modal.show();
            
        } else {
            showAlert(result.message || '載入預覽失敗', 'error');
        }
    } catch (error) {
        console.error('生成預覽失敗:', error);
        showAlert('生成預覽失敗', 'error');
    }
}

// 生成內容區塊預覽
function generateContentBlocksPreview(contentBlocks) {
    if (!contentBlocks || contentBlocks.length === 0) {
        return '<p class="text-muted">尚無內容</p>';
    }
    
    return contentBlocks.map(block => {
        if (block.type === 'text') {
            return `<div class="content-block mb-3">
                        <div style="white-space: pre-wrap;">${block.content}</div>
                    </div>`;
        } else if (block.type === 'image') {
            return `<div class="content-block mb-3 text-center">
                        <img src="${block.content}" alt="宣導圖片" class="img-fluid" style="max-width: 100%; max-height: 400px; border: 1px solid #ddd; border-radius: 4px;">
                    </div>`;
        } else if (block.type === 'html') {
            // 解析HTML連結資料
            try {
                const htmlData = JSON.parse(block.content);
                return `<div class="content-block html-content mb-3">
                            <div class="card">
                                <div class="card-header">
                                    <h6 class="mb-0">
                                        <i class="fas fa-external-link-alt"></i>
                                        ${htmlData.title || '網頁連結'}
                                    </h6>
                                </div>
                                <div class="card-body p-0">
                                    <iframe src="${htmlData.url}" 
                                            frameborder="0" 
                                            style="width: 100%; height: 70vh; min-height: 500px;"
                                            allowfullscreen>
                                    </iframe>
                                </div>
                                <div class="card-footer">
                                    <small class="text-muted">
                                        <a href="${htmlData.url}" target="_blank" class="btn btn-sm btn-outline-primary">
                                            <i class="fas fa-external-link-alt"></i> 在新視窗開啟
                                        </a>
                                    </small>
                                </div>
                            </div>
                        </div>`;
            } catch (error) {
                // 向後相容：直接當作URL處理
                return `<div class="content-block html-content mb-3">
                            <div class="card">
                                <div class="card-header">
                                    <h6 class="mb-0">
                                        <i class="fas fa-external-link-alt"></i>
                                        網頁連結
                                    </h6>
                                </div>
                                <div class="card-body p-0">
                                    <iframe src="${block.content}" 
                                            frameborder="0" 
                                            style="width: 100%; height: 70vh; min-height: 500px;"
                                            allowfullscreen>
                                    </iframe>
                                </div>
                                <div class="card-footer">
                                    <small class="text-muted">
                                        <a href="${block.content}" target="_blank" class="btn btn-sm btn-outline-primary">
                                            <i class="fas fa-external-link-alt"></i> 在新視窗開啟
                                        </a>
                                    </small>
                                </div>
                            </div>
                        </div>`;
            }
        } else if (block.type === 'youtube') {
            // 解析YouTube影片資料
            try {
                const youtubeData = JSON.parse(block.content);
                return `<div class="content-block youtube-content mb-3">
                            <div class="card">
                                <div class="card-header">
                                    <h6 class="mb-0">
                                        <i class="fab fa-youtube"></i>
                                        ${youtubeData.title || 'YouTube影片'}
                                    </h6>
                                </div>
                                <div class="card-body p-0">
                                    <div class="embed-responsive embed-responsive-16by9">
                                        <iframe class="embed-responsive-item" 
                                                src="https://www.youtube.com/embed/${youtubeData.videoId}?rel=0"
                                                frameborder="0" 
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowfullscreen>
                                        </iframe>
                                    </div>
                                </div>
                                <div class="card-footer">
                                    <small class="text-muted">
                                        <a href="${youtubeData.url}" target="_blank" class="btn btn-sm btn-outline-primary">
                                            <i class="fab fa-youtube"></i> 在YouTube觀看
                                        </a>
                                    </small>
                                </div>
                            </div>
                        </div>`;
            } catch (error) {
                // 向後相容：嘗試從URL解析videoId
                const videoId = extractYouTubeVideoIdForPreview(block.content);
                if (videoId) {
                    return `<div class="content-block youtube-content mb-3">
                                <div class="card">
                                    <div class="card-header">
                                        <h6 class="mb-0">
                                            <i class="fab fa-youtube"></i>
                                            YouTube影片
                                        </h6>
                                    </div>
                                    <div class="card-body p-0">
                                        <div class="embed-responsive embed-responsive-16by9">
                                            <iframe class="embed-responsive-item" 
                                                    src="https://www.youtube.com/embed/${videoId}?rel=0"
                                                    frameborder="0" 
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                    allowfullscreen>
                                            </iframe>
                                        </div>
                                    </div>
                                    <div class="card-footer">
                                        <small class="text-muted">
                                            <a href="${block.content}" target="_blank" class="btn btn-sm btn-outline-primary">
                                                <i class="fab fa-youtube"></i> 在YouTube觀看
                                            </a>
                                        </small>
                                    </div>
                                </div>
                            </div>`;
                } else {
                    return `<div class="content-block mb-3">
                                <div class="alert alert-warning">
                                    <i class="fas fa-exclamation-triangle"></i>
                                    無效的YouTube連結：${block.content}
                                </div>
                            </div>`;
                }
            }
        }
        return '';
    }).join('');
}

// 為預覽功能專用的YouTube URL解析函數
function extractYouTubeVideoIdForPreview(url) {
    try {
        // 支援的格式：
        // https://youtu.be/VIDEO_ID
        // https://www.youtube.com/watch?v=VIDEO_ID
        // https://m.youtube.com/watch?v=VIDEO_ID
        
        const regexPatterns = [
            /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
            /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
            /(?:m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/
        ];
        
        for (const pattern of regexPatterns) {
            const match = url.match(pattern);
            if (match) {
                return match[1];
            }
        }
        
        return null;
    } catch (error) {
        console.error('解析YouTube URL時發生錯誤:', error);
        return null;
    }
}

// 開啟簽名頁面
function openSignaturePage() {
    if (window.currentPreviewId) {
        const signatureUrl = `signature.html?id=${window.currentPreviewId}`;
        window.open(signatureUrl, '_blank');
    } else {
        showAlert('無法開啟簽名頁面', 'error');
    }
}

// 簽名功能
let signaturePad = null;
let isDrawing = false;
let hasSignatureContent = false; // 添加簽名標記

function openSignatureModal() {
    const modal = new bootstrap.Modal(document.getElementById('signatureModal'));
    modal.show();
    
    // 初始化簽名板
    setTimeout(() => {
        initSignaturePad();
    }, 300);
}

function initSignaturePad() {
    const canvas = document.getElementById('signaturePad');
    const ctx = canvas.getContext('2d');
    
    // 動態設定Canvas大小以適應不同裝置
    const container = canvas.parentElement;
    const containerWidth = container.clientWidth - 40; // 留一些邊距
    const isMobile = window.innerWidth <= 768;
    
    // 根據裝置類型設定大小
    if (isMobile) {
        canvas.width = Math.min(containerWidth, 600);
        canvas.height = 300; // 手機上更高一些，方便簽名
    } else {
        canvas.width = Math.min(containerWidth, 700);
        canvas.height = 250;
    }
    
    // 重置簽名狀態
    hasSignatureContent = false;
    
    // 設置畫筆樣式
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = isMobile ? 4 : 3; // 手機上更粗的線條
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
    
    signaturePad = { canvas, ctx };
}

function startDrawing(e) {
    isDrawing = true;
    hasSignatureContent = true; // 開始繪畫時標記有內容
    const rect = signaturePad.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    signaturePad.ctx.beginPath();
    signaturePad.ctx.moveTo(x, y);
}

function draw(e) {
    if (!isDrawing) return;
    
    const rect = signaturePad.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    signaturePad.ctx.lineTo(x, y);
    signaturePad.ctx.stroke();
}

function stopDrawing() {
    isDrawing = false;
    signaturePad.ctx.beginPath();
}

function handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent(e.type === 'touchstart' ? 'mousedown' : 
                                    e.type === 'touchmove' ? 'mousemove' : 'mouseup', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    signaturePad.canvas.dispatchEvent(mouseEvent);
}

function clearSignature() {
    if (signaturePad) {
        signaturePad.ctx.clearRect(0, 0, signaturePad.canvas.width, signaturePad.canvas.height);
        hasSignatureContent = false; // 清除時重置標記
    }
}

function saveSignature() {
    if (!signaturePad) return;
    
    // 使用簡單的標記檢查
    if (!hasSignatureContent) {
        showAlert('請先簽名再確認', 'warning');
        return;
    }
    
    // 轉換為圖片並顯示在預覽區域
    const dataURL = signaturePad.canvas.toDataURL('image/png');
    const signatureDisplay = document.getElementById('signatureDisplay');
    
    signatureDisplay.innerHTML = `
        <img src="${dataURL}" style="width: 100%; height: 100%; object-fit: contain;" alt="簽名">
        <button class="btn btn-outline-danger btn-sm position-absolute" 
                style="top: 5px; right: 5px; width: 25px; height: 25px; padding: 0; font-size: 12px;"
                onclick="removeSignature()" title="移除簽名">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // 關閉 modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('signatureModal'));
    modal.hide();
    
    showAlert('簽名已儲存', 'success');
}

function removeSignature() {
    const signatureDisplay = document.getElementById('signatureDisplay');
    signatureDisplay.innerHTML = `
        <div class="text-center text-muted d-flex align-items-center justify-content-center h-100">
            <button class="btn btn-outline-primary btn-sm" onclick="openSignatureModal()">
                <i class="fas fa-pen"></i> 點擊簽名
            </button>
        </div>
    `;
}

// ==================== 記錄管理功能 ====================

let currentAnnouncementId = null;
let currentRecordsPage = 1;
let currentRecordsPageSize = 50;
let currentRecordsFilter = '';
let allRecords = [];

// 檢視簽名記錄
async function viewRecords(announcementId) {
    currentAnnouncementId = announcementId;
    currentRecordsPage = 1;
    
    // 切換視圖
    document.getElementById('listView').style.display = 'none';
    document.getElementById('createView').style.display = 'none';
    document.getElementById('recordsView').style.display = 'block';
    
    // 載入記錄管理頁面資料
    await loadRecordsManagement();
}

// 載入記錄管理頁面
async function loadRecordsManagement() {
    try {
        // 載入宣導專案和統計資料
        const response = await fetch(`${API_BASE}/EAnnouncement/${currentAnnouncementId}/records-management`);
        
        if (!response.ok) {
            throw new Error(`HTTP錯誤! 狀態: ${response.status}`);
        }
        
        const result = await response.json();

        if (result.success) {
            displayAnnouncementInfo(result.data.announcement);
            displayStatistics(result.data.statistics);
            displayDepartmentStats(result.data.departmentStats);
            
            // 載入簽名記錄
            await loadRecords();
        } else {
            showAlert('載入失敗: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('載入記錄管理頁面失敗:', error);
        showAlert('載入失敗，請重新整理頁面', 'error');
    }
}

// 顯示宣導專案資訊
function displayAnnouncementInfo(announcement) {
    if (!announcement) {
        console.error('announcement 參數為 undefined 或 null');
        return;
    }
    
    const container = document.getElementById('announcementInfo');
    
    container.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <h6><i class="fas fa-heading me-2"></i>標題</h6>
                <p class="fw-bold">${announcement.title}</p>
            </div>
            <div class="col-md-6">
                <h6><i class="fas fa-file-alt me-2"></i>文件類型</h6>
                <p><span class="badge bg-primary">${announcement.documentType}</span></p>
            </div>
        </div>
        <div class="row">
            <div class="col-md-6">
                <h6><i class="fas fa-building me-2"></i>發佈單位</h6>
                <p>${announcement.publishUnit}</p>
            </div>
            <div class="col-md-6">
                <h6><i class="fas fa-calendar me-2"></i>發佈日期</h6>
                <p>${new Date(announcement.publishDate).toLocaleString('zh-TW')}</p>
            </div>
        </div>
        <div class="row">
            <div class="col-md-6">
                <h6><i class="fas fa-industry me-2"></i>目標公司</h6>
                <p>${announcement.targetCompany}</p>
            </div>
            <div class="col-md-6">
                <h6><i class="fas fa-users me-2"></i>目標部門</h6>
                <p>${announcement.targetDepartments.map(dept => `<span class="badge bg-secondary me-1">${dept}</span>`).join('')}</p>
            </div>
        </div>
    `;
}

// 顯示統計資訊
function displayStatistics(stats) {
    const container = document.getElementById('statisticsContainer');
    
    container.innerHTML = `
        <div class="col-md-4">
            <div class="card stats-card">
                <div class="card-body text-center">
                    <div class="stats-number">${stats.targetCount}</div>
                    <div><i class="fas fa-bullhorn me-2"></i>應宣導數</div>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card stats-card">
                <div class="card-body text-center">
                    <div class="stats-number">${stats.signedCount}</div>
                    <div><i class="fas fa-signature me-2"></i>已簽確認數</div>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card stats-card">
                <div class="card-body text-center">
                    <div class="stats-number">${stats.completionRate}%</div>
                    <div><i class="fas fa-chart-line me-2"></i>完成率</div>
                </div>
            </div>
        </div>
    `;
}

// 顯示部門統計
function displayDepartmentStats(departmentStats) {
    const container = document.getElementById('departmentStatsContainer');
    
    if (!departmentStats || departmentStats.length === 0) {
        container.innerHTML = '<div class="alert alert-info">尚無部門統計資料</div>';
        return;
    }

    const maxCount = Math.max(...departmentStats.map(d => d.count));

    container.innerHTML = departmentStats.map(dept => {
        const percentage = (dept.count / maxCount) * 100;
        return `
            <div class="mb-3">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="fw-bold">${dept.department}</span>
                    <span class="badge bg-primary">${dept.count} 人</span>
                </div>
                <div class="progress">
                    <div class="progress-bar" role="progressbar" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

// 載入簽名記錄
async function loadRecords() {
    const container = document.getElementById('recordsContainer');
    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin me-2"></i>載入記錄中...</div>';

    try {
        const params = new URLSearchParams({
            page: currentRecordsPage,
            pageSize: currentRecordsPageSize
        });

        // 加入搜尋和篩選參數
        if (currentRecordsFilter) {
            params.append('search', currentRecordsFilter);
        }

        const signatureFilter = document.getElementById('signatureFilter')?.value;
        if (signatureFilter) {
            params.append('signatureFilter', signatureFilter);
        }

        const response = await fetch(`${API_BASE}/EAnnouncement/${currentAnnouncementId}/records?${params.toString()}`);
        const result = await response.json();

        if (result.success) {
            allRecords = result.data;
            displayRecords();
            displayRecordsPagination(result.totalPages, result.page);
        } else {
            container.innerHTML = `<div class="alert alert-warning">${result.message}</div>`;
        }
    } catch (error) {
        console.error('載入簽名記錄失敗:', error);
        container.innerHTML = '<div class="alert alert-danger">載入失敗，請重新整理頁面</div>';
    }
}

// 顯示簽名記錄
function displayRecords() {
    const container = document.getElementById('recordsContainer');
    
    if (!allRecords || allRecords.length === 0) {
        container.innerHTML = '<div class="alert alert-info">尚無符合條件的簽名記錄</div>';
        return;
    }

    const tableHtml = `
        <table class="table table-striped table-hover">
            <thead>
                <tr>
                    <th>姓名</th>
                    <th>員工編號</th>
                    <th>公司</th>
                    <th>部門</th>
                    <th>簽名時間</th>
                    <th>簽名狀態</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
                ${allRecords.map(record => `
                    <tr>
                        <td><strong>${record.employeeName}</strong></td>
                        <td>${record.employeeId}</td>
                        <td>${record.company}</td>
                        <td>${record.department}</td>
                        <td>${new Date(record.signedAt).toLocaleString('zh-TW')}</td>
                        <td>
                            ${record.hasSignature 
                                ? '<span class="badge bg-success"><i class="fas fa-signature me-1"></i>已簽名</span>' 
                                : '<span class="badge bg-warning"><i class="fas fa-times me-1"></i>無簽名</span>'
                            }
                        </td>
                        <td>
                            <div class="btn-group btn-group-sm">
                                ${record.hasSignature 
                                    ? `<button class="btn btn-outline-primary" onclick="viewSignatureDetail('${record.id}')" title="檢視簽名">
                                         <i class="fas fa-eye"></i>
                                       </button>
                                       <button class="btn btn-outline-success" onclick="exportRecordPdf('${record.id}')" title="匯出PDF">
                                         <i class="fas fa-file-pdf"></i>
                                       </button>`
                                    : '<span class="text-muted">-</span>'
                                }
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    container.innerHTML = tableHtml;
}

// 顯示記錄分頁
function displayRecordsPagination(totalPages, currentPageNum) {
    const container = document.getElementById('recordsPaginationContainer');
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let paginationHtml = '<nav><ul class="pagination justify-content-center">';
    
    // 上一頁
    paginationHtml += `
        <li class="page-item ${currentPageNum === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changeRecordsPage(${currentPageNum - 1})">上一頁</a>
        </li>
    `;
    
    // 頁碼
    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPageNum || Math.abs(i - currentPageNum) <= 2 || i === 1 || i === totalPages) {
            paginationHtml += `
                <li class="page-item ${i === currentPageNum ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="changeRecordsPage(${i})">${i}</a>
                </li>
            `;
        } else if (Math.abs(i - currentPageNum) === 3) {
            paginationHtml += '<li class="page-item disabled"><span class="page-link">...</span></li>';
        }
    }
    
    // 下一頁
    paginationHtml += `
        <li class="page-item ${currentPageNum === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changeRecordsPage(${currentPageNum + 1})">下一頁</a>
        </li>
    `;
    
    paginationHtml += '</ul></nav>';
    container.innerHTML = paginationHtml;
}

// 檢視簽名詳情
async function viewSignatureDetail(recordId) {
    try {
        const response = await fetch(`${API_BASE}/EAnnouncement/records/${recordId}/signature`);
        const result = await response.json();

        if (result.success) {
            const modalBody = document.getElementById('signatureViewModalBody');
            
            modalBody.innerHTML = `
                <div class="row">
                    <div class="col-md-6">
                        <h6><i class="fas fa-user me-2"></i>簽名人員</h6>
                        <p class="fw-bold">${result.data.employeeName}</p>
                        
                        <h6><i class="fas fa-calendar me-2"></i>簽名時間</h6>
                        <p>${new Date(result.data.signedAt).toLocaleString('zh-TW')}</p>
                    </div>
                    <div class="col-md-6">
                        <h6><i class="fas fa-signature me-2"></i>簽名圖片</h6>
                        <img src="${result.data.signatureData}" alt="簽名" class="img-fluid border rounded" style="max-height: 200px;">
                    </div>
                </div>
            `;

            // 顯示 Modal
            const modal = new bootstrap.Modal(document.getElementById('signatureViewModal'));
            modal.show();
        } else {
            showAlert('無法載入簽名資料: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('載入簽名失敗:', error);
        showAlert('載入簽名失敗', 'error');
    }
}

// 匯出單一記錄PDF
async function exportRecordPdf(recordId) {
    try {
        const response = await fetch(`${API_BASE}/EAnnouncement/records/${recordId}/export-pdf`);
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            
            // 從回應標頭獲取檔案名稱
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `簽名記錄_${new Date().toISOString().slice(0, 10)}.pdf`;
            
            if (contentDisposition) {
                const fileNameMatch = contentDisposition.match(/filename\*?=([^;]+)/);
                if (fileNameMatch) {
                    const encodedFileName = fileNameMatch[1].trim();
                    if (encodedFileName.startsWith("UTF-8''")) {
                        filename = decodeURIComponent(encodedFileName.substring(7));
                    } else {
                        filename = encodedFileName.replace(/"/g, '');
                    }
                }
            }
            
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showAlert('PDF 已下載完成', 'success');
        } else {
            const errorResult = await response.json();
            showAlert('下載失敗: ' + (errorResult.message || '未知錯誤'), 'error');
        }
    } catch (error) {
        console.error('下載PDF失敗:', error);
        showAlert('下載失敗，請重新嘗試', 'error');
    }
}

// 下載所有記錄的PDF
async function downloadRecordsPDF() {
    if (!currentAnnouncementId) {
        showAlert('無法取得宣導專案資訊', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/EAnnouncement/${currentAnnouncementId}/export-pdf`);
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            
            // 從回應標頭獲取檔案名稱
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `宣導記錄_${new Date().toISOString().slice(0, 10)}.pdf`;
            
            if (contentDisposition) {
                const fileNameMatch = contentDisposition.match(/filename\*?=([^;]+)/);
                if (fileNameMatch) {
                    const encodedFileName = fileNameMatch[1].trim();
                    if (encodedFileName.startsWith("UTF-8''")) {
                        filename = decodeURIComponent(encodedFileName.substring(7));
                    } else {
                        filename = encodedFileName.replace(/"/g, '');
                    }
                }
            }
            
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showAlert('PDF 已下載完成', 'success');
        } else {
            const errorResult = await response.json();
            showAlert('下載失敗: ' + (errorResult.message || '未知錯誤'), 'error');
        }
    } catch (error) {
        console.error('下載PDF失敗:', error);
        showAlert('下載失敗，請重新嘗試', 'error');
    }
}

// 記錄管理相關事件處理函數
function changeRecordsPage(page) {
    if (page >= 1) {
        currentRecordsPage = page;
        loadRecords();
    }
}

function filterRecords() {
    currentRecordsFilter = document.getElementById('recordSearch').value;
    currentRecordsPage = 1;
    loadRecords();
}

function filterRecordsBySignature() {
    currentRecordsPage = 1;
    loadRecords();
}

function changePageSize() {
    currentRecordsPageSize = parseInt(document.getElementById('recordsPageSize').value);
    currentRecordsPage = 1;
    loadRecords();
}

function backToList() {
    document.getElementById('recordsView').style.display = 'none';
    document.getElementById('listView').style.display = 'block';
    currentAnnouncementId = null;
}

// 修改現有的 exportPdf 函數以使用新的實作
async function exportPdf(announcementId) {
    currentAnnouncementId = announcementId;
    await downloadRecordsPDF();
}

// 切換封存狀態
async function toggleArchiveStatus(announcementId, currentArchiveStatus) {
    try {
        const action = currentArchiveStatus ? '取消封存' : '封存';
        
        if (!confirm(`確定要${action}此宣導專案嗎？`)) {
            return;
        }

        const response = await fetch(`${API_BASE}/EAnnouncement/${announcementId}/archive`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(!currentArchiveStatus) // 直接發送布林值
        });

        const result = await response.json();
        
        if (result.success) {
            showAlert(`專案已${action}`, 'success');
            // 重新載入列表
            await loadAnnouncements();
        } else {
            showAlert(result.message || `${action}失敗`, 'error');
        }
    } catch (error) {
        console.error('切換封存狀態失敗:', error);
        showAlert('操作失敗，請重新嘗試', 'error');
    }
}

// 切換封存顯示
function toggleArchivedDisplay() {
    loadAnnouncements();
}