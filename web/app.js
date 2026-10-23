const state = {
  config: null,
  plan: null,
  targetUrl: "",
  running: false,
  language: "en",
};

const translations = {
  en: {
    pageTitle: "AI Test Studio",
    heroTitle: "Turn business requirements into executable test cases.",
    heroDescription: "Describe the flow to test, choose an AI provider, and get a structured test plan. Then run each case directly with Playwright.",
    targetWebsite: "Website to test",
    aiProvider: "AI provider",
    testCaseCount: "Number of test cases",
    temporaryApiKey: "Temporary API key (leave blank if configured in .env)",
    apiKeyPlaceholder: "Kept only in this tab's memory",
    requirementPlaceholder: "You can leave this blank — AI will detect input fields and buttons on the page.",
    testConnection: "Test connection",
    shortDescription: "Short description (optional)",
    privacyNote: "API keys entered here are not saved to localStorage or files.",
    generatePlan: "Generate test plan",
    aiAnalysis: "AI ANALYSIS",
    answer: "Answer",
    testCaseList: "Test case list",
    noTestRun: "No test has been run",
    runnerDescription: "Select a test case on the left to follow each Playwright step here.",
    runnerUrlLabel: "Test website URL",
    open: "Open",
    browserEmpty: "Enter a URL and select Open, or run a test case.",
    screenshotAlt: "Website under test in Playwright",
    browserLoading: "Playwright is loading the page…",
    runTest: "Run test",
    viewSteps: "View test steps",
    checkingAi: "Checking AI…",
    ready: "ready",
    missingKey: "key missing",
    noVisibleControls: "The page has no visible controls.",
    inspectionSummary: (inputs, actions) => `AI detected ${inputs} input area(s) and ${actions} button(s)/link(s)`,
    assumptions: "Assumptions:",
    steps: "steps",
    executing: "Executing…",
    running: "Running…",
    runAgain: "Run again",
    streamingUnsupported: "This browser does not support streaming responses.",
    openingPage: "Opening the page with headless Playwright…",
    noTitle: "No title",
    connecting: "Connecting…",
    validatingConnection: "Validating the API key and model…",
    connectionSuccess: (provider, reply) => `${provider} connected successfully: ${reply}`,
    generating: "AI is analyzing…",
    inspecting: "Playwright is detecting input areas, then AI will create the test cases…",
    defaultRequirement: "Automatically analyze the page and create test cases for its main features.",
  },
  vi: {
    pageTitle: "AI Test Studio",
    heroTitle: "Từ yêu cầu nghiệp vụ đến test case có thể chạy.",
    heroDescription: "Mô tả luồng cần kiểm thử, chọn AI và nhận kế hoạch kiểm thử có cấu trúc. Sau đó chạy từng case trực tiếp bằng Playwright.",
    targetWebsite: "Website cần kiểm thử",
    aiProvider: "Nhà cung cấp AI",
    testCaseCount: "Số lượng test case",
    temporaryApiKey: "API key tạm thời (để trống nếu đã cấu hình trong .env)",
    apiKeyPlaceholder: "Chỉ giữ trong bộ nhớ của tab này",
    requirementPlaceholder: "Có thể để trống — AI sẽ tự nhận diện các ô nhập liệu và nút trên trang.",
    testConnection: "Kiểm tra kết nối",
    shortDescription: "Mô tả ngắn (không bắt buộc)",
    privacyNote: "API key nhập tại đây không được lưu vào localStorage hay file.",
    generatePlan: "Tạo kế hoạch kiểm thử",
    aiAnalysis: "PHÂN TÍCH CỦA AI",
    answer: "Câu trả lời",
    testCaseList: "Danh sách test case",
    noTestRun: "Chưa chạy test",
    runnerDescription: "Chọn một test case ở bên trái để theo dõi từng bước Playwright tại đây.",
    runnerUrlLabel: "URL trang web kiểm thử",
    open: "Mở",
    browserEmpty: "Nhập URL và chọn Mở, hoặc chạy một test case.",
    screenshotAlt: "Trang web đang được Playwright kiểm thử",
    browserLoading: "Playwright đang tải trang…",
    runTest: "Chạy test",
    viewSteps: "Xem các bước kiểm thử",
    checkingAi: "Đang kiểm tra AI…",
    ready: "sẵn sàng",
    missingKey: "chưa có key",
    noVisibleControls: "Trang không có control hiển thị.",
    inspectionSummary: (inputs, actions) => `AI đã nhận diện ${inputs} vùng nhập liệu và ${actions} nút/liên kết`,
    assumptions: "Giả định:",
    steps: "bước",
    executing: "Đang thực thi…",
    running: "Đang chạy…",
    runAgain: "Chạy lại",
    streamingUnsupported: "Trình duyệt không hỗ trợ streaming response.",
    openingPage: "Đang mở trang bằng Playwright headless…",
    noTitle: "Không có tiêu đề",
    connecting: "Đang kết nối…",
    validatingConnection: "Đang xác thực API key và model…",
    connectionSuccess: (provider, reply) => `Kết nối ${provider} thành công: ${reply}`,
    generating: "AI đang phân tích…",
    inspecting: "Playwright đang nhận diện các vùng nhập liệu, sau đó AI sẽ tạo test case…",
    defaultRequirement: "Tự động phân tích trang và tạo test case cho các chức năng chính.",
  },
};

function t(key, ...args) {
  const value = translations[state.language][key];
  return typeof value === "function" ? value(...args) : value;
}

const form = document.querySelector("#plan-form");
const providerInput = document.querySelector("#provider");
const modelInput = document.querySelector("#model");
const apiKeyInput = document.querySelector("#api-key");
const testConnectionButton = document.querySelector("#test-connection");
const previewButton = document.querySelector("#preview-button");
const runnerUrlInput = document.querySelector("#runner-url");
const generateButton = document.querySelector("#generate-button");
const message = document.querySelector("#message");
const answerSection = document.querySelector("#answer-section");
const casesSection = document.querySelector("#cases-section");

function applyLanguage(language) {
  state.language = language;
  document.documentElement.lang = language;
  document.title = t("pageTitle");

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
    node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
  });
  document.querySelectorAll("[data-i18n-alt]").forEach((node) => {
    node.alt = t(node.dataset.i18nAlt);
  });
  document.querySelectorAll(".language-option").forEach((button) => {
    const active = button.dataset.language === language;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  updateModelPlaceholder();
  renderProviderStatus();
  if (state.plan) renderPlan(state.plan);
}

async function request(url, options) {
  const response = await fetch(url, {
    ...options,
    headers: { "content-type": "application/json", ...(options?.headers ?? {}) },
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error ?? `HTTP ${response.status}`);
  }
  return body;
}

function setMessage(text = "", kind = "info") {
  message.textContent = text;
  message.className = text ? `message ${kind}` : "message hidden";
}

function updateModelPlaceholder() {
  apiKeyInput.placeholder = providerInput.value === "openai"
    ? "sk-…"
    : state.language === "vi" ? "Gemini API key (không lưu)" : "Gemini API key (not saved)";
}

function updateModel() {
  if (!state.config) return;
  modelInput.value = state.config.providers[providerInput.value].defaultModel;
  updateModelPlaceholder();
}

function renderProviderStatus() {
  const status = document.querySelector("#provider-status");
  if (!state.config) {
    status.textContent = t("checkingAi");
    return;
  }
  const labels = Object.entries(state.config.providers).map(([name, config]) =>
    `${name === "openai" ? "OpenAI" : "Gemini"}: ${config.configured ? t("ready") : t("missingKey")}`,
  );
  status.textContent = labels.join(" · ");
}

async function loadConfig() {
  state.config = await request("/api/config");
  updateModel();

  renderProviderStatus();
}

function badge(text) {
  const element = document.createElement("span");
  element.className = "badge";
  element.textContent = text;
  return element;
}

function renderPlan(plan) {
  state.plan = plan;
  document.querySelector("#answer-text").textContent = plan.answer;

  const inspectionSummary = document.querySelector("#inspection-summary");
  inspectionSummary.replaceChildren();
  if (plan.pageInspection) {
    const inputs = plan.pageInspection.inputAreas ?? [];
    const actions = plan.pageInspection.actions ?? [];
    const headline = document.createElement("strong");
    headline.textContent = t("inspectionSummary", inputs.length, actions.length);
    const labels = [...inputs, ...actions]
      .map((item) => item.label)
      .filter(Boolean)
      .slice(0, 10);
    const details = document.createElement("span");
    details.textContent = labels.length ? labels.join(" · ") : t("noVisibleControls");
    inspectionSummary.append(headline, details);
    inspectionSummary.classList.remove("hidden");
  } else {
    inspectionSummary.classList.add("hidden");
  }

  const assumptions = document.querySelector("#assumptions");
  assumptions.replaceChildren();
  if (plan.assumptions.length) {
    const title = document.createElement("strong");
    title.textContent = t("assumptions");
    const list = document.createElement("ul");
    plan.assumptions.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      list.append(li);
    });
    assumptions.append(title, list);
  }

  const caseList = document.querySelector("#case-list");
  caseList.replaceChildren();
  const template = document.querySelector("#case-template");

  plan.testCases.forEach((testCase) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".test-case");
    fragment.querySelector("h3").textContent = `${testCase.id} · ${testCase.title}`;
    fragment.querySelector(".objective").textContent = testCase.objective;
    fragment.querySelector(".badges").append(badge(testCase.category), badge(testCase.priority));

    const steps = fragment.querySelector(".steps");
    testCase.steps.forEach((step) => {
      const li = document.createElement("li");
      const action = document.createElement("strong");
      action.textContent = `${step.action}: `;
      li.append(action, document.createTextNode(step.description));
      steps.append(li);
    });

    fragment.querySelector(".run-button").addEventListener("click", (event) => {
      runCase(testCase, card, event.currentTarget);
    });
    fragment.querySelector(".run-button").textContent = t("runTest");
    fragment.querySelector("summary").textContent = t("viewSteps");
    caseList.append(fragment);
  });

  document.querySelector("#case-count").textContent = `${plan.testCases.length} cases`;
  answerSection.classList.remove("hidden");
  casesSection.classList.remove("hidden");
}

function setRunnerStatus(status, label) {
  const statusNode = document.querySelector("#runner-status");
  statusNode.className = `runner-status ${status}`;
  statusNode.textContent = label;
}

function prepareRunner(testCase, card) {
  document.querySelectorAll(".test-case.active").forEach((node) => node.classList.remove("active"));
  card.classList.add("active");
  document.querySelector("#runner-title").textContent = `${testCase.id} · ${testCase.title}`;
  document.querySelector("#runner-description").textContent = testCase.objective;
  document.querySelector("#runner-progress").style.width = "0%";
  document.querySelector("#runner-step-count").textContent = `0 / ${testCase.steps.length} ${t("steps")}`;
  document.querySelector("#runner-duration").textContent = "0 ms";
  runnerUrlInput.value = state.targetUrl;
  document.querySelector("#browser-loading").classList.remove("hidden");
  setRunnerStatus("running", "RUNNING");

  const list = document.querySelector("#runner-steps");
  list.replaceChildren();
  testCase.steps.forEach((step, index) => {
    const row = document.createElement("li");
    row.className = `runner-step ${index === 0 ? "running" : "pending"}`;
    row.dataset.index = String(index);

    const icon = document.createElement("span");
    icon.className = "runner-step-icon";
    icon.textContent = index === 0 ? "…" : String(index + 1);

    const main = document.createElement("div");
    main.className = "runner-step-main";
    const action = document.createElement("strong");
    action.textContent = `${step.action} · ${step.description}`;
    const detail = document.createElement("span");
    detail.textContent = index === 0 ? t("executing") : step.expected;
    main.append(action, detail);

    const time = document.createElement("span");
    time.className = "runner-step-time";
    time.textContent = "—";
    row.append(icon, main, time);
    list.append(row);
  });
}

function renderStepEvent(index, step, totalSteps) {
  const row = document.querySelector(`.runner-step[data-index="${index}"]`);
  if (!row) return;
  row.className = `runner-step ${step.status}`;
  row.querySelector(".runner-step-icon").textContent = step.status === "passed" ? "✓" : "!";
  row.querySelector(".runner-step-main span").textContent = step.message;
  row.querySelector(".runner-step-time").textContent = `${step.durationMs} ms`;
  row.scrollIntoView({ behavior: "smooth", block: "nearest" });

  const completed = index + 1;
  document.querySelector("#runner-progress").style.width = `${(completed / totalSteps) * 100}%`;
  document.querySelector("#runner-step-count").textContent = `${completed} / ${totalSteps} ${t("steps")}`;

  const browserImage = step.browserScreenshotDataUrl ?? step.screenshotDataUrl;
  if (browserImage) {
    showBrowserImage(browserImage, step.pageUrl);
  }

  if (step.status === "passed") {
    const next = document.querySelector(`.runner-step[data-index="${index + 1}"]`);
    if (next) {
      next.className = "runner-step running";
      next.querySelector(".runner-step-icon").textContent = "…";
      next.querySelector(".runner-step-main span").textContent = t("executing");
    }
  }
}

function showBrowserImage(screenshotDataUrl, pageUrl) {
  const image = document.querySelector("#runner-screenshot");
  image.src = screenshotDataUrl;
  image.classList.remove("hidden");
  document.querySelector("#browser-empty").classList.add("hidden");
  document.querySelector("#browser-loading").classList.add("hidden");
  if (pageUrl) runnerUrlInput.value = pageUrl;
}

function handleRunEvent(event, testCase) {
  if (event.type === "step") {
    renderStepEvent(event.index, event.step, testCase.steps.length);
  }
  if (event.type === "completed") {
    const result = event.result;
    setRunnerStatus(result.status, result.status === "passed" ? "PASSED" : "FAILED");
    document.querySelector("#runner-duration").textContent = `${result.durationMs} ms`;
    document.querySelector("#runner-progress").style.width = "100%";
  }
}

async function runCase(testCase, card, button) {
  if (state.running) return;
  state.running = true;
  document.querySelectorAll(".run-button").forEach((node) => { node.disabled = true; });
  button.textContent = t("running");
  prepareRunner(testCase, card);

  try {
    const response = await fetch("/api/test-runs/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetUrl: state.targetUrl, testCase }),
    });
    if (!response.ok) {
      const body = await response.json();
      throw new Error(body.error ?? `HTTP ${response.status}`);
    }
    if (!response.body) {
      throw new Error(t("streamingUnsupported"));
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      lines.filter(Boolean).forEach((line) => handleRunEvent(JSON.parse(line), testCase));
      if (done) break;
    }
    if (buffer.trim()) handleRunEvent(JSON.parse(buffer), testCase);
  } catch (error) {
    setRunnerStatus("failed", "ERROR");
    document.querySelector("#runner-description").textContent = error.message;
  } finally {
    document.querySelector("#browser-loading").classList.add("hidden");
    state.running = false;
    document.querySelectorAll(".run-button").forEach((node) => { node.disabled = false; });
    button.textContent = t("runAgain");
  }
}

providerInput.addEventListener("change", updateModel);

document.querySelectorAll(".language-option").forEach((button) => {
  button.addEventListener("click", () => applyLanguage(button.dataset.language));
});

previewButton.addEventListener("click", async () => {
  if (state.running) return;
  const url = runnerUrlInput.value.trim();
  if (!url) return;

  state.running = true;
  previewButton.disabled = true;
  document.querySelector("#browser-loading").classList.remove("hidden");
  setRunnerStatus("running", "OPENING");
  document.querySelector("#runner-title").textContent = "Browser preview";
  document.querySelector("#runner-description").textContent = t("openingPage");

  try {
    const preview = await request("/api/browser-preview", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
    showBrowserImage(preview.screenshotDataUrl, preview.url);
    document.querySelector("#runner-description").textContent =
      `${preview.title || t("noTitle")} · HTTP ${preview.status ?? "n/a"}`;
    setRunnerStatus("passed", "OPENED");
  } catch (error) {
    document.querySelector("#browser-loading").classList.add("hidden");
    document.querySelector("#runner-description").textContent = error.message;
    setRunnerStatus("failed", "ERROR");
  } finally {
    state.running = false;
    previewButton.disabled = false;
  }
});

testConnectionButton.addEventListener("click", async () => {
  testConnectionButton.disabled = true;
  testConnectionButton.textContent = t("connecting");
  setMessage(t("validatingConnection"));

  try {
    const apiKey = apiKeyInput.value.trim();
    const result = await request("/api/providers/test", {
      method: "POST",
      body: JSON.stringify({
        provider: providerInput.value,
        model: modelInput.value.trim(),
        ...(apiKey ? { apiKey } : {}),
      }),
    });
    setMessage(t("connectionSuccess", result.provider, result.reply));
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    testConnectionButton.disabled = false;
    testConnectionButton.textContent = t("testConnection");
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  generateButton.disabled = true;
  generateButton.textContent = t("generating");
  setMessage(t("inspecting"));

  const shortRequirement = document.querySelector("#requirement").value.trim();

  const input = {
    provider: providerInput.value,
    model: modelInput.value.trim(),
    targetUrl: document.querySelector("#target-url").value.trim(),
    requirement: shortRequirement || t("defaultRequirement"),
    count: Number(document.querySelector("#count").value),
    language: state.language,
  };
  const apiKey = apiKeyInput.value.trim();
  if (apiKey) input.apiKey = apiKey;
  state.targetUrl = input.targetUrl;

  try {
    const plan = await request("/api/test-plans", {
      method: "POST",
      body: JSON.stringify(input),
    });
    renderPlan(plan);
    setMessage();
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    generateButton.disabled = false;
    generateButton.textContent = t("generatePlan");
  }
});

applyLanguage("en");
loadConfig().catch((error) => setMessage(error.message, "error"));
