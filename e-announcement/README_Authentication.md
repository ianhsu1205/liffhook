# E 宣導系統 - LIFF 身份驗證說明

## 🔐 LIFF 配置資訊

```javascript
const channelId = "2006992891" // 服務 ID
const LIFF_ID = "2006993665-xkeLlPeW" // LIFF ID
```

## 🔄 身份驗證流程

### 1. 用戶入口頁面 (`user.html`)

#### 步驟流程：

1. **LIFF 初始化**

   - 使用 `liff.init({ liffId: LIFF_ID })`
   - 檢查用戶登入狀態 `liff.isLoggedIn()`
   - 如果未登入，自動導向 LINE 登入頁面

2. **獲取用戶資訊**

   - 使用 `liff.getProfile()` 取得真實的 LINE UserId
   - 調用 `/api/User/checkUser` 驗證用戶是否在系統中註冊
   - 必須提供正確的 `UserId` 和 `ChannelId`

3. **權限驗證**
   - 如果用戶不在系統中，拒絕訪問
   - 只有註冊的員工才能查看宣導專案列表

#### API 請求格式：

```javascript
POST /api/User/checkUser
Content-Type: application/json

{
  "UserId": "從 liff.getProfile() 獲得的真實 UserId",
  "ChannelId": "2006992891"
}
```

### 2. 簽名頁面 (`signature.html`)

#### 步驟流程：

1. **重複身份驗證**

   - 再次執行 LIFF 初始化和用戶驗證
   - 確保用戶身份的真實性和一致性

2. **宣導內容訪問**

   - 只有通過身份驗證的用戶才能查看宣導內容
   - 載入指定 ID 的宣導專案

3. **簽名提交**
   - 使用驗證後的真實 UserId 提交簽名
   - 後端會再次驗證用戶身份

#### 簽名提交格式：

```javascript
POST /api/EAnnouncement/signature
Content-Type: application/json

{
  "announcementId": "宣導專案ID",
  "userId": "經過 LIFF 驗證的真實 UserId",
  "signatureData": "base64 簽名圖片資料"
}
```

## 🛡️ 安全特性

### 1. **雙重身份驗證**

- **LINE 身份驗證**：確保是真實的 LINE 用戶
- **系統權限驗證**：確保用戶在公司系統中有權限

### 2. **防偽造保護**

- UserId 無法通過 URL 參數偽造
- 必須通過 LIFF SDK 獲取真實身份
- 後端會驗證 UserId 和 ChannelId 的組合

### 3. **完整審計追蹤**

- 每次訪問和簽名都記錄真實用戶身份
- 包含員工編號、姓名、部門、公司等完整資訊

## 🧪 開發模式

### 本地測試：

- 在 `localhost` 或 `127.0.0.1` 環境下會有測試模式
- 如果 LIFF 初始化失敗，會使用測試用戶資料
- 生產環境不允許測試模式，必須通過真實的 LIFF 驗證

### 測試用戶資料：

```javascript
{
  userId: 'test_user_001',
  displayName: '測試用戶',
  source: 'test',
  empId: 'EMP001',
  name: '測試用戶',
  company: '測試公司',
  dept: '資訊部'
}
```

## 📝 重要注意事項

1. **LIFF ID 必須正確設定**

   - 兩個頁面都使用相同的 LIFF ID
   - 錯誤的 LIFF ID 會導致身份驗證失敗

2. **Channel ID 必須匹配**

   - 前端和後端使用相同的 Channel ID
   - 這是用戶身份驗證的重要參數

3. **網絡環境要求**

   - 必須在能訪問 LINE 服務的網絡環境中使用
   - LIFF 需要與 LINE 伺服器通訊

4. **用戶權限管理**
   - 只有在後端用戶資料庫中註冊的員工才能使用系統
   - 新員工需要先在系統中建立用戶記錄

## 🔧 故障排除

### 常見問題：

1. **LIFF 初始化失敗**

   - 檢查 LIFF ID 是否正確
   - 確認網絡連接正常

2. **用戶驗證失敗**

   - 檢查用戶是否在系統資料庫中
   - 確認 Channel ID 是否正確

3. **簽名提交失敗**
   - 確認用戶身份驗證成功
   - 檢查宣導專案是否存在且未封存

### 除錯資訊：

在瀏覽器開發者工具中查看 Console 輸出，會有詳細的身份驗證和 API 調用日誌。
