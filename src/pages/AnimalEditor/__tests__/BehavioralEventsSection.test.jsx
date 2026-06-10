/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BehavioralEventsSection from '../BehavioralEventsSection';

/**
 * Tests for BehavioralEventsSection component (M8a Task 4)
 *
 * Table view of behavioral events (DIO channels) with inline editing.
 * Tests cover rendering, CRUD operations, validation, and accessibility.
 */

describe('BehavioralEventsSection', () => {
  let user;

  const mockAnimal = {
    id: 'remy',
    behavioral_events: [
      {
        name: 'reward_left',
        description: 'Din1',
      },
      {
        name: 'reward_right',
        description: 'Dout2',
      },
    ],
  };

  const mockOnFieldUpdate = vi.fn();

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  describe('Empty State', () => {
    it('should show "Add Behavioral Event" button when no events', () => {
      const emptyAnimal = { id: 'test', behavioral_events: [] };

      render(
        <BehavioralEventsSection
          animal={emptyAnimal}
          onFieldUpdate={mockOnFieldUpdate}
        />
      );

      // Empty state heading
      expect(screen.getByText(/No Behavioral Events/i)).toBeInTheDocument();

      // Getting started message
      expect(screen.getByText(/Behavioral events are DIO/i)).toBeInTheDocument();

      // Add button should be present
      expect(screen.getByRole('button', { name: /Add First Behavioral Event/i })).toBeInTheDocument();
    });

    it.each([
      ['a string', 'corrupt'],
      ['a plain object', {}],
      ['a number', 42],
    ])('renders the empty state instead of throwing when behavioral_events is %s', (_label, corrupt) => {
      const corruptAnimal = { id: 'test', behavioral_events: corrupt };

      expect(() =>
        render(
          <BehavioralEventsSection
            animal={corruptAnimal}
            onFieldUpdate={mockOnFieldUpdate}
          />
        )
      ).not.toThrow();
      expect(screen.getByText(/No Behavioral Events/i)).toBeInTheDocument();
    });
  });

  describe('Table Display', () => {
    it('should display events with name and description columns', () => {
      render(
        <BehavioralEventsSection
          animal={mockAnimal}
          onFieldUpdate={mockOnFieldUpdate}
        />
      );

      // Check table headers
      expect(screen.getByText(/^Name$/i)).toBeInTheDocument();
      expect(screen.getByText(/Description/i)).toBeInTheDocument();

      // Check event data is displayed (descriptions are DIO line names)
      expect(screen.getByText('reward_left')).toBeInTheDocument();
      expect(screen.getByText('Din1')).toBeInTheDocument();
      expect(screen.getByText('reward_right')).toBeInTheDocument();
      expect(screen.getByText('Dout2')).toBeInTheDocument();
    });
  });

  describe('Add Behavioral Event', () => {
    it('should create new event row when add button is clicked', async () => {
      const emptyAnimal = { id: 'test', behavioral_events: [] };

      render(
        <BehavioralEventsSection
          animal={emptyAnimal}
          onFieldUpdate={mockOnFieldUpdate}
        />
      );

      const addButton = screen.getByRole('button', { name: /Add First Behavioral Event/i });
      await user.click(addButton);

      // Should call onFieldUpdate to add new event
      expect(mockOnFieldUpdate).toHaveBeenCalledWith(
        'behavioral_events',
        expect.arrayContaining([
          expect.objectContaining({
            name: '',
            description: '',
          }),
        ])
      );
    });
  });

  describe('Inline Editing', () => {
    it('should allow inline editing of the name and the DIO Type + line index', async () => {
      render(
        <BehavioralEventsSection
          animal={mockAnimal}
          onFieldUpdate={mockOnFieldUpdate}
        />
      );

      // Find edit button for first event
      const editButtons = screen.getAllByRole('button', { name: /Edit/i });
      await user.click(editButtons[0]);

      // Name is a text input; the description is the guided Type + line-index controls,
      // seeded from the stored 'Din1'.
      const nameInput = screen.getByDisplayValue('reward_left');
      expect(nameInput).toBeInTheDocument();
      expect(screen.getByLabelText(/DIO type/i)).toHaveValue('Din');
      expect(screen.getByLabelText(/DIO line index/i)).toHaveValue(1);

      // Type new values
      await user.clear(nameInput);
      await user.type(nameInput, 'reward_center');
      await user.selectOptions(screen.getByLabelText(/DIO type/i), 'Accel');
      const indexInput = screen.getByLabelText(/DIO line index/i);
      await user.clear(indexInput);
      await user.type(indexInput, '5');

      // Find save button
      const saveButton = screen.getByRole('button', { name: /Save/i });
      await user.click(saveButton);

      // Should call onFieldUpdate with the updated name and the rejoined DIO description.
      expect(mockOnFieldUpdate).toHaveBeenCalledWith(
        'behavioral_events',
        expect.arrayContaining([
          expect.objectContaining({
            name: 'reward_center',
            description: 'Accel5',
          }),
        ])
      );
    });
  });

  describe('DIO description: guided Type + line-index entry (F5)', () => {
    const dioAnimal = {
      id: 'remy',
      behavioral_events: [{ name: 'light1', description: 'Din1' }],
    };

    it('seeds the Type and line-index controls from an existing description and writes back the identical string', async () => {
      render(
        <BehavioralEventsSection animal={dioAnimal} onFieldUpdate={mockOnFieldUpdate} />
      );

      await user.click(screen.getByRole('button', { name: /^Edit$/i }));

      // Both controls seed from the stored 'Din1'.
      expect(screen.getByLabelText(/DIO type/i)).toHaveValue('Din');
      expect(screen.getByLabelText(/DIO line index/i)).toHaveValue(1);

      // Saving without touching the controls writes back the identical description string (C1).
      await user.click(screen.getByRole('button', { name: /^Save$/i }));
      expect(mockOnFieldUpdate).toHaveBeenCalledWith('behavioral_events', [
        { name: 'light1', description: 'Din1' },
      ]);
    });

    it('rebuilds the description from the chosen Type and line index', async () => {
      render(
        <BehavioralEventsSection animal={dioAnimal} onFieldUpdate={mockOnFieldUpdate} />
      );

      await user.click(screen.getByRole('button', { name: /^Edit$/i }));

      await user.selectOptions(screen.getByLabelText(/DIO type/i), 'Dout');
      const indexInput = screen.getByLabelText(/DIO line index/i);
      await user.clear(indexInput);
      await user.type(indexInput, '3');

      await user.click(screen.getByRole('button', { name: /^Save$/i }));
      expect(mockOnFieldUpdate).toHaveBeenCalledWith('behavioral_events', [
        { name: 'light1', description: 'Dout3' },
      ]);
    });

    it('offers every recognized DIO type in the Type dropdown', async () => {
      render(
        <BehavioralEventsSection animal={dioAnimal} onFieldUpdate={mockOnFieldUpdate} />
      );

      await user.click(screen.getByRole('button', { name: /^Edit$/i }));

      const typeSelect = screen.getByLabelText(/DIO type/i);
      ['Din', 'Dout', 'Accel', 'Gyro', 'Mag'].forEach((type) => {
        expect(within(typeSelect).getByRole('option', { name: type })).toBeInTheDocument();
      });
    });

    it('offers behavioral-event name suggestions via a combobox on the Name input (free entry retained)', async () => {
      render(
        <BehavioralEventsSection animal={dioAnimal} onFieldUpdate={mockOnFieldUpdate} />
      );

      await user.click(screen.getByRole('button', { name: /^Edit$/i }));

      // The Name field is an editable combobox; clicking it browses the full catalog
      // (the legacy `behavioralEventsNames`) even though a value is already present.
      const nameInput = screen.getByDisplayValue('light1');
      await user.click(nameInput);

      const listbox = await screen.findByRole('listbox');
      const optionValues = within(listbox)
        .getAllByRole('option')
        .map((o) => o.textContent);
      expect(optionValues).toEqual(
        expect.arrayContaining(['Home box camera', 'Poke', 'Light', 'Pump', 'Run Camera Ticks', 'Sleep'])
      );
    });

    it('picks a suggested name from the combobox and saves it', async () => {
      render(
        <BehavioralEventsSection animal={dioAnimal} onFieldUpdate={mockOnFieldUpdate} />
      );

      await user.click(screen.getByRole('button', { name: /^Edit$/i }));
      await user.click(screen.getByDisplayValue('light1'));
      await user.click(screen.getByRole('option', { name: 'Light' }));
      await user.click(screen.getByRole('button', { name: /^Save$/i }));

      expect(mockOnFieldUpdate).toHaveBeenCalledWith('behavioral_events', [
        { name: 'Light', description: 'Din1' },
      ]);
    });
  });

  describe('Validation: Unique Event Names', () => {
    it('should validate that event names are unique', async () => {
      render(
        <BehavioralEventsSection
          animal={mockAnimal}
          onFieldUpdate={mockOnFieldUpdate}
        />
      );

      // Edit first event to have same name as second
      const editButtons = screen.getAllByRole('button', { name: /Edit/i });
      await user.click(editButtons[0]);

      const nameInput = screen.getByDisplayValue('reward_left');
      await user.clear(nameInput);
      await user.type(nameInput, 'reward_right'); // Duplicate name

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/Event name must be unique/i)).toBeInTheDocument();
      });

      // Save button should be disabled
      const saveButton = screen.getByRole('button', { name: /Save/i });
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Validation: Valid Identifier', () => {
    it('should validate that event name is a valid identifier (alphanumeric + underscore)', async () => {
      render(
        <BehavioralEventsSection
          animal={mockAnimal}
          onFieldUpdate={mockOnFieldUpdate}
        />
      );

      // Edit event with invalid name
      const editButtons = screen.getAllByRole('button', { name: /Edit/i });
      await user.click(editButtons[0]);

      const nameInput = screen.getByDisplayValue('reward_left');
      await user.clear(nameInput);
      await user.type(nameInput, 'reward-left'); // Invalid: contains hyphen

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/must contain only letters, numbers, and underscores/i)).toBeInTheDocument();
      });

      // Save button should be disabled
      const saveButton = screen.getByRole('button', { name: /Save/i });
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Validation: Reserved Words Warning', () => {
    it('should warn if event name conflicts with reserved words', async () => {
      // Start with existing event so we can test editing it
      const animalWithEvent = {
        id: 'test',
        behavioral_events: [{ name: 'test_event', description: 'Test' }],
      };

      render(
        <BehavioralEventsSection
          animal={animalWithEvent}
          onFieldUpdate={mockOnFieldUpdate}
        />
      );

      // Click edit on existing event
      const editButton = screen.getByRole('button', { name: /Edit/i });
      await user.click(editButton);

      // Wait for edit mode to appear
      await waitFor(() => {
        expect(screen.getByDisplayValue('test_event')).toBeInTheDocument();
      });

      const nameInput = screen.getByDisplayValue('test_event');
      await user.clear(nameInput);
      await user.type(nameInput, 'reward'); // Reserved word

      // Should show warning (not error - allow but warn)
      await waitFor(() => {
        expect(screen.getByText(/common reserved word/i)).toBeInTheDocument();
      });

      // Save button should still be enabled (warning, not error)
      const saveButton = screen.getByRole('button', { name: /Save/i });
      expect(saveButton).not.toBeDisabled();
    });
  });

  describe('Delete Behavioral Event', () => {
    it('removes an event after confirming in the ConfirmDialog (no native confirm)', async () => {
      render(
        <BehavioralEventsSection
          animal={mockAnimal}
          onFieldUpdate={mockOnFieldUpdate}
        />
      );

      // Clicking the row Delete button opens an in-app confirmation dialog.
      await user.click(screen.getByRole('button', { name: /delete reward_left/i }));

      const dialog = await screen.findByRole('alertdialog');
      expect(dialog).toHaveTextContent('reward_left');

      // Confirm via the dialog's own Delete button (scoped to the dialog).
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

      expect(mockOnFieldUpdate).toHaveBeenCalledWith(
        'behavioral_events',
        expect.arrayContaining([
          expect.objectContaining({ name: 'reward_right' }),
        ])
      );
    });

    it('does not remove the event when the confirmation is cancelled', async () => {
      render(
        <BehavioralEventsSection
          animal={mockAnimal}
          onFieldUpdate={mockOnFieldUpdate}
        />
      );

      await user.click(screen.getByRole('button', { name: /delete reward_left/i }));

      const dialog = await screen.findByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      expect(mockOnFieldUpdate).not.toHaveBeenCalled();
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors with inline error messages', async () => {
      render(
        <BehavioralEventsSection
          animal={mockAnimal}
          onFieldUpdate={mockOnFieldUpdate}
        />
      );

      // Edit event
      const editButtons = screen.getAllByRole('button', { name: /Edit/i });
      await user.click(editButtons[0]);

      const nameInput = screen.getByDisplayValue('reward_left');

      // Clear name (required field)
      await user.clear(nameInput);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/Event name is required/i)).toBeInTheDocument();
      });

      // Save button should be disabled
      const saveButton = screen.getByRole('button', { name: /Save/i });
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should work with Tab, Enter, and Escape keys', async () => {
      render(
        <BehavioralEventsSection
          animal={mockAnimal}
          onFieldUpdate={mockOnFieldUpdate}
        />
      );

      // Tab to first edit button
      const editButtons = screen.getAllByRole('button', { name: /Edit/i });
      editButtons[0].focus();
      expect(editButtons[0]).toHaveFocus();

      // Press Enter to activate edit mode
      await user.keyboard('{Enter}');

      // Should enter edit mode
      await waitFor(() => {
        expect(screen.getByDisplayValue('reward_left')).toBeInTheDocument();
      });

      // Press Escape to cancel
      await user.keyboard('{Escape}');

      // Should exit edit mode
      await waitFor(() => {
        expect(screen.queryByDisplayValue('reward_left')).not.toBeInTheDocument();
      });
    });
  });
});
