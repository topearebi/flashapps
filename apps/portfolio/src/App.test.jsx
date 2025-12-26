import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('Portfolio App', () => {
    it('renders the main heading', () => {
        render(<App />);
        expect(screen.getByText(/AI-Powered Prototypes/i)).toBeInTheDocument();
    });
});
