import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';

describe('ListElement Query Test', () => {
  it('can query experimenter input by placeholder text', async () => {
    const user = userEvent.setup();
    render(<App />);

    // THREE WAYS TO QUERY:
    
    // Option 1: By placeholder text (SIMPLEST)
    const input1 = screen.getByPlaceholderText('LastName, FirstName');
    expect(input1).toBeInTheDocument();
    
    // Option 2: By role with name (if accessible name is set)
    // const input2 = screen.getByRole('textbox', { name: /experimenter/i });
    
    // Option 3: By role, then filter by name attribute
    // const inputs = screen.getAllByRole('textbox');
    // const input3 = inputs.find(i => i.getAttribute('name') === 'experimenter_name');
    
    // Test that we can type and add an item
    await user.type(input1, 'Doe, John');
    await user.keyboard('{Enter}');
    
    // Verify item was added (appears as text)
    expect(screen.getByText(/Doe, John/)).toBeInTheDocument();
  });
});
