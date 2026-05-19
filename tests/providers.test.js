import { describe, it, expect } from 'vitest';
import { PROVIDERS, PROVIDER_ORDER, PROVIDER_LOGOS, resolvePath } from '../lib/providers.js';

describe('PROVIDERS config', () => {
  it('has all 7 providers', () => {
    expect(Object.keys(PROVIDERS)).toHaveLength(7);
  });

  it('PROVIDER_ORDER contains all provider ids', () => {
    expect(PROVIDER_ORDER).toEqual(expect.arrayContaining(Object.keys(PROVIDERS)));
    expect(PROVIDER_ORDER).toHaveLength(7);
  });

  it('custom is last in PROVIDER_ORDER', () => {
    expect(PROVIDER_ORDER[PROVIDER_ORDER.length - 1]).toBe('custom');
  });

  it.each(Object.entries(PROVIDERS).filter(([id]) => id !== 'custom'))(
    'built-in provider "%s" has required fields',
    (id, p) => {
      expect(p.id).toBe(id);
      expect(p.name).toBeTruthy();
      expect(p.endpoint).toMatch(/^https:\/\//);
      expect(p.model).toBeTruthy();
      expect(p.responsePath).toBeTruthy();
      expect(p.authStyle).toMatch(/^(bearer|x-api-key|url-param)$/);
      expect(p.requestFormat).toMatch(/^(anthropic|openai|gemini|cohere)$/);
    }
  );

  it('anthropic has required extra headers', () => {
    const p = PROVIDERS.anthropic;
    expect(p.extraHeaders['anthropic-version']).toBeTruthy();
    expect(p.extraHeaders['anthropic-dangerous-direct-browser-access']).toBe('true');
  });

  it('openai has response_format extra body', () => {
    const p = PROVIDERS.openai;
    expect(p.extraBody.response_format.type).toBe('json_object');
  });

  it('gemini uses url-param auth', () => {
    expect(PROVIDERS.gemini.authStyle).toBe('url-param');
  });

  it('custom provider has id and name but no endpoint or model', () => {
    const p = PROVIDERS.custom;
    expect(p.id).toBe('custom');
    expect(p.name).toBeTruthy();
    expect(p.endpoint).toBeUndefined();
    expect(p.model).toBeUndefined();
  });
});

describe('PROVIDER_LOGOS', () => {
  it('has a logo SVG for every provider id', () => {
    for (const id of PROVIDER_ORDER) {
      expect(PROVIDER_LOGOS[id]).toBeTruthy();
      expect(PROVIDER_LOGOS[id]).toContain('<svg');
    }
  });
});

describe('resolvePath', () => {
  const obj = {
    choices: [{ message: { content: 'hello' } }],
    content: [{ text: 'world' }],
    message: { content: [{ text: 'cohere-text' }] },
    candidates: [{ content: { parts: [{ text: 'gemini-text' }] } }],
    simple: 'value'
  };

  it('resolves simple key', () => {
    expect(resolvePath(obj, 'simple')).toBe('value');
  });

  it('resolves openai path: choices[0].message.content', () => {
    expect(resolvePath(obj, 'choices[0].message.content')).toBe('hello');
  });

  it('resolves anthropic path: content[0].text', () => {
    expect(resolvePath(obj, 'content[0].text')).toBe('world');
  });

  it('resolves cohere path: message.content[0].text', () => {
    expect(resolvePath(obj, 'message.content[0].text')).toBe('cohere-text');
  });

  it('resolves gemini path: candidates[0].content.parts[0].text', () => {
    expect(resolvePath(obj, 'candidates[0].content.parts[0].text')).toBe('gemini-text');
  });

  it('returns undefined for missing path', () => {
    expect(resolvePath(obj, 'nonexistent.path')).toBeUndefined();
  });

  it('returns undefined for out-of-bounds index', () => {
    expect(resolvePath(obj, 'choices[99].message.content')).toBeUndefined();
  });

  it('returns undefined when obj is null', () => {
    expect(resolvePath(null, 'choices[0].message.content')).toBeUndefined();
  });

  it('handles numeric-only key in object', () => {
    const o = { data: { 0: 'zero' } };
    expect(resolvePath(o, 'data[0]')).toBe('zero');
  });
});
