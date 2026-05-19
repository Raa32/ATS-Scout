export const PROVIDERS = {
  anthropic: {
    id: 'anthropic',
    name: 'Claude (Anthropic)',
    logo: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    endpoint: 'https://api.anthropic.com/v1/messages',
    authStyle: 'x-api-key',
    requestFormat: 'anthropic',
    responsePath: 'content[0].text',
    extraHeaders: {
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    keyHint: 'Starts with sk-ant-...',
    keyUrl: 'https://console.anthropic.com/',
    keyInstructions: '1. Go to console.anthropic.com\n2. Sign in or create account\n3. Go to API Keys\n4. Click Create Key',
    temperature: 0.35,
    maxTokens: 4096
  },
  openai: {
    id: 'openai',
    name: 'OpenAI (GPT-4o mini)',
    logo: 'openai',
    model: 'gpt-4o-mini',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    authStyle: 'bearer',
    requestFormat: 'openai',
    responsePath: 'choices[0].message.content',
    extraBody: { response_format: { type: 'json_object' } },
    keyHint: 'Starts with sk-...',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyInstructions: '1. Go to platform.openai.com/api-keys\n2. Click Create new secret key\n3. Ensure you have billing credits',
    temperature: 0.35,
    maxTokens: 4096
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    logo: 'gemini',
    model: 'gemini-2.0-flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    authStyle: 'url-param',
    requestFormat: 'gemini',
    responsePath: 'candidates[0].content.parts[0].text',
    extraBody: { generationConfig: { responseMimeType: 'application/json', temperature: 0.35 } },
    keyHint: 'Starts with AIza...',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyInstructions: '1. Go to aistudio.google.com/apikey\n2. Sign in with Google account\n3. Click Create API key (FREE tier available)',
    temperature: 0.35,
    maxTokens: 4096
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral AI',
    logo: 'mistral',
    model: 'mistral-small-latest',
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    authStyle: 'bearer',
    requestFormat: 'openai',
    responsePath: 'choices[0].message.content',
    keyHint: 'Your Mistral API key',
    keyUrl: 'https://console.mistral.ai/api-keys',
    keyInstructions: '1. Go to console.mistral.ai\n2. Navigate to API Keys\n3. Click Create new key',
    temperature: 0.35,
    maxTokens: 4096
  },
  groq: {
    id: 'groq',
    name: 'Groq (Llama 3.3)',
    logo: 'groq',
    model: 'llama-3.3-70b-versatile',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    authStyle: 'bearer',
    requestFormat: 'openai',
    responsePath: 'choices[0].message.content',
    keyHint: 'Starts with gsk_...',
    keyUrl: 'https://console.groq.com/keys',
    keyInstructions: '1. Go to console.groq.com\n2. Go to API Keys\n3. Click Create API key (FREE tier available)',
    temperature: 0.35,
    maxTokens: 4096
  },
  cohere: {
    id: 'cohere',
    name: 'Cohere',
    logo: 'cohere',
    model: 'command-r-plus-08-2024',
    endpoint: 'https://api.cohere.com/v2/chat',
    authStyle: 'bearer',
    requestFormat: 'cohere',
    responsePath: 'message.content[0].text',
    keyHint: 'Your Cohere API key',
    keyUrl: 'https://dashboard.cohere.com/api-keys',
    keyInstructions: '1. Go to dashboard.cohere.com\n2. Navigate to API Keys\n3. Create a key (trial tier available)',
    temperature: 0.35,
    maxTokens: 4096
  },
  custom: {
    id: 'custom',
    name: 'Custom / Other',
    logo: 'custom',
    keyHint: 'Your API key for the custom provider',
    keyUrl: null,
    keyInstructions: 'Enter your endpoint URL, auth style, model, and response path below.'
  }
};

export const PROVIDER_ORDER = ['anthropic', 'openai', 'gemini', 'groq', 'mistral', 'cohere', 'custom'];

export function resolvePath(obj, path) {
  return path.split(/\.|\[(\d+)\]/).filter(Boolean).reduce((acc, key) => {
    if (acc == null) return undefined;
    return acc[isNaN(key) ? key : parseInt(key)];
  }, obj);
}

export const PROVIDER_LOGOS = {
  anthropic: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 1L14 14H2L8 1Z" fill="#f59e0b"/><path d="M8 5L11 12H5L8 5Z" fill="#0a0a0f"/></svg>`,
  openai: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="6" stroke="#10b981" stroke-width="1.5" fill="none"/><path d="M5 8h6M8 5v6" stroke="#10b981" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  gemini: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 2C8 2 10 6 14 8C10 10 8 14 8 14C8 14 6 10 2 8C6 6 8 2 8 2Z" fill="#4285f4"/></svg>`,
  groq: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="12" height="12" rx="2" fill="#f55036"/><path d="M5 8h4M7 6v4" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  mistral: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 4h3v3H2zM2 9h3v3H2zM6.5 4h3v3h-3zM11 4h3v3h-3zM11 9h3v3h-3z" fill="#ff7000"/></svg>`,
  cohere: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="5" fill="none" stroke="#39d353" stroke-width="1.5"/><circle cx="8" cy="8" r="2" fill="#39d353"/></svg>`,
  custom: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="6" stroke="#6b7280" stroke-width="1.5" fill="none" stroke-dasharray="3 2"/><path d="M8 5v3l2 2" stroke="#6b7280" stroke-width="1.5" stroke-linecap="round"/></svg>`
};
