// 監聽來自彈出視窗的消息
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  // 檢查頁面是否已準備就緒
  if (request.action === "checkPageReady") {
    const isReady =
      document.readyState === "complete" &&
      (document.querySelector('input[placeholder="搜尋服務"]') ||
        document.querySelector('input[placeholder="Search services"]'));
    sendResponse({ ready: isReady });
    return true;
  }

  // 獲取當前服務
  if (request.action === "getCurrentService") {
    const service = detectCurrentService();
    sendResponse({ service: service });
    return true;
  }

  // 更新固定狀態
  if (request.action === "updatePinnedState") {
    updatePinnedState(request.isPinned);
    sendResponse({ success: true });
    return true;
  }

  // 處理擴充圖示點擊
  if (request.action === "handleExtensionIconClick") {
    handleExtensionIconClick();
    sendResponse({ success: true });
    return true;
  }

  // 確保面板在固定狀態下保持顯示
  if (request.action === "ensurePanelVisibleWhenPinned") {
    ensurePanelVisibleWhenPinned();
    sendResponse({ success: true });
    return true;
  }

  // 處理自然語言請求
  if (request.action === "processNaturalLanguage") {
    processUserQuery(request.query)
      .then((result) => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("處理查詢時發生錯誤:", error);
        sendResponse({
          success: false,
          error: error.message || "處理請求時發生錯誤",
        });
      });
    return true; // 保持連接開啟，異步響應
  }
});

// 處理擴充圖示點擊
function handleExtensionIconClick() {
  const assistantContainer = document.getElementById(
    "aws-calculator-assistant"
  );
  if (!assistantContainer) return;

  const panel = assistantContainer.querySelector(".assistant-panel");

  // 檢查當前固定狀態
  chrome.storage.local.get(["isPinned"], function (result) {
    const isPinned = result.isPinned || false;

    // 如果已經固定，則不做任何事情
    if (isPinned) {
      // 確保面板顯示
      if (panel && panel.classList.contains("hidden")) {
        panel.classList.remove("hidden");
      }
    } else {
      // 如果未固定，則切換面板顯示/隱藏
      if (panel) {
        panel.classList.toggle("hidden");
      }
    }
  });
}

// 確保面板在固定狀態下保持顯示
function ensurePanelVisibleWhenPinned() {
  chrome.storage.local.get(["isPinned"], function (result) {
    if (result.isPinned) {
      const assistantContainer = document.getElementById(
        "aws-calculator-assistant"
      );
      if (!assistantContainer) return;

      const panel = assistantContainer.querySelector(".assistant-panel");
      if (panel) {
        panel.classList.remove("hidden");
        assistantContainer.classList.add("pinned");
      }
    }
  });
}

// 創建 UI 元素
function createAssistantUI() {
  // 已經存在則不再創建
  if (document.getElementById("aws-calculator-assistant")) {
    return;
  }

  const assistantContainer = document.createElement("div");
  assistantContainer.id = "aws-calculator-assistant";
  assistantContainer.innerHTML = `
    <div class="assistant-toggle">
      <span class="current-service">AWS 助手</span>
    </div>
    <div class="assistant-panel hidden">
      <div class="assistant-header">
        <h3>AWS Pricing Calculator 助手</h3>
        <div class="header-actions">
          <button class="pin-btn" title="固定介面">📌</button>
          <button class="close-btn">×</button>
        </div>
      </div>
      <div class="assistant-content">
        <div class="current-service-display"></div>
        <div class="input-area">
          <textarea placeholder="請描述您需要的 AWS 服務..."></textarea>
          <button class="process-btn">估算價格</button>
        </div>
        <div class="status-area"></div>
      </div>
    </div>
  `;

  document.body.appendChild(assistantContainer);

  // 添加事件監聽器
  const toggle = assistantContainer.querySelector(".assistant-toggle");
  const panel = assistantContainer.querySelector(".assistant-panel");
  const closeBtn = assistantContainer.querySelector(".close-btn");
  const pinBtn = assistantContainer.querySelector(".pin-btn");
  const processBtn = assistantContainer.querySelector(".process-btn");
  const textarea = assistantContainer.querySelector("textarea");
  const statusArea = assistantContainer.querySelector(".status-area");
  const currentServiceToggle =
    assistantContainer.querySelector(".current-service");
  const currentServiceDisplay = assistantContainer.querySelector(
    ".current-service-display"
  );

  // 變數來追踪固定狀態
  let isPinned = false;

  // 檢查是否已經固定
  chrome.storage.local.get(["isPinned"], function (result) {
    isPinned = result.isPinned || false;
    if (isPinned) {
      assistantContainer.classList.add("pinned");
      pinBtn.classList.add("active");
      panel.classList.remove("hidden");
    }
  });

  // 初始檢測並顯示當前服務
  updateCurrentServiceDisplay(currentServiceToggle, currentServiceDisplay);

  // 定期更新服務顯示（為了捕捉用戶導航到不同服務）
  setInterval(() => {
    updateCurrentServiceDisplay(currentServiceToggle, currentServiceDisplay);
  }, 2000);

  toggle.addEventListener("click", (e) => {
    e.stopPropagation(); // 阻止事件冒泡
    panel.classList.toggle("hidden");
  });

  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // 阻止事件冒泡
    // 如果是固定狀態，則點擊關閉按鈕只解除固定
    if (isPinned) {
      isPinned = false;
      chrome.storage.local.set({ isPinned: false });
      updatePinnedState(false);
    } else {
      // 非固定狀態下，正常隱藏面板
      panel.classList.add("hidden");
    }
  });

  pinBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // 阻止事件冒泡
    // 切換固定狀態
    isPinned = !isPinned;
    chrome.storage.local.set({ isPinned: isPinned }, function () {
      updatePinnedState(isPinned);
    });
  });

  processBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // 阻止事件冒泡
    const query = textarea.value.trim();
    if (!query) {
      statusArea.textContent = "請輸入 AWS 服務需求描述";
      statusArea.classList.add("error");
      return;
    }

    statusArea.textContent = "處理中...";
    statusArea.classList.remove("error", "success");
    processBtn.disabled = true;

    processUserQuery(query)
      .then(() => {
        statusArea.textContent = "已成功處理您的請求！";
        statusArea.classList.add("success");
      })
      .catch((error) => {
        statusArea.textContent = error.message || "處理請求時發生錯誤";
        statusArea.classList.add("error");
      })
      .finally(() => {
        processBtn.disabled = false;
      });
  });

  // 阻止面板內點擊事件冒泡，避免觸發外部點擊事件
  panel.addEventListener("click", function (e) {
    e.stopPropagation();
  });

  // 添加文檔點擊事件監聽器，僅在非固定狀態下隱藏面板
  document.addEventListener("click", function (e) {
    // 確保點擊不是在助手容器內
    if (!assistantContainer.contains(e.target)) {
      // 只有在非固定狀態下才隱藏面板
      if (!isPinned && !panel.classList.contains("hidden")) {
        panel.classList.add("hidden");
      }
    }
  });

  // 監聽popstate事件（頁面導航）
  window.addEventListener("popstate", function () {
    // 如果是固定狀態，確保面板保持顯示
    if (isPinned && panel.classList.contains("hidden")) {
      panel.classList.remove("hidden");
    }
  });

  // 添加樣式表
  const styleSheet = document.createElement("style");
  styleSheet.textContent = `
    #aws-calculator-assistant {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 10000;
      font-family: 'Arial', sans-serif;
    }
    
    /* 固定式介面 */
    #aws-calculator-assistant.pinned {
      top: 20px;
      right: 20px;
      bottom: auto;
    }
    
    #aws-calculator-assistant.pinned .assistant-panel {
      position: static;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    }
    
    #aws-calculator-assistant.pinned .assistant-toggle {
      display: none;
    }
    
    .assistant-toggle {
      background-color: #232f3e;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
    
    .current-service-display {
      padding: 8px;
      margin-bottom: 10px;
      background-color: #f5f5f5;
      border-radius: 4px;
      font-weight: bold;
      color: #232f3e;
    }
    
    .assistant-panel {
      position: absolute;
      bottom: 40px;
      right: 0;
      width: 300px;
      background-color: white;
      border-radius: 6px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      overflow: hidden;
    }
    
    .assistant-header {
      background-color: #232f3e;
      color: white;
      padding: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .assistant-header h3 {
      margin: 0;
      font-size: 16px;
    }
    
    .header-actions {
      display: flex;
      align-items: center;
    }
    
    .close-btn, .pin-btn {
      background: none;
      border: none;
      color: white;
      font-size: 16px;
      cursor: pointer;
      margin-left: 5px;
      padding: 2px 5px;
      border-radius: 4px;
    }
    
    .close-btn:hover, .pin-btn:hover {
      background-color: rgba(255, 255, 255, 0.2);
    }
    
    .pin-btn.active {
      background-color: #ff9900;
      color: #232f3e;
    }
    
    .assistant-content {
      padding: 10px;
    }
    
    .input-area {
      margin-bottom: 10px;
    }
    
    .input-area textarea {
      width: 100%;
      height: 80px;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      resize: none;
      box-sizing: border-box;
      margin-bottom: 8px;
    }
    
    .process-btn {
      background-color: #ff9900;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
    }
    
    .process-btn:hover {
      background-color: #e88a00;
    }
    
    .process-btn:disabled {
      background-color: #ccc;
      cursor: not-allowed;
    }
    
    .status-area {
      min-height: 20px;
      font-size: 14px;
    }
    
    .hidden {
      display: none;
    }
    
    .error {
      color: #d13212;
    }
    
    .success {
      color: #008000;
    }
  `;
  document.head.appendChild(styleSheet);
}

// 更新固定狀態
function updatePinnedState(isPinned) {
  const assistantContainer = document.getElementById(
    "aws-calculator-assistant"
  );
  const pinBtn = assistantContainer?.querySelector(".pin-btn");
  const panel = assistantContainer?.querySelector(".assistant-panel");

  if (!assistantContainer) return;

  if (isPinned) {
    assistantContainer.classList.add("pinned");
    pinBtn?.classList.add("active");
    panel?.classList.remove("hidden");
  } else {
    assistantContainer.classList.remove("pinned");
    pinBtn?.classList.remove("active");
  }
}

// 更新當前服務顯示
function updateCurrentServiceDisplay(toggleElement, displayElement) {
  const currentService = detectCurrentService();

  // 更新彈出視窗中的顯示
  if (displayElement) {
    displayElement.textContent = `當前服務: ${currentService}`;
  }

  // 更新浮動按鈕的文字
  if (toggleElement) {
    toggleElement.textContent = currentService;
  }
}

// 檢測當前訪問的AWS服務
function detectCurrentService() {
  // 預設服務名稱
  let serviceName = "AWS 計算器";

  try {
    // 方法1: 檢查URL路徑
    const currentPath = window.location.pathname;
    if (
      currentPath.includes("/create/") ||
      currentPath.includes("/configure/")
    ) {
      const pathSegments = currentPath.split("/");
      // 通常服務名稱會在URL中
      for (let i = 0; i < pathSegments.length; i++) {
        if (pathSegments[i] === "configure" && i + 1 < pathSegments.length) {
          serviceName = pathSegments[i + 1].toUpperCase();
          break;
        }
      }
    }

    // 方法2: 檢查頁面標題
    const pageTitle = document.title;
    if (pageTitle.includes("-")) {
      const titleParts = pageTitle.split("-");
      if (titleParts.length > 1) {
        const potentialService = titleParts[0].trim();
        if (potentialService) {
          serviceName = potentialService;
        }
      }
    }

    // 方法3: 檢查頁面內容
    // 尋找服務配置頁面上的標題或麵包屑導航
    const breadcrumbs = document.querySelectorAll(".awsui-breadcrumb-item");
    if (breadcrumbs.length > 0) {
      for (let i = 0; i < breadcrumbs.length; i++) {
        const crumbText = breadcrumbs[i].textContent.trim();
        if (
          crumbText &&
          !crumbText.includes("首頁") &&
          !crumbText.includes("Home") &&
          !crumbText.includes("Calculator")
        ) {
          serviceName = crumbText;
          break;
        }
      }
    }

    // 方法4: 檢查配置頁面的服務標題
    const configHeaders = document.querySelectorAll("h1, h2");
    for (const header of configHeaders) {
      const headerText = header.textContent.trim();
      // 尋找包含"Configure"或"設定"的標題
      if (
        (headerText.includes("Configure") || headerText.includes("設定")) &&
        !headerText.includes("Calculator") &&
        !headerText.includes("計算器")
      ) {
        // 提取服務名稱
        const configMatch = headerText.match(
          /(Configure|設定)\s+([A-Za-z0-9\s]+)/
        );
        if (configMatch && configMatch[2]) {
          serviceName = configMatch[2].trim();
          break;
        }
      }
    }

    // 方法5: 檢查服務卡片中的服務名稱
    const serviceCards = document.querySelectorAll(
      '[class*="calculator-card"]'
    );
    if (serviceCards.length > 0) {
      // 如果在服務列表頁面
      serviceName = "服務選擇頁";
    }
  } catch (error) {
    console.error("檢測當前服務時出錯:", error);
  }

  return serviceName;
}

// 初始化: 當頁面加載完成後創建助手UI
document.addEventListener("DOMContentLoaded", function () {
  createAssistantUI();
});

// 當頁面加載完成時創建助手UI
window.addEventListener("load", function () {
  createAssistantUI();
});

// 也監聽 URL 變化，更新服務名稱
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    // URL 已經改變，更新服務顯示
    const toggleElement = document.querySelector(".current-service");
    const displayElement = document.querySelector(".current-service-display");
    if (toggleElement && displayElement) {
      updateCurrentServiceDisplay(toggleElement, displayElement);
    }
  }
}).observe(document, { subtree: true, childList: true });

// 處理用戶查詢
async function processUserQuery(query) {
  try {
    // 更新指示器狀態
    const assistantContainer = document.getElementById(
      "aws-calculator-assistant"
    );
    if (!assistantContainer) {
      throw new Error("無法找到助手界面元素");
    }

    const statusArea = assistantContainer.querySelector(".status-area");
    if (statusArea) {
      statusArea.innerHTML =
        '<div class="loading-spinner"></div><div>正在處理您的請求...</div>';
    }

    // 步驟 1: 解析自然語言查詢
    const parsedServices = await analyzeQuery(query);

    if (
      !parsedServices ||
      !parsedServices.services ||
      parsedServices.services.length === 0
    ) {
      throw new Error("無法識別有效的 AWS 服務需求，請嘗試更具體的描述");
    }

    // 顯示處理中訊息
    if (statusArea) {
      statusArea.innerHTML =
        '<div class="loading-spinner"></div><div>正在設定 AWS 服務...</div>';
    }

    // 步驟 2: 根據分析結果在 AWS Calculator 上執行操作
    const results = await automateCalculator(parsedServices.services);

    // 步驟 3: 顯示結果與建議
    if (statusArea) {
      let resultHTML = '<div class="result-summary">';

      // 成功計數
      const successCount = results.filter((r) => r.status === "success").length;
      resultHTML += `<h4>已成功配置 ${successCount} 個服務</h4>`;

      // 顯示每個服務的狀態
      resultHTML += '<ul class="service-list">';
      results.forEach((result) => {
        const iconClass =
          result.status === "success" ? "success-icon" : "error-icon";
        resultHTML += `<li class="${result.status}">
          <span class="${iconClass}"></span>
          <span class="service-name">${getServiceDisplayName(
            result.type
          )}</span>
          ${
            result.status !== "success"
              ? `<span class="error-message">${result.message}</span>`
              : ""
          }
        </li>`;
      });
      resultHTML += "</ul>";

      // 添加優化建議
      if (parsedServices.optimizations) {
        resultHTML +=
          '<div class="optimization-tips"><h4>成本優化建議</h4><ul>';
        parsedServices.optimizations.forEach((tip) => {
          resultHTML += `<li>${tip}</li>`;
        });
        resultHTML += "</ul></div>";
      } else if (!parsedServices.localParsed) {
        // 本地解析沒有優化建議，添加一些通用建議
        resultHTML +=
          '<div class="optimization-tips"><h4>成本優化建議</h4><ul>';
        resultHTML +=
          "<li>考慮使用預留實例或 Savings Plans 來降低 EC2 和 RDS 成本</li>";
        resultHTML +=
          "<li>對於不常訪問的 S3 數據，可使用 S3 Infrequent Access 或 Glacier 儲存類型</li>";
        resultHTML += "<li>設置自動擴展以根據需求調整資源</li>";
        resultHTML += "</ul></div>";
      }

      // 添加一個"繼續編輯"按鈕
      resultHTML += '<div class="action-buttons">';
      resultHTML += '<button class="edit-btn">繼續編輯估算</button>';
      resultHTML += '<button class="new-query-btn">新的查詢</button>';
      resultHTML += "</div>";

      resultHTML += "</div>";
      statusArea.innerHTML = resultHTML;

      // 添加按鈕事件監聽器
      const editBtn = statusArea.querySelector(".edit-btn");
      const newQueryBtn = statusArea.querySelector(".new-query-btn");

      if (editBtn) {
        editBtn.addEventListener("click", () => {
          // 隱藏結果區域，讓用戶可以手動編輯 AWS 計算器界面
          statusArea.innerHTML =
            '<div class="success-message">您可以繼續在 AWS 計算器中編輯您的估算</div>';
        });
      }

      if (newQueryBtn) {
        newQueryBtn.addEventListener("click", () => {
          // 清空輸入框並準備新的查詢
          const textarea = assistantContainer.querySelector("textarea");
          if (textarea) {
            textarea.value = "";
            textarea.focus();
          }
          statusArea.innerHTML = "";
        });
      }
    }

    return results;
  } catch (error) {
    console.error("處理查詢失敗:", error);

    // 更新錯誤訊息
    const assistantContainer = document.getElementById(
      "aws-calculator-assistant"
    );
    if (assistantContainer) {
      const statusArea = assistantContainer.querySelector(".status-area");
      if (statusArea) {
        statusArea.innerHTML = `<div class="error-message">${
          error.message || "處理請求時發生錯誤"
        }</div>`;
      }
    }

    throw error;
  }
}

// 獲取服務顯示名稱
function getServiceDisplayName(serviceType) {
  const serviceNames = {
    ec2: "Amazon EC2",
    rds: "Amazon RDS",
    s3: "Amazon S3",
    lambda: "AWS Lambda",
    dynamodb: "Amazon DynamoDB",
  };

  return serviceNames[serviceType.toLowerCase()] || serviceType;
}

// 解析用戶查詢
async function analyzeQuery(query) {
  try {
    // 嘗試使用本地解析
    const localParsed = tryLocalParsing(query);
    if (
      localParsed &&
      localParsed.services &&
      localParsed.services.length > 0
    ) {
      return localParsed;
    }

    // 如果本地解析失敗，則使用 API
    // 發送消息到背景腳本進行 API 調用
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: "processQuery", query },
        function (response) {
          if (response && response.success) {
            resolve(response.data);
          } else {
            reject(
              new Error(
                response?.error || "無法解析查詢，請檢查您的網絡連接或 API 金鑰"
              )
            );
          }
        }
      );
    });
  } catch (error) {
    console.error("解析查詢時出錯:", error);
    throw new Error("解析查詢失敗: " + error.message);
  }
}

// 本地解析功能 - 使用正則表達式匹配常見的服務請求模式
function tryLocalParsing(query) {
  const services = [];
  const ec2Regex =
    /(\d+)\s*(?:台|個|的)?\s*(?:EC2|ec2)\s*(?:實例|伺服器|服务器|instance)?(?:\s*(?:类型|類型|type)\s*(?:為|为|is|:|：)?\s*(t[0-9]\.[a-z]+|m[0-9]\.[a-z]+|c[0-9]\.[a-z]+))?/;
  const rdsRegex =
    /(\d+)\s*(?:台|個|的)?\s*(?:RDS|rds)\s*(?:資料庫|数据库|database)?(?:\s*(?:容量|大小|儲存|storage)\s*(?:為|为|is|:|：)?\s*(\d+)\s*(?:GB|TB|gb|tb))?(?:\s*(?:类型|類型|type|engine)\s*(?:為|为|is|:|：)?\s*(mysql|postgresql|aurora))?/i;
  const s3Regex =
    /(?:S3|s3)\s*(?:儲存|存储|storage|bucket)(?:\s*(?:容量|大小|儲存|storage)\s*(?:為|为|is|:|：)?\s*(\d+)\s*(?:GB|TB|gb|tb))?/i;
  const lambdaRegex =
    /(?:Lambda|lambda)(?:\s*(?:函數|函数|function))?(?:\s*(?:記憶體|内存|memory)\s*(?:為|为|is|:|：)?\s*(\d+)\s*(?:MB|mb))?(?:\s*(?:請求|请求|requests)\s*(?:為|为|is|:|：)?\s*(\d+))?/i;
  const dynamodbRegex =
    /(?:DynamoDB|dynamodb)(?:\s*(?:表|table|資料表))?(?:\s*(?:容量|大小|儲存|storage)\s*(?:為|为|is|:|：)?\s*(\d+)\s*(?:GB|gb))?(?:\s*(?:讀取|读取|read)\s*(?:容量|capacity)\s*(?:為|为|is|:|：)?\s*(\d+))?(?:\s*(?:寫入|写入|write)\s*(?:容量|capacity)\s*(?:為|为|is|:|：)?\s*(\d+))?/i;

  // 匹配 EC2
  const ec2Match = query.match(ec2Regex);
  if (ec2Match) {
    services.push({
      type: "ec2",
      count: parseInt(ec2Match[1]) || 1,
      instanceType: ec2Match[2] || "t3.micro",
    });
  }

  // 匹配 RDS
  const rdsMatch = query.match(rdsRegex);
  if (rdsMatch) {
    services.push({
      type: "rds",
      count: parseInt(rdsMatch[1]) || 1,
      storage: parseInt(rdsMatch[2]) || 100,
      engine: rdsMatch[3] || "mysql",
    });
  }

  // 匹配 S3
  const s3Match = query.match(s3Regex);
  if (s3Match) {
    services.push({
      type: "s3",
      storage: parseInt(s3Match[1]) || 100,
      storageClass: "Standard",
      requests: 10000,
    });
  }

  // 匹配 Lambda
  const lambdaMatch = query.match(lambdaRegex);
  if (lambdaMatch) {
    services.push({
      type: "lambda",
      memory: parseInt(lambdaMatch[1]) || 128,
      requests: parseInt(lambdaMatch[2]) || 1000000,
      duration: 100,
    });
  }

  // 匹配 DynamoDB
  const dynamoMatch = query.match(dynamodbRegex);
  if (dynamoMatch) {
    services.push({
      type: "dynamodb",
      storage: parseInt(dynamoMatch[1]) || 10,
      readCapacity: parseInt(dynamoMatch[2]) || 5,
      writeCapacity: parseInt(dynamoMatch[3]) || 5,
    });
  }

  // 匹配區域
  let region = "ap-northeast-1"; // 預設東京區域
  if (
    query.includes("美國") ||
    query.includes("美东") ||
    query.includes("美東") ||
    query.includes("us-east") ||
    query.includes("弗吉尼亞") ||
    query.includes("弗吉尼亚") ||
    query.includes("Virginia")
  ) {
    region = "us-east-1";
  } else if (
    query.includes("歐洲") ||
    query.includes("欧洲") ||
    query.includes("Europe") ||
    query.includes("eu-") ||
    query.includes("愛爾蘭") ||
    query.includes("爱尔兰") ||
    query.includes("Ireland")
  ) {
    region = "eu-west-1";
  } else if (
    query.includes("新加坡") ||
    query.includes("Singapore") ||
    query.includes("ap-southeast")
  ) {
    region = "ap-southeast-1";
  }

  if (services.length > 0) {
    return {
      services: services,
      region: region,
      localParsed: true,
    };
  }

  return null;
}

// 自動操作 AWS Calculator 頁面
async function automateCalculator(services) {
  let results = [];

  for (const service of services) {
    try {
      // 檢查服務類型
      switch (service.type.toLowerCase()) {
        case "ec2":
          await addEC2Service(service);
          results.push({ type: "ec2", status: "success" });
          break;
        case "rds":
          await addRDSService(service);
          results.push({ type: "rds", status: "success" });
          break;
        case "s3":
          await addS3Service(service);
          results.push({ type: "s3", status: "success" });
          break;
        case "lambda":
          await addLambdaService(service);
          results.push({ type: "lambda", status: "success" });
          break;
        case "dynamodb":
          await addDynamoDBService(service);
          results.push({ type: "dynamodb", status: "success" });
          break;
        default:
          results.push({
            type: service.type,
            status: "error",
            message: "不支持的服務類型",
          });
      }
    } catch (error) {
      console.error(`配置服務失敗 ${service.type}:`, error);
      results.push({
        type: service.type,
        status: "error",
        message: error.message,
      });
    }
  }

  return results;
}

// 添加 EC2 服務
async function addEC2Service(service) {
  try {
    // 檢查是否在服務選擇頁面
    const searchInput =
      document.querySelector('input[placeholder="搜尋服務"]') ||
      document.querySelector('input[placeholder="Search services"]');
    if (!searchInput) {
      throw new Error("請先進入新增服務頁面");
    }

    // 搜尋 EC2 服務
    searchInput.value = "EC2";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(2000);

    // 尋找 Amazon EC2 卡片並點擊設定按鈕
    const cards = document.querySelectorAll('div[class*="calculator-card"]');
    let configureButton = null;

    for (const card of cards) {
      if (
        card.textContent.includes("Amazon EC2") &&
        !card.textContent.includes("Windows Server")
      ) {
        // 在卡片內尋找設定按鈕
        const buttons = card.querySelectorAll("button");
        for (const button of buttons) {
          if (
            button.textContent.includes("設定") ||
            button.textContent.includes("Configure")
          ) {
            configureButton = button;
            break;
          }
        }
        break;
      }
    }

    if (!configureButton) {
      throw new Error("找不到 EC2 服務的設定按鈕");
    }

    // 點擊設定按鈕
    configureButton.click();
    await sleep(2000);

    // 等待配置頁面加載
    const configForm = await waitForElement("form", 5000);
    if (!configForm) {
      throw new Error("無法載入 EC2 配置頁面");
    }

    // 選擇區域（如果需要）
    const regionSelects = document.querySelectorAll("select");
    for (const select of regionSelects) {
      if (
        select.textContent.includes("ap-northeast-1") ||
        select.textContent.includes("東京")
      ) {
        select.value = "ap-northeast-1";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(1000);
        break;
      }
    }

    // 設置實例類型
    const instanceTypeSelects = document.querySelectorAll("select");
    for (const select of instanceTypeSelects) {
      if (select.textContent.includes(service.instanceType)) {
        select.value = service.instanceType;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(1000);
        break;
      }
    }

    // 設置數量
    const inputs = document.querySelectorAll('input[type="number"]');
    for (const input of inputs) {
      if (
        input.value === "1" ||
        input.placeholder.includes("quantity") ||
        input.placeholder.includes("數量")
      ) {
        input.value = service.count;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(1000);
        break;
      }
    }

    // 點擊添加到估算按鈕
    const buttons = document.querySelectorAll("button");
    for (const button of buttons) {
      if (
        button.textContent.includes("新增到估算") ||
        button.textContent.includes("Add to estimate")
      ) {
        button.click();
        break;
      }
    }

    return true;
  } catch (error) {
    console.error("添加 EC2 服務失敗:", error);
    throw new Error("無法添加 EC2 服務: " + error.message);
  }
}

// 添加 RDS 服務
async function addRDSService(service) {
  try {
    // 搜索 RDS 服務
    await searchAndClickService("RDS");

    // 等待配置頁面加載
    const configForm = await waitForElement("form", 5000);
    if (!configForm) {
      throw new Error("無法載入 RDS 配置頁面");
    }

    // 選擇資料庫引擎
    const engineSelects = document.querySelectorAll("select");
    for (const select of engineSelects) {
      if (
        select.textContent.includes("MySQL") ||
        select.textContent.includes("Aurora") ||
        select.textContent.includes("PostgreSQL")
      ) {
        select.value = service.engine || "mysql";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(1000);
        break;
      }
    }

    // 選擇區域
    const regionSelects = document.querySelectorAll("select");
    for (const select of regionSelects) {
      if (
        select.textContent.includes("ap-northeast-1") ||
        select.textContent.includes("東京")
      ) {
        select.value = service.region || "ap-northeast-1";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(1000);
        break;
      }
    }

    // 設置實例類型
    const instanceTypeSelects = document.querySelectorAll("select");
    for (const select of instanceTypeSelects) {
      if (
        select.textContent.includes("db.") ||
        select.textContent.includes("資料庫")
      ) {
        select.value = service.instanceType || "db.t3.medium";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(1000);
        break;
      }
    }

    // 設置儲存大小
    const inputs = document.querySelectorAll('input[type="number"]');
    for (const input of inputs) {
      if (
        input.placeholder.includes("storage") ||
        input.placeholder.includes("儲存") ||
        input.id.includes("storage")
      ) {
        input.value = service.storage || 100;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(1000);
        break;
      }
    }

    // 設置實例數量
    for (const input of inputs) {
      if (
        input.placeholder.includes("quantity") ||
        input.placeholder.includes("數量")
      ) {
        input.value = service.count || 1;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(1000);
        break;
      }
    }

    // 點擊添加到估算按鈕
    const buttons = document.querySelectorAll("button");
    for (const button of buttons) {
      if (
        button.textContent.includes("新增到估算") ||
        button.textContent.includes("Add to estimate")
      ) {
        button.click();
        break;
      }
    }

    return true;
  } catch (error) {
    console.error("添加 RDS 服務失敗:", error);
    throw new Error("無法添加 RDS 服務: " + error.message);
  }
}

// 添加 S3 服務
async function addS3Service(service) {
  try {
    // 搜索 S3 服務
    await searchAndClickService("S3");

    // 等待配置頁面加載
    const configForm = await waitForElement("form", 5000);
    if (!configForm) {
      throw new Error("無法載入 S3 配置頁面");
    }

    // 選擇儲存類型 (Standard, Infrequent Access, Glacier 等)
    const storageClassSelects = document.querySelectorAll("select");
    for (const select of storageClassSelects) {
      if (
        select.textContent.includes("Standard") ||
        select.textContent.includes("標準")
      ) {
        select.value = service.storageClass || "Standard";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(1000);
        break;
      }
    }

    // 設置儲存空間大小
    const inputs = document.querySelectorAll('input[type="number"]');
    for (const input of inputs) {
      if (
        input.placeholder.includes("storage") ||
        input.placeholder.includes("儲存") ||
        input.id.includes("storage")
      ) {
        input.value = service.storage || 100;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(1000);
        break;
      }
    }

    // 設置請求數量
    const requestInputs = document.querySelectorAll('input[type="number"]');
    for (const input of requestInputs) {
      if (
        input.placeholder.includes("requests") ||
        input.placeholder.includes("請求")
      ) {
        input.value = service.requests || 10000;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(1000);
        break;
      }
    }

    // 點擊添加到估算按鈕
    const buttons = document.querySelectorAll("button");
    for (const button of buttons) {
      if (
        button.textContent.includes("新增到估算") ||
        button.textContent.includes("Add to estimate")
      ) {
        button.click();
        break;
      }
    }

    return true;
  } catch (error) {
    console.error("添加 S3 服務失敗:", error);
    throw new Error("無法添加 S3 服務: " + error.message);
  }
}

// 添加 Lambda 服務
async function addLambdaService(service) {
  try {
    // 搜索 Lambda 服務
    await searchAndClickService("Lambda");

    // 等待配置頁面加載
    const configForm = await waitForElement("form", 5000);
    if (!configForm) {
      throw new Error("無法載入 Lambda 配置頁面");
    }

    // 設置記憶體大小
    const memoryInputs = document.querySelectorAll('input[type="number"]');
    for (const input of memoryInputs) {
      if (
        input.placeholder.includes("memory") ||
        input.placeholder.includes("記憶體")
      ) {
        input.value = service.memory || 128;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(1000);
        break;
      }
    }

    // 設置請求數量
    const requestInputs = document.querySelectorAll('input[type="number"]');
    for (const input of requestInputs) {
      if (
        input.placeholder.includes("requests") ||
        input.placeholder.includes("請求")
      ) {
        input.value = service.requests || 1000000;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(1000);
        break;
      }
    }

    // 設置執行時間
    const durationInputs = document.querySelectorAll('input[type="number"]');
    for (const input of durationInputs) {
      if (
        input.placeholder.includes("duration") ||
        input.placeholder.includes("時間")
      ) {
        input.value = service.duration || 100;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(1000);
        break;
      }
    }

    // 點擊添加到估算按鈕
    const buttons = document.querySelectorAll("button");
    for (const button of buttons) {
      if (
        button.textContent.includes("新增到估算") ||
        button.textContent.includes("Add to estimate")
      ) {
        button.click();
        break;
      }
    }

    return true;
  } catch (error) {
    console.error("添加 Lambda 服務失敗:", error);
    throw new Error("無法添加 Lambda 服務: " + error.message);
  }
}

// 添加 DynamoDB 服務
async function addDynamoDBService(service) {
  try {
    // 搜索 DynamoDB 服務
    await searchAndClickService("DynamoDB");

    // 等待配置頁面加載
    const configForm = await waitForElement("form", 5000);
    if (!configForm) {
      throw new Error("無法載入 DynamoDB 配置頁面");
    }

    // 設置讀取容量單位
    const readInputs = document.querySelectorAll('input[type="number"]');
    for (const input of readInputs) {
      if (
        input.placeholder.includes("read") ||
        input.placeholder.includes("讀取")
      ) {
        input.value = service.readCapacity || 5;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(1000);
        break;
      }
    }

    // 設置寫入容量單位
    const writeInputs = document.querySelectorAll('input[type="number"]');
    for (const input of writeInputs) {
      if (
        input.placeholder.includes("write") ||
        input.placeholder.includes("寫入")
      ) {
        input.value = service.writeCapacity || 5;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(1000);
        break;
      }
    }

    // 設置資料儲存大小
    const storageInputs = document.querySelectorAll('input[type="number"]');
    for (const input of storageInputs) {
      if (
        input.placeholder.includes("storage") ||
        input.placeholder.includes("儲存")
      ) {
        input.value = service.storage || 10;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(1000);
        break;
      }
    }

    // 點擊添加到估算按鈕
    const buttons = document.querySelectorAll("button");
    for (const button of buttons) {
      if (
        button.textContent.includes("新增到估算") ||
        button.textContent.includes("Add to estimate")
      ) {
        button.click();
        break;
      }
    }

    return true;
  } catch (error) {
    console.error("添加 DynamoDB 服務失敗:", error);
    throw new Error("無法添加 DynamoDB 服務: " + error.message);
  }
}

// 通用的服務搜索和點擊函數
async function searchAndClickService(serviceName) {
  const searchInput =
    document.querySelector('input[placeholder="搜尋服務"]') ||
    document.querySelector('input[placeholder="Search services"]');
  if (!searchInput) {
    throw new Error("請先進入新增服務頁面");
  }

  searchInput.value = serviceName;
  searchInput.dispatchEvent(new Event("input", { bubbles: true }));
  await sleep(2000);

  const cards = document.querySelectorAll('div[class*="calculator-card"]');
  let configureButton = null;

  for (const card of cards) {
    if (card.textContent.includes(serviceName)) {
      const buttons = card.querySelectorAll("button");
      for (const button of buttons) {
        if (
          button.textContent.includes("設定") ||
          button.textContent.includes("Configure")
        ) {
          configureButton = button;
          break;
        }
      }
      break;
    }
  }

  if (!configureButton) {
    throw new Error(`找不到 ${serviceName} 服務的設定按鈕`);
  }

  configureButton.click();
  await sleep(2000);
}

// 工具函數: 等待元素出現
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve) => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }

    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve(document.querySelector(selector));
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

// 工具函數: 延遲
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
