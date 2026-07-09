import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from './SearchBar';

describe('SearchBar', () => {
  it('calls onQueryChange while typing', async () => {
    // 受控输入 value 固定为 ""，每次按键后被重置，故逐字符断言（typing 触发回调）
    const onQueryChange = vi.fn();
    render(<SearchBar query="" onQueryChange={onQueryChange} onSubmit={() => {}} />);
    await userEvent.type(screen.getByRole('searchbox'), 'g');
    expect(onQueryChange).toHaveBeenCalledWith('g');
  });
  it('submits on Enter', async () => {
    const onSubmit = vi.fn();
    render(<SearchBar query="hello" onQueryChange={() => {}} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByRole('searchbox'), '{Enter}');
    expect(onSubmit).toHaveBeenCalledWith('hello');
  });
});
