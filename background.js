// 監聽標籤頁更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 僅在頁面完全加載時執行，並且僅針對 AWS Pricing Calculator 網站
  if (changeInfo.status === "complete" && tab.url.includes("calculator.aws")) {
    // 顯示圖標
    chrome.action.setIcon({
      tabId: tabId,
      path: {
        16: "images/icon16.png",
        48: "images/icon48.png",
        128: "images/icon128.png",
      },
    });

    // 啟用彈出視窗
    chrome.action.setPopup({
      tabId: tabId,
      popup: "popup.html",
    });
  } else if (changeInfo.status === "complete") {
    // 對於非 AWS Calculator 頁面，顯示灰色圖標
    chrome.action.setIcon({
      tabId: tabId,
      path: {
        16: "images/icon_disabled16.png",
        48: "images/icon_disabled48.png",
        128: "images/icon_disabled128.png",
      },
    });

    // 禁用彈出視窗
    chrome.action.setPopup({
      tabId: tabId,
      popup: "disabled.html",
    });
  }
});

// 安裝或更新擴展程式時執行的操作
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // 首次安裝時，打開歡迎頁面
    chrome.tabs.create({
      url: "welcome.html",
    });
  }
});

// OpenAI API 配置
const OPENAI_API_KEY = ""; // 需要從環境變量或安全存儲獲取

// 系統提示詞
const SYSTEM_PROMPT = `你是一個 AWS 服務配置專家。你的任務是：
1. 解析用戶的自然語言查詢
2. 識別所需的 AWS 服務和配置
3. 返回結構化的配置信息
4. 提供成本優化建議

請以 JSON 格式返回結果，包含以下信息：
- services: 需要配置的服務列表
- region: 建議的區域
- duration: 使用時長
- optimizations: 成本優化建議`;

// 處理自然語言查詢
async function processNaturalLanguageQuery(query) {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: query },
        ],
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error("OpenAI API 調用失敗:", error);
    throw new Error("無法處理自然語言查詢");
  }
}

// 監聽來自內容腳本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "processQuery") {
    processNaturalLanguageQuery(request.query)
      .then((result) => {
        sendResponse({ success: true, data: result });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // 保持消息通道開啟
  }
});
