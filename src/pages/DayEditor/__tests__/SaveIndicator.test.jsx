import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SaveIndicator from '../SaveIndicator';

// SaveIndicator takes the WHOLE workspace persistence slice and derives its display state
// internally (the field mapping lives in one place). These tests drive it through that single
// `persistence` prop, mirroring what both call sites pass.
describe('SaveIndicator', () => {
  describe('persistence disabled', () => {
    it('never claims "Saved" when disabled, even with a lastSaved timestamp', () => {
      render(
        <SaveIndicator
          persistence={{
            enabled: false,
            lastSaved: new Date().toISOString(),
            saveError: null,
            hasPendingWrite: false,
          }}
        />,
      );

      // The success text is "Saved <time>"; the disabled text is "Not saved (in memory)".
      expect(screen.queryByText(/^Saved /)).not.toBeInTheDocument();
      expect(screen.getByText(/Not saved \(in memory\)/i)).toBeInTheDocument();
    });

    it('uses a polite status role when disabled', () => {
      const { container } = render(
        <SaveIndicator persistence={{ enabled: false }} />,
      );
      const status = container.querySelector('[role="status"]');
      expect(status).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('persistence enabled', () => {
    it('renders nothing before any write', () => {
      const { container } = render(
        <SaveIndicator
          persistence={{
            enabled: true,
            lastSaved: null,
            saveError: null,
            hasPendingWrite: false,
          }}
        />,
      );
      expect(container.firstChild).toBeNull();
    });

    it('shows "Saving…" while a write is pending', () => {
      render(
        <SaveIndicator
          persistence={{ enabled: true, lastSaved: null, saveError: null, hasPendingWrite: true }}
        />,
      );
      expect(screen.getByText(/Saving/i)).toBeInTheDocument();
    });

    it('shows "Saved …" after a confirmed write', () => {
      render(
        <SaveIndicator
          persistence={{
            enabled: true,
            lastSaved: new Date(Date.now() - 5000).toISOString(),
            saveError: null,
            hasPendingWrite: false,
          }}
        />,
      );
      expect(screen.getByText(/Saved/i)).toBeInTheDocument();
    });

    it('shows the error message when a write fails', () => {
      render(
        <SaveIndicator
          persistence={{ enabled: true, lastSaved: null, saveError: 'Could not save workspace: quota' }}
        />,
      );
      expect(screen.getByText(/Could not save workspace/i)).toBeInTheDocument();
    });

    it('uses assertive ARIA for errors and polite ARIA for success', () => {
      const { container: errContainer } = render(
        <SaveIndicator persistence={{ enabled: true, saveError: 'Network error' }} />,
      );
      const alert = errContainer.querySelector('[role="alert"]');
      expect(alert).toHaveAttribute('aria-live', 'assertive');

      const { container: okContainer } = render(
        <SaveIndicator persistence={{ enabled: true, lastSaved: new Date().toISOString() }} />,
      );
      const status = okContainer.querySelector('[role="status"]');
      expect(status).toHaveAttribute('aria-live', 'polite');
    });

    it('error takes precedence over a lastSaved timestamp', () => {
      render(
        <SaveIndicator
          persistence={{
            enabled: true,
            lastSaved: new Date().toISOString(),
            saveError: 'Error occurred',
            hasPendingWrite: false,
          }}
        />,
      );
      expect(screen.getByText(/Error occurred/i)).toBeInTheDocument();
      expect(screen.queryByText(/^Saved/i)).not.toBeInTheDocument();
    });
  });
});
