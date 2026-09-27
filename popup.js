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
  const originalHtmlStyle = html.getAttribute("style");
  const originalBodyStyle = body.getAttribute("style");
  const getViewportWidth = () => html.clientWidth;
  let currentWidth = Math.min(width, getViewportWidth() - HANDLE_WIDTH * 4);

  function applyWidth() {
    html.style.setProperty(
      "background",
      "repeating-conic-gradient(#333 0% 25%, #3a3a3a 0% 50%) 0 0 / 24px 24px",
      "important"
    );
    body.style.setProperty("max-width", currentWidth + "px", "important");
    body.style.setProperty("width", currentWidth + "px", "important");
    body.style.setProperty("margin-left", "auto", "important");
    body.style.setProperty("margin-right", "auto", "important");
    body.style.setProperty("box-shadow", "0 0 40px rgba(0, 0, 0, 0.5)", "important");
    // Makes body the containing block for position:fixed descendants so they resize/center too.
    body.style.setProperty("will-change", "transform", "important");
    positionHandles();
    if (window.__responsiveViewer) window.__responsiveViewer.width = currentWidth;
  }

  function positionHandles() {
    // Measure the real rendered box instead of assuming symmetric centering math.
    const rect = body.getBoundingClientRect();
    leftHandle.style.left = rect.left - HANDLE_WIDTH + "px";
    rightHandle.style.left = rect.right + "px";
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
    document.documentElement.appendChild(handle);
    return handle;
  }

  const leftHandle = makeHandle("left");
  const rightHandle = makeHandle("right");

  function startDrag(side) {
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
    leftHandle.remove();
    rightHandle.remove();
    window.removeEventListener("resize", onResize);
    if (originalHtmlStyle === null) {
      html.removeAttribute("style");
    } else {
      html.setAttribute("style", originalHtmlStyle);
    }
    if (originalBodyStyle === null) {
      body.removeAttribute("style");
    } else {
      body.setAttribute("style", originalBodyStyle);
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
  const state = await run("query");
  const list = document.getElementById("presets");
  const offBtn = document.getElementById("off-btn");
  const buttons = new Map();

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
      render(await run("setWidth", preset));
    });
    li.appendChild(btn);
    list.appendChild(li);
    buttons.set(preset, btn);
  });

  offBtn.addEventListener("click", async () => {
    render(await run("disable"));
  });

  render(state);
}

init();
