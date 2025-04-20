document.addEventListener("DOMContentLoaded", function () {
  const userInput = document.getElementById("userInput");
  const processBtn = document.getElementById("processBtn");
  const statusMessage = document.getElementById("statusMessage");
  const loadingIndicator = document.getElementById("loadingIndicator");

  // 獲取當前服務標籤元素（添加這一行）
  const currentServiceElement = document.getElementById("currentService");

  // 檢查當前頁面是否為 AWS Pricing Calculator
  chrome.tabs.query(
    { active: true, currentWindow: true },
    async function (tabs) {
      const currentUrl = tabs[0].url;
      if (!currentUrl.includes("calculator.aws")) {
        statusMessage.textContent =
          "請在 AWS Pricing Calculator 頁面上使用此擴展程式";
        statusMessage.classList.add("error");
        processBtn.disabled = true;
        userInput.disabled = true;

        // 隱藏當前服務標籤（如果存在）
        if (currentServiceElement) {
          currentServiceElement.style.display = "none";
        }

        return;
      }

      // 獲取當前服務
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

        // 獲取當前服務信息
        chrome.tabs.sendMessage(
          tab.id,
          {
            action: "getCurrentService",
          },
          function (response) {
            if (response && response.service && currentServiceElement) {
              currentServiceElement.textContent = `當前服務: ${response.service}`;
              currentServiceElement.style.display = "block";
            }
          }
        );

        // 檢查頁面是否已完全加載
        const pageReadyResponse = await chrome.tabs.sendMessage(tab.id, {
          action: "checkPageReady",
        });

        if (!pageReadyResponse || !pageReadyResponse.ready) {
          statusMessage.textContent = "請等待頁面完全加載";
          statusMessage.classList.add("error");
          processBtn.disabled = true;
          return;
        }
      } catch (error) {
        console.error("檢查頁面狀態時出錯:", error);
        statusMessage.textContent = "請重新整理頁面後再試";
        statusMessage.classList.add("error");
        processBtn.disabled = true;
        return;
      }
    }
  );

  // 處理按鈕點擊事件
  processBtn.addEventListener("click", async function () {
    const query = userInput.value.trim();

    if (!query) {
      statusMessage.textContent = "請輸入 AWS 服務需求描述";
      statusMessage.classList.add("error");
      return;
    }

    try {
      // 顯示加載指示器
      statusMessage.textContent = "";
      statusMessage.classList.remove("error", "success");
      loadingIndicator.classList.remove("hidden");
      processBtn.disabled = true;

      // 發送消息到內容腳本
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "processNaturalLanguage",
        query: query,
      });

      loadingIndicator.classList.add("hidden");
      processBtn.disabled = false;

      if (response && response.success) {
        statusMessage.textContent = "已成功處理您的請求！";
        statusMessage.classList.add("success");
      } else {
        throw new Error(response?.error || "處理請求時發生錯誤");
      }
    } catch (error) {
      console.error("處理請求時出錯:", error);
      loadingIndicator.classList.add("hidden");
      processBtn.disabled = false;
      statusMessage.textContent =
        error.message || "處理請求時發生錯誤，請確保頁面已完全加載並重試";
      statusMessage.classList.add("error");
    }
  });
});
