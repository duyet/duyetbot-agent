import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Page from '../../app/page';

describe('HomePage', () => {
  it('renders without crashing', () => {
    // Use server-side rendering to avoid jsdom issues
    const html = renderToString(createElement(Page));
    // Check for architecture section content
    expect(html).toContain('Router Agent');
    expect(html).toContain('System Architecture');
  });
});
