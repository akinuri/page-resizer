const DEFAULT_WIDTH = 1920;

const activeTabs = new Set();

// Runs inside the page. Must be self-contained (no outer closure references).
function toggleResponsiveViewer(defaultWidth) {
  const MIN_WIDTH = 320;
  const HANDLE_WIDTH = 8;

  if (window.__responsiveViewer) {
    window.__responsiveViewer.cleanup();
    delete window.__responsiveViewer;
    return;
  }

  const html = document.documentElement;
  const body = document.body;
  const originalHtmlStyle = html.getAttribute("style");
  const originalBodyStyle = body.getAttribute("style");
  const getViewportWidth = () => html.clientWidth;
  let width = Math.min(defaultWidth, getViewportWidth() - HANDLE_WIDTH * 4);

  function applyWidth() {
    html.style.setProperty(
      "background",
      "repeating-conic-gradient(#333 0% 25%, #3a3a3a 0% 50%) 0 0 / 24px 24px",
      "important"
    );
    body.style.setProperty("max-width", width + "px", "important");
    body.style.setProperty("width", width + "px", "important");
    body.style.setProperty("margin-left", "auto", "important");
    body.style.setProperty("margin-right", "auto", "important");
    body.style.setProperty("box-shadow", "0 0 40px rgba(0, 0, 0, 0.5)", "important");
    // Makes body the containing block for position:fixed descendants so they resize/center too.
    body.style.setProperty("will-change", "transform", "important");
    positionHandles();
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
      width = Math.max(
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
    width = Math.min(width, getViewportWidth() - HANDLE_WIDTH * 2);
    applyWidth();
  }
  window.addEventListener("resize", onResize);

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

  applyWidth();
  window.__responsiveViewer = { cleanup };
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: toggleResponsiveViewer,
      args: [DEFAULT_WIDTH],
    });
  } catch (err) {
    console.error("Responsive Viewer failed:", err);
  }
});
