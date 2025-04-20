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
        <button class="close-btn">×</button>
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
  const processBtn = assistantContainer.querySelector(".process-btn");
  const textarea = assistantContainer.querySelector("textarea");
  const statusArea = assistantContainer.querySelector(".status-area");
  const currentServiceToggle =
    assistantContainer.querySelector(".current-service");
  const currentServiceDisplay = assistantContainer.querySelector(
    ".current-service-display"
  );

  // 初始檢測並顯示當前服務
  updateCurrentServiceDisplay(currentServiceToggle, currentServiceDisplay);

  // 定期更新服務顯示（為了捕捉用戶導航到不同服務）
  setInterval(() => {
    updateCurrentServiceDisplay(currentServiceToggle, currentServiceDisplay);
  }, 2000);

  toggle.addEventListener("click", () => {
    panel.classList.toggle("hidden");
  });

  closeBtn.addEventListener("click", () => {
    panel.classList.add("hidden");
  });

  processBtn.addEventListener("click", () => {
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
    
    .close-btn {
      background: none;
      border: none;
      color: white;
      font-size: 20px;
      cursor: pointer;
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

// 處理用戶查詢的主要函數
async function processUserQuery(query) {
  try {
    // 檢查頁面是否已加載
    const searchInput =
      document.querySelector('input[placeholder="搜尋服務"]') ||
      document.querySelector('input[placeholder="Search services"]');
    if (!searchInput) {
      throw new Error("請確保您在 AWS Pricing Calculator 的新增服務頁面");
    }

    // 步驟 1: 分析自然語言查詢
    const parsedServices = await analyzeQuery(query);

    // 步驟 2: 根據分析結果在 AWS Calculator 上執行操作
    await automateCalculator(parsedServices);

    return true;
  } catch (error) {
    console.error("處理查詢失敗:", error);
    throw error;
  }
}

// 分析用戶的自然語言查詢
async function analyzeQuery(query) {
  try {
    // 發送查詢到背景腳本進行 OpenAI 處理
    const response = await chrome.runtime.sendMessage({
      action: "processQuery",
      query: query,
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    // 處理 OpenAI 返回的結構化數據
    const result = response.data;
    console.log("OpenAI 解析結果:", result);

    // 驗證並轉換服務配置
    const services = [];
    for (const service of result.services) {
      // 根據服務類型進行相應的處理
      switch (service.type.toUpperCase()) {
        case "EC2":
          services.push({
            type: "EC2",
            count: service.params.count || 1,
            instanceType: service.params.instanceType,
            region: result.region || "ap-northeast-1",
          });
          break;
        case "RDS":
          services.push({
            type: "RDS",
            engine: service.params.engine,
            instanceType: service.params.instanceType,
            storage: service.params.storage,
            region: result.region || "ap-northeast-1",
          });
          break;
        case "S3":
          services.push({
            type: "S3",
            storageType: service.params.storageType,
            capacity: service.params.capacity,
            region: result.region || "ap-northeast-1",
          });
          break;
        // 可以添加更多服務類型的處理
        default:
          console.warn(`不支持的服務類型: ${service.type}`);
      }
    }

    if (services.length === 0) {
      throw new Error("無法識別有效的 AWS 服務需求，請嘗試更具體的描述");
    }

    return services;
  } catch (error) {
    console.error("查詢分析失敗:", error);
    throw error;
  }
}

// 自動操作 AWS Calculator 頁面
async function automateCalculator(services) {
  for (const service of services) {
    switch (service.type) {
      case "EC2":
        await addEC2Service(service);
        break;
      case "RDS":
        await addRDSService(service);
        break;
      case "S3":
        await addS3Service(service);
        break;
      default:
        console.warn(`不支持的服務類型: ${service.type}`);
    }
  }
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

    // 配置 RDS 參數
    // ... RDS 具體配置邏輯 ...

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

    // 配置 S3 參數
    // ... S3 具體配置邏輯 ...

    return true;
  } catch (error) {
    console.error("添加 S3 服務失敗:", error);
    throw new Error("無法添加 S3 服務: " + error.message);
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
