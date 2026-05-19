// Keep side panel disabled on icon click — popup handles the flow.
// popup.js calls chrome.sidePanel.open() programmatically after analysis.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ANALYSIS_COMPLETE') {
    chrome.runtime.sendMessage({ type: 'RENDER_RESULTS', payload: message.payload });
  }
  if (message.type === 'ANALYSIS_ERROR') {
    chrome.runtime.sendMessage({ type: 'SHOW_ERROR', payload: message.payload });
  }
  sendResponse({ ok: true });
  return true;
});
