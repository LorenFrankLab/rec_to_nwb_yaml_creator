import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Breadcrumb from '../Breadcrumb';

describe('Breadcrumb', () => {
  it('renders breadcrumb navigation', () => {
    const items = [
      { label: 'Home', href: '#/' },
      { label: 'Animal: remy', href: '#/animal/remy' },
      { label: 'Day: 2023-06-22' },
    ];

    render(<Breadcrumb items={items} />);

    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();
  });

  it('renders all breadcrumb items', () => {
    const items = [
      { label: 'Home', href: '#/' },
      { label: 'Animal: remy', href: '#/animal/remy' },
      { label: 'Day: 2023-06-22' },
    ];

    render(<Breadcrumb items={items} />);

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Animal: remy')).toBeInTheDocument();
    expect(screen.getByText('Day: 2023-06-22')).toBeInTheDocument();
  });

  it('renders links for items with href', () => {
    const items = [
      { label: 'Home', href: '#/' },
      { label: 'Animal: remy', href: '#/animal/remy' },
      { label: 'Day: 2023-06-22' },
    ];

    render(<Breadcrumb items={items} />);

    const homeLink = screen.getByRole('link', { name: /home/i });
    expect(homeLink).toHaveAttribute('href', '#/');

    const animalLink = screen.getByRole('link', { name: /animal: remy/i });
    expect(animalLink).toHaveAttribute('href', '#/animal/remy');
  });

  it('marks last item as current page', () => {
    const items = [
      { label: 'Home', href: '#/' },
      { label: 'Day: 2023-06-22' },
    ];

    render(<Breadcrumb items={items} />);

    const currentItem = screen.getByText('Day: 2023-06-22');
    expect(currentItem).toHaveAttribute('aria-current', 'page');
  });

  it('renders separators between items', () => {
    const items = [
      { label: 'Home', href: '#/' },
      { label: 'Animal: remy', href: '#/animal/remy' },
      { label: 'Day: 2023-06-22' },
    ];

    const { container } = render(<Breadcrumb items={items} />);

    // Find separators (›)
    const separators = container.querySelectorAll('.breadcrumb-separator');
    expect(separators.length).toBe(2); // One less than items count
  });

  it('handles empty items array', () => {
    const { container } = render(<Breadcrumb items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('handles single item', () => {
    const items = [{ label: 'Home', href: '#/' }];

    render(<Breadcrumb items={items} />);

    expect(screen.getByText('Home')).toBeInTheDocument();
    // Single item should have aria-current since it's the last
    expect(screen.getByText('Home')).toHaveAttribute('aria-current', 'page');
  });
});
