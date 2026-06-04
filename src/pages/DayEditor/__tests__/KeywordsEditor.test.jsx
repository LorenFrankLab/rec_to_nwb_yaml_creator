import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import KeywordsEditor from '../KeywordsEditor';

describe('KeywordsEditor', () => {
  it('renders the existing keywords', () => {
    render(<KeywordsEditor value={['spatial', 'w-track']} onChange={vi.fn()} />);

    expect(screen.getByText('spatial')).toBeInTheDocument();
    expect(screen.getByText('w-track')).toBeInTheDocument();
  });

  it('adds a trimmed keyword via the Add button', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KeywordsEditor value={['spatial']} onChange={onChange} />);

    await user.type(screen.getByRole('textbox', { name: /keyword/i }), '  w-track  ');
    await user.click(screen.getByRole('button', { name: /add keyword/i }));

    expect(onChange).toHaveBeenCalledWith(['spatial', 'w-track']);
  });

  it('removes a keyword', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KeywordsEditor value={['spatial', 'w-track']} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /remove keyword spatial/i }));

    expect(onChange).toHaveBeenCalledWith(['w-track']);
  });

  it('ignores empty input and does not call onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KeywordsEditor value={['spatial']} onChange={onChange} />);

    await user.type(screen.getByRole('textbox', { name: /keyword/i }), '   ');
    await user.click(screen.getByRole('button', { name: /add keyword/i }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not add a duplicate keyword (schema requires unique items)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KeywordsEditor value={['spatial']} onChange={onChange} />);

    await user.type(screen.getByRole('textbox', { name: /keyword/i }), 'spatial');
    await user.click(screen.getByRole('button', { name: /add keyword/i }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('treats undefined value as an empty list', () => {
    render(<KeywordsEditor value={undefined} onChange={vi.fn()} />);

    expect(screen.getByRole('textbox', { name: /keyword/i })).toBeInTheDocument();
  });
});
