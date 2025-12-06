import { describe, expect, it } from 'vitest';
import { baseOptions } from '../../lib/layout.shared';

describe('baseOptions', () => {
  it('returns correct nav configuration', () => {
    const options = baseOptions();

    expect(options.nav).toEqual({ title: 'Duyetbot Agent' });
  });

  it('returns correct links configuration', () => {
    const options = baseOptions();

    expect(options.links).toHaveLength(2);
    expect(options.links).toContainEqual({ text: 'Docs', url: '/docs' });
    expect(options.links).toContainEqual({
      text: 'GitHub',
      url: 'https://github.com/duyet/duyetbot-agent',
      external: true,
    });
  });
});
