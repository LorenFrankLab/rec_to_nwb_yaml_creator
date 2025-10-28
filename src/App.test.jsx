import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StoreProvider } from './state/StoreContext';
import App from './App';

describe('App', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <StoreProvider>
        <App />
      </StoreProvider>
    );
    expect(container).toBeTruthy();
  });
});
