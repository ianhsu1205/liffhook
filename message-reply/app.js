// Line 訊息自動回覆管理系統 JavaScript

// 設定 API 基礎路徑 (參考 busLeave.html 的方式)
const base_url = (() => {
  // 檢查是否為本地開發環境
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) {
    return window.location.origin + "/";
  }
  // 生產環境使用指定的後端地址
  return "https://35.221.146.143.nip.io/linehook/";
})();

// API 端點
const API_BASE = `${base_url}api/MessageAutoReply`;

// JWT Token (需要登入後取得)
let authToken = '';

// 當前編輯的規則
let currentRule = null;

// 頁面載入完成後執行
document.addEventListener('DOMContentLoaded', function() {
    // 檢查是否有儲存的 Token
    authToken = localStorage.getItem('authToken') || '';
    
    if (!authToken) {
        promptForToken();
    } else {
        loadRules();
    }

    // 搜尋框事件
    document.getElementById('searchInput').addEventListener('input', filterRules);
});

// 提示輸入 Token
function promptForToken() {
    const token = prompt('請輸入 JWT Token\n(可從瀏覽器開發者工具的 Network 中取得)');
    if (token) {
        authToken = token;
        localStorage.setItem('authToken', token);
        loadRules();
    } else {
        alert('需要 Token 才能使用管理介面');
    }
}

// 載入所有規則
async function loadRules() {
    try {
        showLoading();
        
        const response = await fetch(API_BASE, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 401) {
            localStorage.removeItem('authToken');
            promptForToken();
            return;
        }

        if (!response.ok) {
            throw new Error('載入失敗');
        }

        const rules = await response.json();
        displayRules(rules);
        updateStats(rules);
    } catch (error) {
        console.error('Error loading rules:', error);
        showError('載入規則失敗: ' + error.message);
    }
}

// 顯示規則列表
function displayRules(rules) {
    const container = document.getElementById('rulesTable');
    
    if (rules.length === 0) {
        container.innerHTML = `
            <div class="empty">
                <p>😊 還沒有任何規則</p>
                <p>點擊「新增規則」開始建立你的第一條規則吧！</p>
            </div>
        `;
        return;
    }

    const html = `
        <table>
            <thead>
                <tr>
                    <th>關鍵字</th>
                    <th>類型</th>
                    <th>處理方式</th>
                    <th>優先順序</th>
                    <th>狀態</th>
                    <th>描述</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
                ${rules.map(rule => `
                    <tr>
                        <td><strong>${escapeHtml(rule.keyword)}</strong></td>
                        <td><span class="badge badge-info">${rule.matchType}</span></td>
                        <td><span class="badge badge-warning">${rule.handlerType}</span></td>
                        <td>${rule.priority}</td>
                        <td>
                            ${rule.isActive 
                                ? '<span class="badge badge-success">啟用</span>' 
                                : '<span class="badge badge-danger">停用</span>'}
                        </td>
                        <td>${escapeHtml(rule.description || '-')}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="icon-btn icon-btn-edit" onclick="editRule('${rule.id}')" title="編輯">
                                    ✏️
                                </button>
                                <button class="icon-btn icon-btn-toggle" onclick="toggleRule('${rule.id}', ${rule.isActive})" title="${rule.isActive ? '停用' : '啟用'}">
                                    ${rule.isActive ? '⏸️' : '▶️'}
                                </button>
                                <button class="icon-btn icon-btn-delete" onclick="deleteRule('${rule.id}')" title="刪除">
                                    🗑️
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    container.innerHTML = html;
}

// 更新統計資訊
function updateStats(rules) {
    document.getElementById('totalCount').textContent = rules.length;
    document.getElementById('activeCount').textContent = rules.filter(r => r.isActive).length;
    document.getElementById('inactiveCount').textContent = rules.filter(r => !r.isActive).length;
}

// 過濾規則
function filterRules() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const rows = document.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(search) ? '' : 'none';
    });
}

// 開啟 Modal
function openModal(ruleId = null) {
    currentRule = ruleId;
    document.getElementById('ruleModal').style.display = 'block';
    document.getElementById('modalTitle').textContent = ruleId ? '編輯規則' : '新增規則';
    
    if (ruleId) {
        loadRuleData(ruleId);
    } else {
        resetForm();
    }
}

// 關閉 Modal
function closeModal() {
    document.getElementById('ruleModal').style.display = 'none';
    resetForm();
}

// 重置表單
function resetForm() {
    document.getElementById('ruleForm').reset();
    document.getElementById('ruleId').value = '';
    document.getElementById('priority').value = '100';
    document.getElementById('replyMessageType').value = 'text';
    document.getElementById('handlerType').value = 'Reply';
    handleTypeChange();
    replyTypeChange();
}

// 載入規則資料
async function loadRuleData(ruleId) {
    try {
        const response = await fetch(`${API_BASE}/${ruleId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('載入規則失敗');
        }

        const rule = await response.json();
        fillForm(rule);
    } catch (error) {
        console.error('Error loading rule:', error);
        alert('載入規則失敗: ' + error.message);
    }
}

// 填充表單
function fillForm(rule) {
    document.getElementById('ruleId').value = rule.id;
    document.getElementById('keyword').value = rule.keyword;
    document.getElementById('matchType').value = rule.matchType;
    document.getElementById('handlerType').value = rule.handlerType;
    document.getElementById('priority').value = rule.priority;
    document.getElementById('description').value = rule.description || '';
    document.getElementById('isActive').checked = rule.isActive;

    // Reply 相關
    document.getElementById('replyMessageType').value = rule.replyMessageType || 'text';
    document.getElementById('replyMessage').value = rule.replyMessage || '';
    document.getElementById('flexMessageJson').value = rule.flexMessageJson || '';

    // Function 相關
    document.getElementById('handlerAction').value = rule.handlerAction || '';
    document.getElementById('handlerParameters').value = rule.handlerParameters || '';

    // API 相關
    if (rule.handlerType === 'ApiCall' && rule.handlerParameters) {
        try {
            const apiConfig = JSON.parse(rule.handlerParameters);
            document.getElementById('apiUrl').value = apiConfig.url || '';
            document.getElementById('apiMethod').value = apiConfig.method || 'GET';
            document.getElementById('apiTimeout').value = apiConfig.timeoutSeconds || 30;
            document.getElementById('apiHeaders').value = JSON.stringify(apiConfig.headers || {}, null, 2);
            document.getElementById('apiBody').value = apiConfig.requestBody || '';
            document.getElementById('apiResponseTemplate').value = apiConfig.responseTemplate || '';
            document.getElementById('apiErrorMessage').value = apiConfig.errorMessage || '';
        } catch (e) {
            console.error('Error parsing API config:', e);
        }
    }

    handleTypeChange();
    replyTypeChange();
}

// 處理器類型改變
function handleTypeChange() {
    const type = document.getElementById('handlerType').value;
    
    // 切換到對應的 Tab
    if (type === 'Reply') {
        switchTab('reply');
    } else if (type === 'Function') {
        switchTab('function');
    } else if (type === 'ApiCall') {
        switchTab('api');
    }
}

// 回覆類型改變
function replyTypeChange() {
    const type = document.getElementById('replyMessageType').value;
    const textSection = document.getElementById('textReplySection');
    const flexSection = document.getElementById('flexReplySection');
    
    if (type === 'flex') {
        textSection.style.display = 'none';
        flexSection.style.display = 'block';
    } else {
        textSection.style.display = 'block';
        flexSection.style.display = 'none';
    }
}

// 切換 Tab
function switchTab(tabName) {
    // 隱藏所有 tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // 顯示選中的 tab
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}Tab`).classList.add('active');
}

// 載入 Flex Message 範本
function loadFlexTemplate() {
    const template = {
        "altText": "這是一個 Flex Message",
        "contents": {
            "type": "bubble",
            "body": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "text",
                        "text": "標題",
                        "weight": "bold",
                        "size": "xl"
                    },
                    {
                        "type": "text",
                        "text": "這裡是內容描述",
                        "wrap": true,
                        "color": "#666666",
                        "margin": "md"
                    }
                ]
            },
            "footer": {
                "type": "box",
                "layout": "vertical",
                "spacing": "sm",
                "contents": [
                    {
                        "type": "button",
                        "style": "primary",
                        "action": {
                            "type": "uri",
                            "label": "前往連結",
                            "uri": "https://example.com"
                        }
                    },
                    {
                        "type": "button",
                        "style": "link",
                        "action": {
                            "type": "message",
                            "label": "傳送訊息",
                            "text": "點擊按鈕"
                        }
                    }
                ]
            }
        }
    };
    
    document.getElementById('flexMessageJson').value = JSON.stringify(template, null, 2);
}

// 儲存規則
async function saveRule() {
    try {
        const handlerType = document.getElementById('handlerType').value;
        const ruleId = document.getElementById('ruleId').value;
        
        // 建立基本資料
        const data = {
            keyword: document.getElementById('keyword').value.trim(),
            matchType: document.getElementById('matchType').value,
            handlerType: handlerType,
            priority: parseInt(document.getElementById('priority').value),
            description: document.getElementById('description').value.trim(),
            isActive: document.getElementById('isActive').checked
        };

        // 根據 HandlerType 設定不同的欄位
        if (handlerType === 'Reply') {
            const replyType = document.getElementById('replyMessageType').value;
            data.replyMessageType = replyType;
            
            if (replyType === 'text') {
                data.replyMessage = document.getElementById('replyMessage').value.trim();
                data.flexMessageJson = null;
            } else {
                data.replyMessage = null;
                data.flexMessageJson = document.getElementById('flexMessageJson').value.trim();
                
                // 驗證 JSON 格式
                try {
                    JSON.parse(data.flexMessageJson);
                } catch (e) {
                    alert('Flex Message JSON 格式錯誤');
                    return;
                }
            }
        } else if (handlerType === 'Function') {
            data.replyMessageType = 'text';
            data.replyMessage = null;
            data.flexMessageJson = null;
            data.handlerAction = document.getElementById('handlerAction').value.trim();
            data.handlerParameters = document.getElementById('handlerParameters').value.trim();
        } else if (handlerType === 'ApiCall') {
            data.replyMessageType = 'text';
            data.replyMessage = null;
            data.flexMessageJson = null;
            data.handlerAction = null;
            
            // 組合 API 設定
            const apiConfig = {
                url: document.getElementById('apiUrl').value.trim(),
                method: document.getElementById('apiMethod').value,
                timeoutSeconds: parseInt(document.getElementById('apiTimeout').value)
            };
            
            const headers = document.getElementById('apiHeaders').value.trim();
            if (headers) {
                try {
                    apiConfig.headers = JSON.parse(headers);
                } catch (e) {
                    alert('Headers JSON 格式錯誤');
                    return;
                }
            }
            
            const body = document.getElementById('apiBody').value.trim();
            if (body) {
                apiConfig.requestBody = body;
            }
            
            const template = document.getElementById('apiResponseTemplate').value.trim();
            if (template) {
                apiConfig.responseTemplate = template;
            }
            
            const errorMsg = document.getElementById('apiErrorMessage').value.trim();
            if (errorMsg) {
                apiConfig.errorMessage = errorMsg;
            }
            
            data.handlerParameters = JSON.stringify(apiConfig);
        }

        // 驗證必填欄位
        if (!data.keyword) {
            alert('請輸入關鍵字');
            return;
        }

        // 發送請求
        const url = ruleId ? `${API_BASE}/${ruleId}` : API_BASE;
        const method = ruleId ? 'PUT' : 'POST';
        
        if (ruleId) {
            data.id = ruleId;
        }

        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }

        alert(ruleId ? '規則更新成功！' : '規則建立成功！');
        closeModal();
        loadRules();
    } catch (error) {
        console.error('Error saving rule:', error);
        alert('儲存失敗: ' + error.message);
    }
}

// 編輯規則
function editRule(ruleId) {
    openModal(ruleId);
}

// 切換規則狀態
async function toggleRule(ruleId, currentStatus) {
    if (!confirm(`確定要${currentStatus ? '停用' : '啟用'}此規則嗎？`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/${ruleId}/toggle`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('操作失敗');
        }

        loadRules();
    } catch (error) {
        console.error('Error toggling rule:', error);
        alert('操作失敗: ' + error.message);
    }
}

// 刪除規則
async function deleteRule(ruleId) {
    if (!confirm('確定要刪除此規則嗎？此操作無法復原！')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/${ruleId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('刪除失敗');
        }

        alert('規則已刪除！');
        loadRules();
    } catch (error) {
        console.error('Error deleting rule:', error);
        alert('刪除失敗: ' + error.message);
    }
}

// 顯示載入中
function showLoading() {
    document.getElementById('rulesTable').innerHTML = '<div class="loading">載入中...</div>';
}

// 顯示錯誤
function showError(message) {
    document.getElementById('rulesTable').innerHTML = `<div class="empty"><p>❌ ${message}</p></div>`;
}

// HTML 轉義
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// 點擊 Modal 外部關閉
window.onclick = function(event) {
    const modal = document.getElementById('ruleModal');
    if (event.target === modal) {
        closeModal();
    }
}
