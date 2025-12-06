import { describe, expect, it } from 'vitest';
import { metadata } from '../../app/layout';

describe('RootLayout', () => {
  it('exports correct metadata', () => {
    expect(metadata.title).toBe('duyetbot');
    expect(metadata.description).toBe('Documentation for @duyetbot');
  });
});
