import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import RootLayout, { metadata } from '../../app/layout';

describe('RootLayout', () => {
  it('exports correct metadata', () => {
    expect(metadata.title).toBe('duyetbot');
    expect(metadata.description).toBe('Documentation for @duyetbot');
  });

  it('renders children with proper HTML structure', () => {
    const testContent = 'Test child content';
    const childElement = createElement('div', {}, testContent);
    const html = renderToString(createElement(RootLayout, null, childElement));

    expect(html).toContain(testContent);
    expect(html).toContain('lang="en"');
    expect(html).toContain('flex flex-col min-h-screen');
  });
});
