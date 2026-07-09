import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { installChromeMock } from '../../../tests/setup';
import { useSettings } from './useSettings';

beforeEach(() => { installChromeMock(); });

describe('useSettings', () => {
  it('loads defaults then updates', async () => {
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.settings).toBeTruthy());
    expect(result.current.settings!.columns).toBe(6);
    await act(async () => { await result.current.update({ columns: 9 }); });
    await waitFor(() => expect(result.current.settings!.columns).toBe(9));
  });
});
