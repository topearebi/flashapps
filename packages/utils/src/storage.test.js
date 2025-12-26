import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getStoredKey, setStoredKey } from './storage';

describe('Storage Utils', () => {
    beforeEach(() => {
        // Mock local storage access
        global.localStorage = {
            getItem: vi.fn(),
            setItem: vi.fn(),
        };
    });

    it('sets stored key correctly', () => {
        setStoredKey('test-provider', '12345');
        expect(localStorage.setItem).toHaveBeenCalledWith('tope_ai_key_test-provider', '12345');
    });

    it('gets stored key correctly', () => {
        vi.mocked(localStorage.getItem).mockReturnValue('12345');
        const result = getStoredKey('test-provider');
        expect(localStorage.getItem).toHaveBeenCalledWith('tope_ai_key_test-provider');
        expect(result).toBe('12345');
    });
});
