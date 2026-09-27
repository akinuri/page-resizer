const MAX_WIDTH = 1920;
const CSS_ID = "responsive-viewer-style";

const activeTabs = new Set();

function buildCss() {
  return `
html {
  background: #2b2b2b !important;
}
body {
  max-width: ${MAX_WIDTH}px !important;
  margin-left: auto !important;
  margin-right: auto !important;
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.5);
}
`;
}

async function enable(tabId) {
  await chrome.scripting.insertCSS({
    target: { tabId },
    css: buildCss(),
  });
  activeTabs.add(tabId);
}

async function disable(tabId) {
  await chrome.scripting.removeCSS({
    target: { tabId },
    css: buildCss(),
  });
  activeTabs.delete(tabId);
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    if (activeTabs.has(tab.id)) {
      await disable(tab.id);
    } else {
      await enable(tab.id);
    }
  } catch (err) {
    console.error("Responsive Viewer failed:", err);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  activeTabs.delete(tabId);
});
