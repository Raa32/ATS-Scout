const HISTORY_KEY = 'ats_scout_history';
const MAX_ENTRIES = 20;

export async function saveAnalysis({ fileName, resumeText, jobDescription, providerId, providerName, result }) {
  const existing = await getHistory();
  const entry = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    fileName,
    resumeText,
    jobDescription,
    providerId,
    providerName,
    result
  };
  const updated = [entry, ...existing].slice(0, MAX_ENTRIES);
  await chrome.storage.local.set({ [HISTORY_KEY]: updated });
  return entry;
}

export async function getHistory() {
  const data = await chrome.storage.local.get(HISTORY_KEY);
  return data[HISTORY_KEY] || [];
}

export async function clearHistory() {
  await chrome.storage.local.remove(HISTORY_KEY);
}

export function timeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
