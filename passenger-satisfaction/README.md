# 大都會客運乘客滿意度調查系統

這個系統已經成功建立！以下是使用說明：

## 功能特色

✅ **完整的問卷系統**

- 基本資訊收集（日期、時間、路線、駕駛長、車號）
- 硬體車輛設備評分（車身整潔、LED 路線牌、座椅等）
- 行車安全與服務評價（優良行為多選、不良行為多選）
- 整體服務滿意度評價
- 驗證碼防護機制

✅ **美觀的設計**

- 響應式設計，支援手機和電腦
- 漸層色彩搭配
- 平滑動畫效果
- 直觀的使用者介面

✅ **技術特點**

- 無需權限控管的公開頁面
- 自動從現有 API 載入大都會客運路線
- Google Sheets 存儲（可選）
- 驗證碼保護
- 完整的錯誤處理

## 訪問地址

問卷頁面位於：`http://你的伺服器地址/passenger-satisfaction/`

## Google Sheets 設定（可選）

如果您想要將問卷結果存儲到 Google Sheets，請按照以下步驟設定：

### 1. 創建 Google Sheets

1. 前往 [Google Sheets](https://sheets.google.com)
2. 創建一個新的試算表
3. 將試算表命名為「大都會客運乘客滿意度調查」
4. 複製試算表的 ID（URL 中 `/d/` 後面的長字串）

### 2. 更新配置

在 `appsettings.json` 中更新以下設定：

```json
{
  "GoogleSheets": {
    "PassengerSatisfactionSpreadsheetId": "您的Google Sheets ID"
  }
}
```

### 3. 初始化表頭

運行以下 API 來初始化 Google Sheets 的表頭：

```
POST /api/PassengerSatisfaction/init-sheets
```

或使用瀏覽器訪問：

```
http://您的伺服器地址/api/PassengerSatisfaction/init-sheets
```

## API 端點

### 問卷相關

- `GET /api/PassengerSatisfaction/options` - 獲取選項數據
- `GET /api/PassengerSatisfaction/captcha` - 生成驗證碼
- `POST /api/PassengerSatisfaction` - 提交問卷
- `POST /api/PassengerSatisfaction/init-sheets` - 初始化 Google Sheets

### 路線查詢

- `GET /api/TdxRouteInfo/names?operatorNameZh=大都會客運` - 獲取路線清單

## 問卷欄位說明

### 基本資訊

- 搭車日期：日期選擇器
- 搭車時間：小時和分鐘下拉選單
- 搭乘路線：從 API 動態載入的大都會客運路線
- 駕駛長：文字輸入
- 車號：文字輸入

### 硬體車輛設備（單選 1-5 分）

**車輛外部整潔**

- 車身整潔
- LED 路線牌

**車輛內部整潔**

- 座椅
- 地板
- 玻璃
- 拉環

**車內資訊**

- 駕駛長名牌
- 路線圖

**設備**

- 站名播報器
- 驗票機(刷卡機)
- 冷氣空調
- 燈光亮度
- 車內噪音

### 行車安全與服務（多選）

**優良行為**

- 行車平穩
- 熱心服務特殊需求乘客
- 服務親切有禮

**不良行為**

- 無（特殊選項，選擇後其他選項會被禁用）
- 未繫安全帶
- 使用手機
- 闖紅燈
- 過站不停
- 不當言論或怒罵
- 暴力行為
- 夾到乘客
- 未禮讓行人
- 吸菸、嚼檳榔
- 轉彎未停車再開
- 任意變換車道
- 態度不佳
- 非站牌區上下乘客
- 行車中聊天
- 其他（自由輸入欄位）

### 其他評價（單選 1-5 分）

- 行車間距
- 候車時間
- 站牌標示

### 整體服務滿意

- 本次乘車體驗（單選 1-5 分）
- 是否願意等待本公司班車（是/否）

### 驗證機制

- 數學運算驗證碼

## 資料存儲

問卷資料會以以下格式存儲到 Google Sheets：

| 提交時間 | 搭車日期 | 搭車時間 | 搭乘路線 | 駕駛長 | 車號 | ... | 本次乘車體驗 | 是否願意等待本公司班車 |

每一筆提交都會在 Google Sheets 中新增一行資料。

## 注意事項

1. **網路需求**：確保伺服器能夠訪問 Google Sheets API
2. **憑證檔案**：確保 `credentials/busgroup-cb1ebf981225.json` 檔案存在且有效
3. **API 權限**：Google 服務帳戶需要有目標 Google Sheets 的編輯權限
4. **CORS 設定**：已配置允許跨域訪問

## 疑難排解

### 問題：無法載入路線

**解決方案**：檢查 TdxRouteInfo API 是否正常運行

### 問題：Google Sheets 寫入失敗

**解決方案**：

1. 檢查 Google Sheets ID 是否正確
2. 確認服務帳戶有 Sheets 權限
3. 檢查憑證檔案是否有效

### 問題：驗證碼無法載入

**解決方案**：檢查 PassengerSatisfaction API 是否正常運行

---

問卷系統已經完成部署，您可以開始使用了！如有任何問題，請聯繫系統管理員。
