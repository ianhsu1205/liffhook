# Flex Message 儲存問題排查

## 問題描述

儲存 Flex Message 時出現錯誤

## 排查步驟

### 1. 確認後端已重啟

後端程式碼已修改，需要重新啟動才能生效：

```bash
# 停止目前執行的應用程式 (Ctrl+C)
# 然後重新啟動
cd D:\project\LineHookProject\backend
dotnet run
```

或者在 VS Code 中：

- 停止偵錯 (Shift+F5)
- 重新啟動偵錯 (F5)

### 2. 檢查瀏覽器 Console

開啟瀏覽器開發者工具 (F12)：

1. 切換到 Console 分頁
2. 嘗試儲存 Flex Message
3. 查看完整的錯誤訊息

### 3. 檢查 Network 分頁

在開發者工具中：

1. 切換到 Network 分頁
2. 嘗試儲存
3. 找到 `MessageAutoReply` 的請求
4. 查看 Request Payload 和 Response

### 4. 測試資料格式

**正確的 Flex Message JSON 範例**：

```json
{
  "altText": "測試訊息",
  "contents": {
    "type": "bubble",
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "text",
          "text": "測試標題",
          "weight": "bold",
          "size": "xl"
        }
      ]
    }
  }
}
```

### 5. 檢查資料庫連線

確認資料庫可正常存取：

```sql
-- 測試查詢
SELECT * FROM "MessageAutoReplies" LIMIT 1;
```

### 6. 常見問題

#### 問題 1：後端未重啟

**症狀**：儲存時提示「回覆訊息不能為空」
**解決**：重啟後端應用程式

#### 問題 2：JSON 格式錯誤

**症狀**：提示「Flex Message JSON 格式錯誤」
**解決**：檢查 JSON 是否有語法錯誤，使用 JSON 驗證工具

#### 問題 3：Token 過期

**症狀**：401 Unauthorized
**解決**：重新登入取得新 Token

#### 問題 4：欄位長度超限

**症狀**：資料庫錯誤
**解決**：FlexMessageJson 欄位沒有長度限制，但要確保 JSON 格式正確

## 測試步驟

1. **簡單測試 - 文字訊息**

   - 關鍵字：test
   - 類型：Reply
   - 回覆類型：text
   - 回覆訊息：測試訊息
   - 儲存 ✅

2. **Flex Message 測試**
   - 關鍵字：flextest
   - 類型：Reply
   - 回覆類型：flex
   - 複製上面的 Flex Message 範例
   - 儲存 ✅

## 確認清單

- [ ] 後端已重啟
- [ ] Token 有效
- [ ] Flex Message JSON 格式正確
- [ ] 瀏覽器 Console 無錯誤
- [ ] Network 回應正常

## 需要協助？

如果問題持續，請提供：

1. 瀏覽器 Console 的完整錯誤訊息
2. Network 分頁中的 Request Payload
3. Network 分頁中的 Response
