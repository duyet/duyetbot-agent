import { describe, expect, it } from 'vitest';
import { metadata } from '../../app/layout';

describe('RootLayout', () => {
  it('exports correct metadata', () => {
    expect(metadata.title).toBe('Duyetbot Agent');
    expect(metadata.description).toBe('Documentation for the duyetbot-agent project');
  });
});
