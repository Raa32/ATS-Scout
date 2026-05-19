// Chrome extension API mock
const sessionStore = {};
const localStore = {};

global.chrome = {
  storage: {
    session: {
      get: vi.fn(async (keys) => {
        if (Array.isArray(keys)) {
          return keys.reduce((acc, k) => { acc[k] = sessionStore[k]; return acc; }, {});
        }
        if (typeof keys === 'string') return { [keys]: sessionStore[keys] };
        return { ...sessionStore };
      }),
      set: vi.fn(async (obj) => { Object.assign(sessionStore, obj); }),
      remove: vi.fn(async (keys) => {
        (Array.isArray(keys) ? keys : [keys]).forEach(k => delete sessionStore[k]);
      }),
      _reset: () => { Object.keys(sessionStore).forEach(k => delete sessionStore[k]); }
    },
    local: {
      get: vi.fn(async (keys) => {
        if (Array.isArray(keys)) {
          return keys.reduce((acc, k) => { acc[k] = localStore[k]; return acc; }, {});
        }
        if (typeof keys === 'string') return { [keys]: localStore[keys] };
        return { ...localStore };
      }),
      set: vi.fn(async (obj) => { Object.assign(localStore, obj); }),
      remove: vi.fn(async (keys) => {
        (Array.isArray(keys) ? keys : [keys]).forEach(k => delete localStore[k]);
      }),
      _reset: () => { Object.keys(localStore).forEach(k => delete localStore[k]); }
    }
  },
  runtime: {
    getURL: vi.fn((path) => `chrome-extension://test-id/${path}`),
    sendMessage: vi.fn()
  }
};

beforeEach(() => {
  chrome.storage.session._reset();
  chrome.storage.local._reset();
  vi.clearAllMocks();
});
