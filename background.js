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

// 監聽擴充圖示點擊事件
chrome.action.onClicked.addListener((tab) => {
  // 檢查是否在AWS Pricing Calculator頁面
  if (tab.url.includes("calculator.aws")) {
    // 發送消息到內容腳本，處理圖示點擊
    chrome.tabs.sendMessage(tab.id, {
      action: "handleExtensionIconClick",
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

// 從本地儲存獲取 API 金鑰
async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["openai_api_key"], function (result) {
      resolve(result.openai_api_key || "");
    });
  });
}

// 保存 API 金鑰
function saveApiKey(key) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ openai_api_key: key }, function () {
      resolve();
    });
  });
}

// 系統提示詞
const SYSTEM_PROMPT = `你是一個專業的 AWS 雲架構師和 AWS 服務配置專家。你的任務是：
1. 解析用戶的自然語言查詢以識別他們需要的 AWS 服務和配置
2. 返回適當的 JSON 格式回應
3. 提供成本優化建議

考慮以下 AWS 服務：
- EC2 (實例類型、數量等)
- RDS (資料庫引擎、實例類型、儲存容量等)
- S3 (儲存類型、容量等)
- Lambda (記憶體配置、請求數量等)
- DynamoDB (讀寫容量單位、存儲容量等)

根據查詢從上述服務中識別出最相關的服務，並提供正確配置。

回應的 JSON 格式應該包含：
{
  "services": [
    {
      "type": "EC2",
      "count": 數量,
      "instanceType": "實例類型 (例如 t3.micro)",
      ...其他參數
    },
    {
      "type": "RDS",
      "engine": "資料庫引擎 (例如 mysql)",
      "instanceType": "實例類型",
      "storage": 儲存大小 (GB),
      ...其他參數
    },
    ...其他服務
  ],
  "region": "建議的 AWS 區域 (例如 ap-northeast-1)",
  "optimizations": [
    "優化建議1",
    "優化建議2"
  ]
}

確保解析精確，只包含查詢中明確提到或可合理推斷的服務。`;

// 處理自然語言查詢
async function processNaturalLanguageQuery(query) {
  try {
    const apiKey = await getApiKey();

    if (!apiKey) {
      throw new Error("未設置 OpenAI API 金鑰，請在擴展設置中配置");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
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

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "OpenAI API 請求失敗");
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    try {
      // 嘗試解析 JSON，有時 GPT 可能返回帶有說明的 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(content);
    } catch (parseError) {
      console.error("解析 JSON 失敗:", parseError, "原始內容:", content);
      throw new Error("無法從 API 回應中提取有效的 JSON");
    }
  } catch (error) {
    console.error("OpenAI API 調用失敗:", error);
    throw error;
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
  } else if (request.action === "saveApiKey") {
    saveApiKey(request.apiKey)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  } else if (request.action === "getApiKey") {
    getApiKey()
      .then((key) => {
        sendResponse({ success: true, apiKey: key });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});
