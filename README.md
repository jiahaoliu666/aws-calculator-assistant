# AWS Pricing Calculator 助手

這是一個 Chrome 擴展程式，允許使用者通過自然語言描述來自動填寫 AWS Pricing Calculator 表單，而不必手動配置複雜的選項。

## 功能特點

- **自然語言處理**：理解使用者的自然語言需求描述，如「我需要 5 台 t3.medium EC2 實例」
- **無縫整合**：直接在 AWS Pricing Calculator 頁面上提供交互功能
- **智能識別**：能夠從自然語言中提取服務類型、數量、配置等關鍵信息
- **多服務支持**：支持 EC2、RDS、S3 等多種 AWS 服務配置
- **用戶友好**：提供直觀的界面，即時反饋處理結果

## 支持的 AWS 服務

目前支持以下服務的自然語言識別和自動配置：

- **EC2**：實例類型、數量
- **RDS**：引擎類型、存儲容量、實例數量
- **S3**：存儲容量

## 安裝方法

### 從 Chrome 網上應用店安裝

1. 訪問 Chrome 網上應用店 (即將上線)
2. 點擊"添加至 Chrome"按鈕

### 手動安裝（開發模式）

1. 克隆或下載此儲存庫
2. 打開 Chrome 瀏覽器，進入擴展管理頁面 (`chrome://extensions/`)
3. 啟用右上角的"開發者模式"
4. 點擊"載入未封裝的擴展程式"按鈕
5. 選擇包含本擴展程式代碼的文件夾

## 使用方法

1. 前往 [AWS Pricing Calculator](https://calculator.aws/)
2. 點擊擴展程式圖標或頁面右下角的 AWS 助手按鈕
3. 在輸入框中用自然語言描述您的 AWS 服務需求
4. 點擊"估算價格"按鈕
5. 擴展程式將自動為您填寫相應的表單

## 自然語言示例

擴展程式能夠理解類似以下的自然語言描述：

- "我需要 5 台 t3.medium EC2 實例"
- "幫我設置 1 個有 100GB 儲存空間的 MySQL RDS 資料庫"
- "我想要 500GB 的 S3 儲存空間"
- "我需要 3 台 t3.large EC2 和 1 個 200GB 的 PostgreSQL 資料庫"

## 開發

### 項目結構

```
aws-calculator-assistant/
├── manifest.json           # 擴展程式清單文件
├── popup.html              # 彈出視窗 HTML
├── popup.css               # 彈出視窗樣式
├── popup.js                # 彈出視窗腳本
├── content.js              # 內容腳本，處理頁面交互
├── content.css             # 內容樣式
├── background.js           # 背景腳本
├── welcome.html            # 歡迎頁面
├── disabled.html           # 禁用狀態頁面
└── images/                 # 圖標和圖片資源
    ├── icon16.png
    ├── icon48.png
    ├── icon128.png
    ├── icon_disabled16.png
    ├── icon_disabled48.png
    └── icon_disabled128.png
```

### 開發環境設置

1. 克隆儲存庫
2. 使用開發者模式加載擴展程式
3. 對代碼進行修改後，刷新擴展程式以應用更改

## 貢獻指南

歡迎對此專案做出貢獻！如果您想提交改進或修復，請遵循以下步驟：

1. Fork 此儲存庫
2. 創建您的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 開啟 Pull Request

## 未來計劃

- 增加更多 AWS 服務的支持
- 提升自然語言處理的準確性
- 添加自定義服務模板功能
- 支持更複雜的配置選項

## 許可證

此項目採用 MIT 許可證 - 查看 [LICENSE](LICENSE) 文件了解詳情。

## 免責聲明

此擴展程式非 Amazon Web Services 的官方產品。所有商標和註冊商標均為其各自所有者的財產。
