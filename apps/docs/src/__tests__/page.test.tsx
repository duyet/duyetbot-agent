import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Page from '../../app/page';

describe('HomePage', () => {
  it('renders without crashing', () => {
    // Use server-side rendering to avoid jsdom issues
    const html = renderToString(createElement(Page));
    expect(html).toContain('Duyetbot Agent');
    expect(html).toContain('Get Started');
    expect(html).toContain('Quick Start');
    expect(html).toContain('Architecture');
  });
});
