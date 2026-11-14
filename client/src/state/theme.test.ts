import { describe, expect, it } from 'vitest';
import { defaultSettings, resolveTheme } from './AppContext';

describe('theme setting', () => {
  it('defaults to Night so the existing look is unchanged', () => {
    expect(defaultSettings.theme).toBe('night');
  });
  it('resolves explicit choices and old saved settings', () => {
    expect(resolveTheme('day')).toBe('day');
    expect(resolveTheme('night')).toBe('night');
    expect(resolveTheme(undefined)).toBe('night'); // settings saved before the theme option existed
  });
});
