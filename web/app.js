const state = {
  config: null,
  plan: null,
  targetUrl: "",
  running: false,
};

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

function updateModel() {
  if (!state.config) return;
  modelInput.value = state.config.providers[providerInput.value].defaultModel;
  apiKeyInput.placeholder = providerInput.value === "openai"
    ? "sk-… (không lưu)"
    : "Gemini API key (không lưu)";
}

async function loadConfig() {
  state.config = await request("/api/config");
  updateModel();

  const labels = Object.entries(state.config.providers).map(([name, config]) =>
    `${name === "openai" ? "OpenAI" : "Gemini"}: ${config.configured ? "sẵn sàng" : "chưa có key"}`,
  );
  document.querySelector("#provider-status").textContent = labels.join(" · ");
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
    headline.textContent = `AI đã nhận diện ${inputs.length} vùng nhập liệu và ${actions.length} nút/liên kết`;
    const labels = [...inputs, ...actions]
      .map((item) => item.label)
      .filter(Boolean)
      .slice(0, 10);
    const details = document.createElement("span");
    details.textContent = labels.length ? labels.join(" · ") : "Trang không có control hiển thị.";
    inspectionSummary.append(headline, details);
    inspectionSummary.classList.remove("hidden");
  } else {
    inspectionSummary.classList.add("hidden");
  }

  const assumptions = document.querySelector("#assumptions");
  assumptions.replaceChildren();
  if (plan.assumptions.length) {
    const title = document.createElement("strong");
    title.textContent = "Giả định:";
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
  document.querySelector("#runner-step-count").textContent = `0 / ${testCase.steps.length} bước`;
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
    detail.textContent = index === 0 ? "Đang thực thi…" : step.expected;
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
  document.querySelector("#runner-step-count").textContent = `${completed} / ${totalSteps} bước`;

  const browserImage = step.browserScreenshotDataUrl ?? step.screenshotDataUrl;
  if (browserImage) {
    showBrowserImage(browserImage, step.pageUrl);
  }

  if (step.status === "passed") {
    const next = document.querySelector(`.runner-step[data-index="${index + 1}"]`);
    if (next) {
      next.className = "runner-step running";
      next.querySelector(".runner-step-icon").textContent = "…";
      next.querySelector(".runner-step-main span").textContent = "Đang thực thi…";
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
  button.textContent = "Đang chạy…";
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
      throw new Error("Trình duyệt không hỗ trợ streaming response.");
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
    button.textContent = "Chạy lại";
  }
}

providerInput.addEventListener("change", updateModel);

previewButton.addEventListener("click", async () => {
  if (state.running) return;
  const url = runnerUrlInput.value.trim();
  if (!url) return;

  state.running = true;
  previewButton.disabled = true;
  document.querySelector("#browser-loading").classList.remove("hidden");
  setRunnerStatus("running", "OPENING");
  document.querySelector("#runner-title").textContent = "Browser preview";
  document.querySelector("#runner-description").textContent = "Đang mở trang bằng Playwright headless…";

  try {
    const preview = await request("/api/browser-preview", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
    showBrowserImage(preview.screenshotDataUrl, preview.url);
    document.querySelector("#runner-description").textContent =
      `${preview.title || "Không có tiêu đề"} · HTTP ${preview.status ?? "n/a"}`;
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
  testConnectionButton.textContent = "Đang kết nối…";
  setMessage("Đang xác thực API key và model…");

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
    setMessage(`Kết nối ${result.provider} thành công: ${result.reply}`);
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    testConnectionButton.disabled = false;
    testConnectionButton.textContent = "Kiểm tra kết nối";
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  generateButton.disabled = true;
  generateButton.textContent = "AI đang phân tích…";
  setMessage("Playwright đang nhận diện các vùng nhập liệu, sau đó AI sẽ tạo test case…");

  const shortRequirement = document.querySelector("#requirement").value.trim();

  const input = {
    provider: providerInput.value,
    model: modelInput.value.trim(),
    targetUrl: document.querySelector("#target-url").value.trim(),
    requirement: shortRequirement || "Tự động phân tích trang và tạo test case cho các chức năng chính.",
    count: Number(document.querySelector("#count").value),
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
    generateButton.textContent = "Tạo kế hoạch kiểm thử";
  }
});

loadConfig().catch((error) => setMessage(error.message, "error"));
