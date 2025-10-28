/**
 * @file Tests for CalendarDayCreator component
 *
 * Tests calendar-based day creation UI for M5.5.4
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalendarDayCreator } from '../CalendarDayCreator';

describe('CalendarDayCreator Component', () => {
  const defaultProps = {
    animalId: 'testanimal',
    existingDays: [],
    onCreateDays: vi.fn(),
    onClose: vi.fn(),
  };

  describe('Initial Rendering', () => {
    it('renders calendar with header', () => {
      render(<CalendarDayCreator {...defaultProps} />);

      expect(screen.getByText(/recording days calendar/i)).toBeInTheDocument();
    });

    it('displays current month and year', () => {
      render(<CalendarDayCreator {...defaultProps} />);

      const today = new Date();
      const monthName = today.toLocaleDateString('en-US', { month: 'long' });
      const year = today.getFullYear();

      expect(screen.getByText(new RegExp(`${monthName} ${year}`, 'i'))).toBeInTheDocument();
    });

    it('renders weekday headers', () => {
      render(<CalendarDayCreator {...defaultProps} />);

      expect(screen.getByText('Sun')).toBeInTheDocument();
      expect(screen.getByText('Mon')).toBeInTheDocument();
      expect(screen.getByText('Tue')).toBeInTheDocument();
      expect(screen.getByText('Wed')).toBeInTheDocument();
      expect(screen.getByText('Thu')).toBeInTheDocument();
      expect(screen.getByText('Fri')).toBeInTheDocument();
      expect(screen.getByText('Sat')).toBeInTheDocument();
    });

    it('renders legend', () => {
      render(<CalendarDayCreator {...defaultProps} />);

      expect(screen.getByText(/legend/i)).toBeInTheDocument();
      expect(screen.getByText(/existing recording/i)).toBeInTheDocument();
      expect(screen.getByText(/available/i)).toBeInTheDocument();
      // Note: "selected" and "today" appear in multiple places, so we check for legend region
      const legend = screen.getByRole('region', { name: /calendar legend/i });
      expect(legend).toBeInTheDocument();
    });

    it('renders action buttons', () => {
      render(<CalendarDayCreator {...defaultProps} />);

      expect(screen.getByRole('button', { name: /clear selection/i })).toBeInTheDocument();
      // The create button aria-label says "Create N recording days"
      expect(screen.getByRole('button', { name: /create 0 recording days/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /close calendar/i })).toBeInTheDocument();
    });

    it('disables create button when no dates selected', () => {
      render(<CalendarDayCreator {...defaultProps} />);

      const createButton = screen.getByRole('button', { name: /create 0 recording days/i });
      expect(createButton).toBeDisabled();
    });
  });

  describe('Month Navigation', () => {
    it('navigates to previous month', async () => {
      const user = userEvent.setup();
      render(<CalendarDayCreator {...defaultProps} />);

      const prevButton = screen.getByRole('button', { name: /previous month/i });
      await user.click(prevButton);

      // Check that month changed (either previous month or December of previous year)
      const today = new Date();
      const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1);
      const monthName = prevMonth.toLocaleDateString('en-US', { month: 'long' });
      const year = prevMonth.getFullYear();

      expect(screen.getByText(new RegExp(`${monthName} ${year}`, 'i'))).toBeInTheDocument();
    });

    it('navigates to next month', async () => {
      const user = userEvent.setup();
      render(<CalendarDayCreator {...defaultProps} />);

      const nextButton = screen.getByRole('button', { name: /next month/i });
      await user.click(nextButton);

      // Check that month changed (either next month or January of next year)
      const today = new Date();
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1);
      const monthName = nextMonth.toLocaleDateString('en-US', { month: 'long' });
      const year = nextMonth.getFullYear();

      expect(screen.getByText(new RegExp(`${monthName} ${year}`, 'i'))).toBeInTheDocument();
    });

    it('jumps to current month with Today button', async () => {
      const user = userEvent.setup();
      render(<CalendarDayCreator {...defaultProps} />);

      // Navigate away from current month
      const prevButton = screen.getByRole('button', { name: /previous month/i });
      await user.click(prevButton);
      await user.click(prevButton);

      // Jump back to today
      const todayButton = screen.getByRole('button', { name: /today/i });
      await user.click(todayButton);

      // Verify current month is displayed
      const today = new Date();
      const monthName = today.toLocaleDateString('en-US', { month: 'long' });
      const year = today.getFullYear();

      expect(screen.getByText(new RegExp(`${monthName} ${year}`, 'i'))).toBeInTheDocument();
    });
  });

  describe('Date Selection', () => {
    it('selects a single date on click', async () => {
      const user = userEvent.setup();
      render(<CalendarDayCreator {...defaultProps} />);

      // Find today's date button by its aria-label (most reliable)
      const dateButtons = screen.getAllByRole('gridcell');
      const todayButton = dateButtons.find((btn) => {
        const ariaLabel = btn.getAttribute('aria-label');
        return ariaLabel && ariaLabel.includes('(today)') && !btn.disabled;
      });

      if (todayButton) {
        await user.click(todayButton);

        // Verify selection count updated
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /create 1 recording day/i })).toBeInTheDocument();
        });

        // Verify button is enabled
        const createButton = screen.getByRole('button', { name: /create 1 recording day/i });
        expect(createButton).not.toBeDisabled();
      }
    });

    it('prevents selecting existing days', async () => {
      const user = userEvent.setup();
      const existingDate = new Date().toISOString().split('T')[0];

      render(
        <CalendarDayCreator
          {...defaultProps}
          existingDays={[existingDate]}
        />
      );

      // Find today's date button by looking for the "(today)" text in aria-label
      const dateButtons = screen.getAllByRole('gridcell');
      const todayButton = dateButtons.find((btn) => {
        const ariaLabel = btn.getAttribute('aria-label');
        return ariaLabel && ariaLabel.includes('(today)');
      });

      if (todayButton) {
        // Should be disabled
        expect(todayButton).toBeDisabled();

        // Try to click (should not work)
        await user.click(todayButton);

        // Verify no selection
        expect(screen.getByRole('button', { name: /create 0 recording days/i })).toBeDisabled();
      }
    });

    it('clears selection', async () => {
      const user = userEvent.setup();
      render(<CalendarDayCreator {...defaultProps} />);

      // Select a date
      const dateButtons = screen.getAllByRole('gridcell');
      const todayButton = dateButtons.find((btn) => {
        const ariaLabel = btn.getAttribute('aria-label');
        return ariaLabel && ariaLabel.includes('(today)') && !btn.disabled;
      });

      if (todayButton) {
        await user.click(todayButton);

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /create 1 recording day/i })).toBeInTheDocument();
        });

        // Clear selection
        const clearButton = screen.getByRole('button', { name: /clear selection/i });
        await user.click(clearButton);

        // Verify selection cleared
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /create 0 recording days/i })).toBeDisabled();
        });
      }
    });

    it('supports multi-select by clicking multiple dates', async () => {
      const user = userEvent.setup();
      render(<CalendarDayCreator {...defaultProps} />);

      const dateButtons = screen.getAllByRole('gridcell');
      const availableButtons = dateButtons.filter((btn) => !btn.disabled);

      // Click three different dates
      if (availableButtons.length >= 3) {
        await user.click(availableButtons[0]);
        await user.click(availableButtons[1]);
        await user.click(availableButtons[2]);

        // Verify 3 days selected
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /create 3 recording days/i })).toBeInTheDocument();
        });
      }
    });

    it('deselects a date when clicked again', async () => {
      const user = userEvent.setup();
      render(<CalendarDayCreator {...defaultProps} />);

      const dateButtons = screen.getAllByRole('gridcell');
      const todayButton = dateButtons.find((btn) => {
        const ariaLabel = btn.getAttribute('aria-label');
        return ariaLabel && ariaLabel.includes('(today)') && !btn.disabled;
      });

      if (todayButton) {
        // Click to select
        await user.click(todayButton);
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /create 1 recording day/i })).toBeInTheDocument();
        });

        // Click again to deselect
        await user.click(todayButton);
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /create 0 recording days/i })).toBeDisabled();
        });
      }
    });
  });

  describe('Day Creation', () => {
    it('calls onCreateDays with selected dates', async () => {
      const user = userEvent.setup();
      const onCreateDays = vi.fn().mockResolvedValue(undefined);

      render(
        <CalendarDayCreator
          {...defaultProps}
          onCreateDays={onCreateDays}
        />
      );

      // Select a date
      const dateButtons = screen.getAllByRole('gridcell');
      const todayButton = dateButtons.find((btn) => {
        const ariaLabel = btn.getAttribute('aria-label');
        return ariaLabel && ariaLabel.includes('(today)') && !btn.disabled;
      });

      if (todayButton) {
        await user.click(todayButton);

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /create 1 recording day/i })).not.toBeDisabled();
        });

        // Click create button
        const createButton = screen.getByRole('button', { name: /create 1 recording day/i });
        await user.click(createButton);

        // Verify callback was called
        await waitFor(() => {
          expect(onCreateDays).toHaveBeenCalledTimes(1);
          expect(onCreateDays).toHaveBeenCalledWith(expect.arrayContaining([expect.any(String)]));
        });
      }
    });

    it('closes calendar after successful creation', async () => {
      const user = userEvent.setup();
      const onCreateDays = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();

      render(
        <CalendarDayCreator
          {...defaultProps}
          onCreateDays={onCreateDays}
          onClose={onClose}
        />
      );

      // Select a date
      const dateButtons = screen.getAllByRole('gridcell');
      const todayButton = dateButtons.find((btn) => {
        const ariaLabel = btn.getAttribute('aria-label');
        return ariaLabel && ariaLabel.includes('(today)') && !btn.disabled;
      });

      if (todayButton) {
        await user.click(todayButton);

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /create 1 recording day/i })).not.toBeDisabled();
        });

        // Click create button
        const createButton = screen.getByRole('button', { name: /create 1 recording day/i });
        await user.click(createButton);

        // Verify onClose was called
        await waitFor(() => {
          expect(onClose).toHaveBeenCalledTimes(1);
        });
      }
    });

    it('handles creation errors', async () => {
      const user = userEvent.setup();
      const onCreateDays = vi.fn().mockRejectedValue(new Error('Creation failed'));
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      render(
        <CalendarDayCreator
          {...defaultProps}
          onCreateDays={onCreateDays}
        />
      );

      // Select a date
      const dateButtons = screen.getAllByRole('gridcell');
      const todayButton = dateButtons.find((btn) => {
        const ariaLabel = btn.getAttribute('aria-label');
        return ariaLabel && ariaLabel.includes('(today)') && !btn.disabled;
      });

      if (todayButton) {
        await user.click(todayButton);

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /create 1 recording day/i })).not.toBeDisabled();
        });

        // Click create button
        const createButton = screen.getByRole('button', { name: /create 1 recording day/i });
        await user.click(createButton);

        // Verify error alert shown
        await waitFor(() => {
          expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to create days'));
        });
      }

      alertSpy.mockRestore();
    });
  });

  describe('Close Button', () => {
    it('calls onClose when close button clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <CalendarDayCreator
          {...defaultProps}
          onClose={onClose}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close calendar/i });
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not render close button when onClose is null', () => {
      render(
        <CalendarDayCreator
          {...defaultProps}
          onClose={null}
        />
      );

      expect(screen.queryByRole('button', { name: /close calendar/i })).not.toBeInTheDocument();
    });
  });
});
