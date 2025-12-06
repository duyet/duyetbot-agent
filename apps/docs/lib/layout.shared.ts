import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: { title: 'Duyetbot Agent' },
    links: [
      { text: 'Docs', url: '/docs' },
      {
        text: 'GitHub',
        url: 'https://github.com/duyet/duyetbot-agent',
        external: true,
      },
    ],
  };
}
