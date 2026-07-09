import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabBar } from './TabBar';
import { HOME_TAB_ID } from '@/lib/constants';

const tabs = [
  { id: HOME_TAB_ID, title: '主页', isHome: true },
  { id: 'f1', title: '工作', isHome: false },
];

describe('TabBar', () => {
  it('renders tabs and marks active', () => {
    render(<TabBar tabs={tabs} activeTabId="f1" onSelect={() => {}} />);
    expect(screen.getByRole('tab', { name: '工作' })).toHaveAttribute('aria-selected', 'true');
  });
  it('calls onSelect on click', async () => {
    const onSelect = vi.fn();
    render(<TabBar tabs={tabs} activeTabId="f1" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('tab', { name: '主页' }));
    expect(onSelect).toHaveBeenCalledWith(HOME_TAB_ID);
  });
  it('renders nothing when only Home tab', () => {
    const { container } = render(
      <TabBar tabs={[{ id: HOME_TAB_ID, title: '主页', isHome: true }]} activeTabId={HOME_TAB_ID} onSelect={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
