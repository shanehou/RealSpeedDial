import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from './SearchBar';
import type { SpeedDialBookmark } from '@/types';

const results: SpeedDialBookmark[] = [
  { kind: 'bookmark', id: 'b', title: 'GitHub', url: 'https://github.com', index: 0 },
];

describe('SearchBar', () => {
  it('calls onQueryChange while typing', async () => {
    // 受控输入 value 固定为 ""，每次按键后被重置，故逐字符断言（typing 触发回调）
    const onQueryChange = vi.fn();
    render(<SearchBar query="" results={[]} onQueryChange={onQueryChange} onSubmit={() => {}} onPick={() => {}} />);
    await userEvent.type(screen.getByRole('searchbox'), 'g');
    expect(onQueryChange).toHaveBeenCalledWith('g');
  });
  it('shows results and picks one', async () => {
    const onPick = vi.fn();
    render(<SearchBar query="gi" results={results} onQueryChange={() => {}} onSubmit={() => {}} onPick={onPick} />);
    await userEvent.click(screen.getByText('GitHub'));
    expect(onPick).toHaveBeenCalledWith('https://github.com');
  });
  it('submits on Enter', async () => {
    const onSubmit = vi.fn();
    render(<SearchBar query="hello" results={[]} onQueryChange={() => {}} onSubmit={onSubmit} onPick={() => {}} />);
    await userEvent.type(screen.getByRole('searchbox'), '{Enter}');
    expect(onSubmit).toHaveBeenCalledWith('hello');
  });
});
