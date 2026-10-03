/**
 * The import summary names what an import changed: a value the form has no input for (an optical
 * fiber's coordinate reference) is set to the one the form writes, and the summary says so.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import YAML from 'yaml';
import fs from 'fs';
import path from 'path';
import { App } from '../../App';
import { StoreProvider } from '../../state/StoreContext';
import { getFileInput } from '../helpers/test-selectors';

describe('import summary: values the import set', () => {
  beforeEach(() => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists an optical fiber reference the import filled in', { timeout: 60000 }, async () => {
    const model = YAML.parse(
      fs.readFileSync(path.join(__dirname, '../fixtures/valid/20230622_sample_metadata.yml'), 'utf8')
    );
    delete model.optical_fiber[0].reference;
    const user = userEvent.setup();
    render(
      <StoreProvider>
        <App />
      </StoreProvider>
    );

    await user.upload(
      getFileInput(),
      new File([YAML.stringify(model)], 'session.yml', { type: 'text/yaml' })
    );

    const dialog = await screen.findByRole('alertdialog');
    await waitFor(() => expect(dialog).toHaveTextContent('CHANGED (1)'));
    expect(dialog).toHaveTextContent('Set to "Bregma at the cortical surface"');
    expect(dialog).not.toHaveTextContent('EXCLUDED');
  });
});
