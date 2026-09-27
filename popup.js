const PRESETS = [360, 480, 640, 768, 1024, 1280, 1366, 1440, 1600, 1920, 2560, 3440];

// Runs inside the page. Must be self-contained (no outer closure references).
function responsiveViewerAction(action, width) {
  const MIN_WIDTH = 320;
  const HANDLE_WIDTH = 8;

  if (action === "disable") {
    if (window.__responsiveViewer) {
      window.__responsiveViewer.cleanup();
      delete window.__responsiveViewer;
    }
    return { active: false, width: null, viewportWidth: document.documentElement.clientWidth };
  }

  if (action === "query") {
    return {
      active: !!window.__responsiveViewer,
      width: window.__responsiveViewer ? window.__responsiveViewer.width : null,
      viewportWidth: document.documentElement.clientWidth,
    };
  }

  // action === "setWidth"
  if (window.__responsiveViewer) {
    window.__responsiveViewer.setWidth(width);
    return {
      active: true,
      width: window.__responsiveViewer.width,
      viewportWidth: document.documentElement.clientWidth,
    };
  }

  const html = document.documentElement;
  const body = document.body;
  const getViewportWidth = () => html.clientWidth;
  let currentWidth = Math.min(width, getViewportWidth() - HANDLE_WIDTH * 4);

  // Hide the live page and render it inside an iframe instead, so the framed
  // document gets its own real viewport and @media/vw/matchMedia respond to it.
  const originalBodyDisplay = body.style.display;
  body.style.setProperty("display", "none", "important");

  const container = document.createElement("div");
  Object.assign(container.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483645",
    background:
      "repeating-conic-gradient(#333 0% 25%, #3a3a3a 0% 50%) 0 0 / 24px 24px",
    display: "flex",
    justifyContent: "center",
  });

  const iframe = document.createElement("iframe");
  iframe.src = location.href;
  Object.assign(iframe.style, {
    width: currentWidth + "px",
    height: "100%",
    border: "none",
    background: "#fff",
    boxShadow: "0 0 40px rgba(0, 0, 0, 0.5)",
  });
  container.appendChild(iframe);
  html.appendChild(container);

  const widthLabel = document.createElement("div");
  Object.assign(widthLabel.style, {
    position: "fixed",
    padding: "8px 16px",
    background: "rgba(0, 0, 0, 0.75)",
    color: "#fff",
    font: "18px/1.4 system-ui, sans-serif",
    fontWeight: "600",
    borderRadius: "6px",
    zIndex: "2147483647",
    pointerEvents: "none",
    opacity: "0",
    transition: "opacity 0.15s",
  });
  html.appendChild(widthLabel);
  let hideLabelTimer;
  function showWidthLabel() {
    widthLabel.textContent = currentWidth + "px";
    widthLabel.style.opacity = "1";
    clearTimeout(hideLabelTimer);
    hideLabelTimer = setTimeout(() => {
      widthLabel.style.opacity = "0";
    }, 1000);
  }

  function applyWidth() {
    iframe.style.width = currentWidth + "px";
    positionHandles();
    showWidthLabel();
    if (window.__responsiveViewer) window.__responsiveViewer.width = currentWidth;
  }

  function positionHandles() {
    const rect = iframe.getBoundingClientRect();
    leftHandle.style.left = rect.left - HANDLE_WIDTH + "px";
    rightHandle.style.left = rect.right + "px";
    widthLabel.style.top = rect.top + 12 + "px";
    widthLabel.style.left = rect.right - widthLabel.offsetWidth - 12 + "px";
  }

  function makeHandle(side) {
    const handle = document.createElement("div");
    handle.setAttribute("data-responsive-viewer-handle", side);
    Object.assign(handle.style, {
      position: "fixed",
      top: "0",
      width: HANDLE_WIDTH + "px",
      height: "100%",
      background: "rgba(0, 120, 255, 0.5)",
      cursor: "ew-resize",
      zIndex: "2147483647",
    });
    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      startDrag(side);
    });
    html.appendChild(handle);
    return handle;
  }

  const leftHandle = makeHandle("left");
  const rightHandle = makeHandle("right");

  // Captures mousemove over the iframe during drags, since the iframe would
  // otherwise swallow mouse events into its own document.
  const dragOverlay = document.createElement("div");
  Object.assign(dragOverlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483646",
    cursor: "ew-resize",
    display: "none",
  });
  html.appendChild(dragOverlay);

  function startDrag(side) {
    dragOverlay.style.display = "block";
    function onMouseMove(e) {
      const center = getViewportWidth() / 2;
      const distance =
        side === "right" ? e.clientX - center : center - e.clientX;
      currentWidth = Math.max(
        MIN_WIDTH,
        Math.min(getViewportWidth() - HANDLE_WIDTH * 2, distance * 2)
      );
      applyWidth();
    }
    function onMouseUp() {
      dragOverlay.style.display = "none";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function onResize() {
    currentWidth = Math.min(currentWidth, getViewportWidth() - HANDLE_WIDTH * 2);
    applyWidth();
  }
  window.addEventListener("resize", onResize);

  function setWidth(newWidth) {
    currentWidth = Math.max(MIN_WIDTH, Math.min(newWidth, getViewportWidth() - HANDLE_WIDTH * 2));
    applyWidth();
  }

  function cleanup() {
    container.remove();
    leftHandle.remove();
    rightHandle.remove();
    dragOverlay.remove();
    widthLabel.remove();
    clearTimeout(hideLabelTimer);
    window.removeEventListener("resize", onResize);
    if (originalBodyDisplay) {
      body.style.display = originalBodyDisplay;
    } else {
      body.style.removeProperty("display");
    }
  }

  window.__responsiveViewer = { cleanup, setWidth, width: currentWidth };
  applyWidth();
  return { active: true, width: currentWidth, viewportWidth: getViewportWidth() };
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

const NON_SCRIPTABLE_PATTERNS = [
  /^chrome:/,
  /^edge:/,
  /^about:/,
  /^chrome-extension:/,
  /^https:\/\/chrome\.google\.com\/webstore/,
  /^https:\/\/chromewebstore\.google\.com/,
];

function getNonScriptableReason(tab) {
  if (!tab || !tab.url) {
    return "This page can't be resized.";
  }
  if (tab.url.startsWith("file:")) {
    return "Local files aren't supported unless \"Allow access to file URLs\" is enabled for this extension.";
  }
  if (NON_SCRIPTABLE_PATTERNS.some((re) => re.test(tab.url))) {
    return "Browser and store pages can't be resized.";
  }
  return null;
}

async function run(action, width) {
  const tab = await getActiveTab();
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: responsiveViewerAction,
    args: [action, width ?? null],
  });
  return result;
}

async function init() {
  const list = document.getElementById("presets");
  const offBtn = document.getElementById("off-btn");
  const warning = document.getElementById("warning");
  const buttons = new Map();

  function showWarning(message) {
    warning.textContent = message;
    warning.style.display = "block";
    list.style.display = "none";
    offBtn.disabled = true;
  }

  const tab = await getActiveTab();
  const reason = getNonScriptableReason(tab);
  if (reason) {
    showWarning(reason);
    return;
  }

  let state;
  try {
    state = await run("query");
  } catch (err) {
    showWarning("Couldn't access this page: " + err.message);
    return;
  }

  function render(state) {
    buttons.forEach((btn, preset) => {
      btn.disabled = preset > state.viewportWidth;
      btn.classList.toggle("active", state.active && state.width === preset);
    });
    offBtn.disabled = !state.active;
  }

  PRESETS.forEach((preset) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.textContent = preset + "px";
    btn.addEventListener("click", async () => {
      try {
        render(await run("setWidth", preset));
      } catch (err) {
        showWarning("Couldn't access this page: " + err.message);
      }
    });
    li.appendChild(btn);
    list.appendChild(li);
    buttons.set(preset, btn);
  });

  offBtn.addEventListener("click", async () => {
    try {
      render(await run("disable"));
    } catch (err) {
      showWarning("Couldn't access this page: " + err.message);
    }
  });

  render(state);
}

init();
