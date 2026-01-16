# Line 訊息自動回覆管理系統

## 📁 資料夾結構

```
message-reply/
├── index.html          # 主介面
├── app.js              # JavaScript 邏輯
└── README.md           # 說明文件
```

## 🚀 使用方式

### 1. 開啟管理介面

**本地開發環境**：

```
http://localhost:5000/message-reply/
```

**生產環境**：

```
https://35.221.146.143.nip.io/linehook/message-reply/
```

### 2. 取得 JWT Token

#### 方法一：使用登入頁面（推薦）✨

開啟登入頁面：

```
http://localhost:5000/message-reply/login.html
```

輸入您的：

- **AppKey**：GUID 格式的應用程式金鑰
- **SecretKey**：您的密碼

登入成功後會自動儲存 Token，可直接前往管理介面。

#### 方法二：使用 API 呼叫

```bash
# 使用 curl 取得 Token
curl -X POST http://localhost:5000/api/Auth/login \
  -H "Content-Type: application/json" \
  -d '{"appKey":"your-guid-appkey","secretKey":"your-secret-key"}'
```

#### 方法三：使用 Postman

1. 建立 POST 請求到 `http://localhost:5000/api/Auth/login`
2. Body 選擇 `raw` / `JSON`
3. 輸入：
   ```json
   {
     "appKey": "your-guid-appkey",
     "secretKey": "your-secret-key"
   }
   ```
4. 發送請求，從回應中複製 Token

#### 📝 如何取得 AppKey 和 SecretKey？

請聯繫系統管理員為您建立帳號。管理員需要在資料庫的 `Auths` 表中新增記錄：

```sql
INSERT INTO "Auths" ("Id", "AppKey", "SecretKey", "Name", "IsActive", "CreatedAt")
VALUES
  (gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440000', 'your-password', '管理員', true, NOW());
```

### 3. 管理規則

介面提供完整的 CRUD 功能：

- ➕ **新增規則**：建立新的自動回覆規則
- ✏️ **編輯規則**：修改現有規則
- 🗑️ **刪除規則**：移除不需要的規則
- ⏸️/▶️ **停用/啟用**：快速切換規則狀態
- 🔍 **搜尋**：快速找到特定規則

## 🔧 API 路徑設定

系統會自動偵測環境並使用對應的 API 路徑：

```javascript
const base_url = (() => {
  // 本地開發環境
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) {
    return window.location.origin + "/"
  }
  // 生產環境
  return "https://35.221.146.143.nip.io/linehook/"
})()
```

## 📚 相關文件

- **功能說明**：[backend/QUICKSTART_MessageAutoReply.md](../QUICKSTART_MessageAutoReply.md)
- **API 呼叫**：[backend/README_ApiCall.md](../README_ApiCall.md)
- **Flex Message**：[backend/README_FlexMessage.md](../README_FlexMessage.md)
- **系統總覽**：[backend/SUMMARY_MessageAutoReply.md](../SUMMARY_MessageAutoReply.md)

## 💡 功能特色

### 三種處理器類型

1. **Reply** - 直接回覆

   - 文字訊息
   - Flex Message (Box + Button)

2. **Function** - 呼叫功能

   - 執行自訂程式邏輯

3. **ApiCall** - 呼叫外部 API
   - 支援 GET/POST/PUT/DELETE
   - 可設定 Headers、Body
   - JSON 回應解析
   - 錯誤處理

### 五種匹配類型

- **StartsWith**：開頭符合
- **Contains**：包含
- **Equals**：完全符合
- **EndsWith**：結尾符合
- **Regex**：正則表達式

## 🎨 Flex Message 設計

使用 Line 官方工具設計：
https://developers.line.biz/flex-simulator/

設計完成後，複製 JSON 貼到「Flex Message JSON」欄位即可。

## 🔐 安全性

- 使用 JWT Bearer Token 驗證
- Token 儲存在 localStorage
- 401 錯誤會自動要求重新輸入 Token

## 🐛 除錯

開啟瀏覽器開發者工具 (F12) 查看：

- Console：JavaScript 錯誤訊息
- Network：API 呼叫詳情
- Application → Local Storage：Token 儲存狀態

## 📝 範例

### 建立文字回覆規則

```
關鍵字: 你好
匹配類型: Equals
處理器類型: Reply
回覆訊息類型: text
回覆訊息: 您好！有什麼可以幫助您的嗎？
```

### 建立 API 呼叫規則

```
關鍵字: 天氣
匹配類型: StartsWith
處理器類型: ApiCall
API 網址: https://api.weather.com/data?city={param1}
HTTP Method: GET
回應範本: 今天{param1}的天氣是{$.weather.condition}，溫度{$.weather.temp}度
```

### 建立 Flex Message 規則

```
關鍵字: 服務
匹配類型: Contains
處理器類型: Reply
回覆訊息類型: flex
Flex Message JSON: (從 Flex Simulator 複製)
```

## 📞 技術支援

如有問題請聯繫開發團隊或查閱相關文件。
