import { describe, expect, it } from 'vitest';
import { checkBindings, listPluginIds, type ShipPlugin } from './index';

const sample = {
  id: 'example',
  version: '0.0.0',
  requiredBindings: ['DB'],
} as const satisfies ShipPlugin;

describe('plugin contract', () => {
  it('lists enabled plugin ids', () => {
    expect(listPluginIds([sample])).toEqual(['example']);
    expect(listPluginIds([])).toEqual([]);
  });

  it('reports bindings that are missing or empty', () => {
    expect(checkBindings([sample], {})).toEqual(['example:DB']);
    expect(checkBindings([sample], { DB: null })).toEqual(['example:DB']);
    expect(checkBindings([sample], { DB: { prepare: true } })).toEqual([]);
  });
});
