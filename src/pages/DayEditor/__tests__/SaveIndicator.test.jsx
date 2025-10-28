import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import SaveIndicator from '../SaveIndicator';

describe('SaveIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows nothing when no save occurred', () => {
    const { container } = render(<SaveIndicator lastSaved={null} error={null} />);

    expect(container.firstChild).toBeNull();
  });

  it('shows "Saving..." immediately after save', () => {
    const timestamp = new Date().toISOString();
    render(<SaveIndicator lastSaved={timestamp} error={null} />);

    expect(screen.getByText(/Saving/i)).toBeInTheDocument();
  });

  it('transitions to "Saved" after 500ms', async () => {
    const timestamp = new Date().toISOString();
    render(<SaveIndicator lastSaved={timestamp} error={null} />);

    // Initially shows "Saving..."
    expect(screen.getByText(/Saving/i)).toBeInTheDocument();

    // Fast forward 500ms
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Should now show "Saved"
    expect(screen.getByText(/Saved/i)).toBeInTheDocument();
  });

  it('formats time ago correctly for recent saves', async () => {
    const timestamp = new Date(Date.now() - 5000).toISOString(); // 5 seconds ago
    render(<SaveIndicator lastSaved={timestamp} error={null} />);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByText(/Saved/i)).toBeInTheDocument();
  });

  it('shows error message when save fails', () => {
    render(<SaveIndicator lastSaved={null} error="Failed to save changes" />);

    expect(screen.getByText(/Failed to save changes/i)).toBeInTheDocument();
  });

  it('uses assertive ARIA for errors', () => {
    const { container } = render(
      <SaveIndicator lastSaved={null} error="Network error" />
    );

    const errorElement = container.querySelector('[role="alert"]');
    expect(errorElement).toBeInTheDocument();
    expect(errorElement).toHaveAttribute('aria-live', 'assertive');
  });

  it('uses polite ARIA for success states', async () => {
    const timestamp = new Date().toISOString();
    const { container } = render(<SaveIndicator lastSaved={timestamp} error={null} />);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    const statusElement = container.querySelector('[role="status"]');
    expect(statusElement).toHaveAttribute('aria-live', 'polite');
  });

  it('clears previous save status when new save occurs', async () => {
    const { rerender } = render(
      <SaveIndicator lastSaved={new Date().toISOString()} error={null} />
    );

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByText(/Saved/i)).toBeInTheDocument();

    // New save
    rerender(<SaveIndicator lastSaved={new Date().toISOString()} error={null} />);

    // Should go back to "Saving..."
    expect(screen.getByText(/Saving/i)).toBeInTheDocument();
  });

  it('error takes precedence over lastSaved', () => {
    const timestamp = new Date().toISOString();
    render(<SaveIndicator lastSaved={timestamp} error="Error occurred" />);

    expect(screen.getByText(/Error occurred/i)).toBeInTheDocument();
    expect(screen.queryByText(/Saved/i)).not.toBeInTheDocument();
  });
});
