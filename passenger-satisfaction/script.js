(() => {
    // API 基礎 URL - 支援分離式部署
    let API_BASE = (() => {
        // 檢查是否為本地開發環境
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return window.location.origin + '/api';
        }
        // 生產環境使用指定的後端地址（包含 /api）
        return 'https://35.221.146.143.nip.io/linehook/api';
    })();
    
    // 自動偵測可用的 API 路徑（僅生產環境）
    async function detectApiBase() {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return; // 本地環境不需要偵測
        }
        
        const possiblePaths = [
            'https://35.221.146.143.nip.io/linehook/api',
            'https://35.221.146.143.nip.io/api',
            'https://35.221.146.143.nip.io/linehook',
            'https://35.221.146.143.nip.io'
        ];
        
        for (const basePath of possiblePaths) {
            try {
                const testUrl = `${basePath}/TdxRouteInfo/names?take=1`;
                const response = await fetch(testUrl);
                if (response.ok) {
                    console.log(`✅ 找到可用的 API 路徑: ${basePath}`);
                    API_BASE = basePath;
                    return;
                }
            } catch (error) {
                console.log(`❌ 無法連接: ${basePath}`);
            }
        }
        
        console.warn('⚠️ 無法找到可用的 API 路徑，使用預設路徑');
    }
    
    // DOM 元素
    const form = document.getElementById('satisfactionForm');
    const routeSelect = document.getElementById('busRoute');
    const routeLoading = document.getElementById('routeLoading');
    const hourSelect = document.getElementById('searchHour');
    const minuteSelect = document.getElementById('searchMinute');
    const captchaQuestion = document.getElementById('captchaQuestion');
    const alertContainer = document.getElementById('alertContainer');
    const submitLoading = document.getElementById('submitLoading');
    const excellentBehaviorsContainer = document.getElementById('excellentBehaviors');
    const poorBehaviorsContainer = document.getElementById('poorBehaviors');

    // 初始化頁面
    document.addEventListener('DOMContentLoaded', function() {
        initializePage();
    });

    async function initializePage() {
        try {
            // 自動偵測 API 路徑（生產環境）
            await detectApiBase();
            
            // 設置預設日期為今天
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('searchDate').value = today;

            // 初始化時間選項
            initializeTimeOptions();

            // 載入路線
            await loadRoutes();

            // 載入選項資料
            await loadOptions();

            // 載入驗證碼
            await loadCaptcha();

            // 綁定表單提交事件
            form.addEventListener('submit', handleSubmit);

            // 添加錯誤高亮樣式
            addErrorStyles();

        } catch (error) {
            console.error('初始化頁面時發生錯誤:', error);
            showAlert('初始化失敗，請重新整理頁面', 'danger');
        }
    }

    function addErrorStyles() {
        // 動態添加錯誤高亮樣式
        if (!document.getElementById('error-styles')) {
            const style = document.createElement('style');
            style.id = 'error-styles';
            style.textContent = `
                .error-highlight {
                    border: 2px solid #dc3545 !important;
                    background-color: #fff5f5 !important;
                    animation: shake 0.5s ease-in-out;
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }
                .error-highlight .rating-item input[type="radio"] {
                    accent-color: #dc3545;
                }
            `;
            document.head.appendChild(style);
        }
    }

    function initializeTimeOptions() {
        // 初始化小時選項 (0-23)
        for (let i = 0; i < 24; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i.toString().padStart(2, '0') + '時';
            hourSelect.appendChild(option);
        }

        // 初始化分鐘選項 (0-59)
        for (let i = 0; i < 60; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i.toString().padStart(2, '0') + '分';
            minuteSelect.appendChild(option);
        }
    }

    async function loadRoutes() {
        try {
            routeLoading.style.display = 'block';
            
            // 使用統一的 API 路徑
            const apiPath = `${API_BASE}/TdxRouteInfo/names?operatorNameZh=大都會客運&take=100`;
                
            const response = await fetch(apiPath);
            const data = await response.json();

            if (data.success && data.data) {
                routeSelect.innerHTML = '<option value="">請選擇路線</option>';
                
                data.data.forEach(routeName => {
                    const option = document.createElement('option');
                    option.value = routeName;
                    option.textContent = routeName;
                    routeSelect.appendChild(option);
                });
            } else {
                throw new Error('載入路線失敗');
            }
        } catch (error) {
            console.error('載入路線時發生錯誤:', error);
            showAlert('載入路線失敗，請重新整理頁面', 'warning');
        } finally {
            routeLoading.style.display = 'none';
        }
    }

    async function loadOptions() {
        try {
            // 使用統一的 API 路徑
            const apiPath = `${API_BASE}/PassengerSatisfaction/options`;
                
            const response = await fetch(apiPath);
            const data = await response.json();

            // 載入優良行為選項
            if (data.優良行為) {
                excellentBehaviorsContainer.innerHTML = '';
                data.優良行為.forEach((behavior, index) => {
                    const checkboxItem = createCheckboxItem(`優良行為_${index}`, '優良行為', behavior, behavior);
                    excellentBehaviorsContainer.appendChild(checkboxItem);
                });
            }

            // 載入不良行為選項 (先加入「無」選項)
            if (data.不良行為) {
                poorBehaviorsContainer.innerHTML = '';
                
                // 加入「無」選項
                const noneItem = createCheckboxItem('不良行為_無', '不良行為', '無', '無');
                poorBehaviorsContainer.appendChild(noneItem);

                data.不良行為.forEach((behavior, index) => {
                    const checkboxItem = createCheckboxItem(`不良行為_${index}`, '不良行為', behavior, behavior);
                    poorBehaviorsContainer.appendChild(checkboxItem);
                });

                // 為「無」選項添加特殊邏輯
                const noneCheckbox = document.getElementById('不良行為_無');
                const otherCheckboxes = poorBehaviorsContainer.querySelectorAll('input[name="不良行為"]:not(#不良行為_無)');

                noneCheckbox.addEventListener('change', function() {
                    if (this.checked) {
                        otherCheckboxes.forEach(cb => {
                            cb.checked = false;
                            cb.disabled = true;
                        });
                    } else {
                        otherCheckboxes.forEach(cb => {
                            cb.disabled = false;
                        });
                    }
                });

                otherCheckboxes.forEach(cb => {
                    cb.addEventListener('change', function() {
                        if (this.checked) {
                            noneCheckbox.checked = false;
                        }
                    });
                });
            }

        } catch (error) {
            console.error('載入選項時發生錯誤:', error);
        }
    }

    function createCheckboxItem(id, name, value, text) {
        const div = document.createElement('div');
        div.className = 'checkbox-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = id;
        checkbox.name = name;
        checkbox.value = value;
        
        const label = document.createElement('label');
        label.htmlFor = id;
        label.textContent = text;
        
        div.appendChild(checkbox);
        div.appendChild(label);
        
        return div;
    }

    async function loadCaptcha() {
        try {
            const response = await fetch(`${API_BASE}/PassengerSatisfaction/captcha`);
            const data = await response.json();

            if (data.question) {
                captchaQuestion.textContent = data.question;
                // 可以將 sessionId 存儲起來供後續驗證使用
                captchaQuestion.dataset.sessionId = data.sessionId;
                console.log('驗證碼載入成功:', data.question, 'SessionId:', data.sessionId);
            }
        } catch (error) {
            console.error('載入驗證碼時發生錯誤:', error);
            captchaQuestion.textContent = '載入驗證碼失敗，請重新整理頁面';
        }
    }

    function validateForm() {
        const errors = [];
        let firstErrorField = null;

        // 檢查基本資訊
        const requiredFields = [
            { name: '搭車日期', element: document.querySelector('input[name="搭車日期"]'), label: '搭車日期' },
            { name: '搭車時間_時', element: document.querySelector('select[name="搭車時間_時"]'), label: '搭車時間-時' },
            { name: '搭車時間_分', element: document.querySelector('select[name="搭車時間_分"]'), label: '搭車時間-分' },
            { name: '搭乘路線', element: document.querySelector('select[name="搭乘路線"]'), label: '搭乘路線' },
            { name: '駕駛長', element: document.querySelector('input[name="駕駛長"]'), label: '駕駛長' },
            { name: '車號', element: document.querySelector('input[name="車號"]'), label: '車號' },
            { name: '驗證碼', element: document.querySelector('input[name="驗證碼"]'), label: '驗證碼' }
        ];

        // 檢查所有必填的基本欄位
        requiredFields.forEach(field => {
            if (!field.element || !field.element.value || field.element.value.trim() === '') {
                errors.push(`請填寫「${field.label}」`);
                if (!firstErrorField && field.element) {
                    firstErrorField = field.element;
                }
            }
        });

        // 檢查所有必填的評分項目
        const ratingFields = [
            '車身整潔', 'LED路線牌', '座椅', '地板', '玻璃', '拉環',
            '駕駛長名牌', '路線圖', '站名播報器', '驗票機刷卡機', 
            '冷氣空調', '燈光亮度', '車內噪音', '行車間距', '候車時間', 
            '站牌標示', '本次乘車體驗', '是否願意等待本公司班車'
        ];

        ratingFields.forEach(fieldName => {
            const radioButtons = document.querySelectorAll(`input[name="${fieldName}"]:checked`);
            if (radioButtons.length === 0) {
                errors.push(`請選擇「${fieldName}」的評分`);
                if (!firstErrorField) {
                    const fieldGroup = document.querySelector(`input[name="${fieldName}"]`);
                    if (fieldGroup) {
                        firstErrorField = fieldGroup.closest('.rating-group') || fieldGroup.closest('.form-group') || fieldGroup;
                    }
                }
            }
        });

        // 檢查不良行為是否至少選擇一個選項（包括「無」）
        const poorBehaviorChecked = document.querySelectorAll('input[name="不良行為"]:checked');
        if (poorBehaviorChecked.length === 0) {
            errors.push('請在「不良行為」中至少選擇一個選項（若無不良行為請選擇「無」）');
            if (!firstErrorField) {
                firstErrorField = document.querySelector('input[name="不良行為"]');
            }
        }

        if (errors.length > 0) {
            return {
                isValid: false,
                message: '請完整填寫以下必填項目：\n• ' + errors.join('\n• '),
                firstErrorField: firstErrorField
            };
        }

        return { isValid: true };
    }

    function highlightErrorField(field) {
        // 移除之前的高亮
        const previousHighlights = document.querySelectorAll('.error-highlight');
        previousHighlights.forEach(el => el.classList.remove('error-highlight'));

        // 添加錯誤高亮樣式
        let targetElement = field;
        if (field.closest('.rating-group')) {
            targetElement = field.closest('.rating-group');
        } else if (field.closest('.checkbox-group')) {
            targetElement = field.closest('.checkbox-group');
        }

        targetElement.classList.add('error-highlight');
        
        // 3秒後移除高亮
        setTimeout(() => {
            targetElement.classList.remove('error-highlight');
        }, 3000);
    }

    function clearAllErrors() {
        // 清除所有錯誤高亮
        const errorHighlights = document.querySelectorAll('.error-highlight');
        errorHighlights.forEach(el => el.classList.remove('error-highlight'));
        
        // 清除所有驗證狀態樣式
        const validationElements = form.querySelectorAll('.is-valid, .is-invalid');
        validationElements.forEach(el => {
            el.classList.remove('is-valid', 'is-invalid');
        });
        
        // 清除之前的警告訊息
        if (alertContainer) {
            alertContainer.innerHTML = '';
        }
    }

    function resetFormToDefault() {
        // 重置所有單選按鈕為未選擇狀態
        const radioButtons = form.querySelectorAll('input[type="radio"]');
        radioButtons.forEach(radio => {
            radio.checked = false;
        });

        // 重置所有複選框為未選擇狀態
        const checkboxes = form.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
            checkbox.disabled = false; // 確保啟用所有選項
        });

        // 重置下拉選單為預設選項
        const selects = form.querySelectorAll('select');
        selects.forEach(select => {
            select.selectedIndex = 0;
        });

        // 重置文字輸入欄位
        const textInputs = form.querySelectorAll('input[type="text"], input[type="date"]');
        textInputs.forEach(input => {
            if (input.name === '搭車日期') {
                // 搭車日期重設為今天
                input.value = new Date().toISOString().split('T')[0];
            } else {
                input.value = '';
            }
        });

        // 移除所有驗證狀態樣式
        const validationElements = form.querySelectorAll('.is-valid, .is-invalid, .error-highlight');
        validationElements.forEach(el => {
            el.classList.remove('is-valid', 'is-invalid', 'error-highlight');
        });
    }

    async function handleSubmit(event) {
        event.preventDefault();
        
        // 執行表單驗證
        const validationResult = validateForm();
        if (!validationResult.isValid) {
            // 清除之前的成功訊息
            if (alertContainer) {
                const successAlerts = alertContainer.querySelectorAll('.alert-success');
                successAlerts.forEach(alert => alert.remove());
            }
            
            showAlert(validationResult.message, 'warning');
            // 滾動到第一個錯誤字段
            if (validationResult.firstErrorField) {
                validationResult.firstErrorField.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
                // 高亮顯示錯誤字段
                highlightErrorField(validationResult.firstErrorField);
            }
            return;
        }
        
        try {
            // 顯示載入狀態
            form.style.display = 'none';
            submitLoading.style.display = 'block';

            // 收集表單資料
            const formData = collectFormData();
            console.log('提交的表單資料:', formData);

            // 提交資料
            const response = await fetch(`${API_BASE}/PassengerSatisfaction`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (result.success) {
                // 清除所有錯誤高亮
                clearAllErrors();
                
                // 在頁面頂部顯示成功訊息
                showAlert(result.message || '問卷提交成功，感謝您的寶貴意見！', 'success');
                
                // 重置表單
                form.reset();
                resetFormToDefault();
                
                // 重新載入驗證碼
                await loadCaptcha();
                
                // 滾動到頂部讓用戶看到成功訊息
                window.scrollTo({ 
                    top: 0, 
                    behavior: 'smooth' 
                });
                
                // 3秒後滾動到表單開始處，方便用戶再次填寫
                setTimeout(() => {
                    const formStart = document.querySelector('.survey-header') || form;
                    formStart.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'start' 
                    });
                }, 3000);
            } else {
                throw new Error(result.message || '提交失敗');
            }

        } catch (error) {
            console.error('提交問卷時發生錯誤:', error);
            showAlert(error.message || '提交失敗，請檢查網路連線或聯繫系統管理員', 'danger');
        } finally {
            // 隱藏載入狀態
            submitLoading.style.display = 'none';
            form.style.display = 'block';
        }
    }

    function collectFormData() {
        const formData = new FormData(form);
        const data = {};

        // 收集基本資料
        for (let [key, value] of formData.entries()) {
            if (key !== '優良行為' && key !== '不良行為') {
                // 特殊處理數值字段
                if (['搭車時間_時', '搭車時間_分', '車身整潔', 'LED路線牌', '座椅', '地板', '玻璃', '拉環', 
                     '駕駛長名牌', '路線圖', '站名播報器', '驗票機刷卡機', '冷氣空調', '燈光亮度', '車內噪音',
                     '行車間距', '候車時間', '站牌標示', '本次乘車體驗'].includes(key)) {
                    data[key] = parseInt(value);
                } else if (key === '是否願意等待本公司班車') {
                    data[key] = value === 'true';
                } else {
                    data[key] = value;
                }
            }
        }

        // 收集多選項目
        data.優良行為 = Array.from(form.querySelectorAll('input[name="優良行為"]:checked'))
            .map(cb => cb.value);
        
        data.不良行為 = Array.from(form.querySelectorAll('input[name="不良行為"]:checked'))
            .map(cb => cb.value);

        // 添加驗證碼的 SessionId
        const sessionId = captchaQuestion.dataset.sessionId;
        if (sessionId) {
            data.SessionId = sessionId;
        }

        return data;
    }

    function showAlert(message, type) {
        type = type || 'info';
        const alertDiv = document.createElement('div');
        
        // 為成功訊息添加特殊樣式
        const extraClasses = type === 'success' ? ' alert-success-enhanced' : '';
        alertDiv.className = `alert alert-${type} alert-dismissible fade show${extraClasses}`;
        
        const icon = type === 'success' ? '🎉' : type === 'danger' ? '❌' : '💡';
        alertDiv.innerHTML = `
            <div class="d-flex align-items-center">
                <span class="me-2" style="font-size: 1.2em;">${icon}</span>
                <div>
                    <strong>${type === 'success' ? '提交成功！' : type === 'danger' ? '發生錯誤！' : '提示：'}</strong>
                    <div>${message}</div>
                </div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        // 清空容器並加入新訊息
        alertContainer.innerHTML = '';
        alertContainer.appendChild(alertDiv);

        // 如果是成功訊息，延長顯示時間並添加動畫
        if (type === 'success') {
            // 添加成功訊息的特殊樣式
            if (!document.getElementById('success-styles')) {
                const style = document.createElement('style');
                style.id = 'success-styles';
                style.textContent = `
                    .alert-success-enhanced {
                        border: 2px solid #28a745;
                        background: linear-gradient(135deg, #d4edda, #c3e6cb);
                        box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
                        animation: successPulse 0.6s ease-in-out;
                    }
                    @keyframes successPulse {
                        0% { transform: scale(0.95); opacity: 0.8; }
                        50% { transform: scale(1.02); }
                        100% { transform: scale(1); opacity: 1; }
                    }
                `;
                document.head.appendChild(style);
            }
            
            // 8秒後自動消失
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.remove();
                }
            }, 8000);
        } else if (type === 'warning') {
            // 警告訊息不自動消失，需要用戶手動關閉
        } else {
            // 其他類型訊息 5秒後消失
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.remove();
                }
            }, 5000);
        }
    }

    // 表單驗證增強
    form.addEventListener('input', function(event) {
        const field = event.target;
        
        // 移除之前的錯誤狀態
        field.classList.remove('is-invalid');
        
        // 即時驗證
        if (field.hasAttribute('required') && !field.value.trim()) {
            field.classList.add('is-invalid');
        } else {
            field.classList.remove('is-invalid');
            field.classList.add('is-valid');
        }
    });

    // 平滑滾動到錯誤字段
    form.addEventListener('invalid', function(event) {
        event.preventDefault();
        const firstInvalidField = form.querySelector(':invalid');
        if (firstInvalidField) {
            firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
            firstInvalidField.focus();
        }
    }, true);

})();