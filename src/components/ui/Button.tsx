import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

/** Props for the {@link Button} primitive; any unlisted `<button>` attribute is forwarded. */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Visual variant (default 'primary').
   * - `danger` — a filled red for consequential confirms (e.g. a delete confirm dialog).
   * - `dangerSubtle` — a *restrained* destructive treatment (red text on white, neutral
   *   border) for low-commitment, repeated destructive actions like a table row's Delete,
   *   so a list of rows isn't a wall of filled red.
   * - `neutral` — a quiet grey action (e.g. a table row's Edit) that pairs with `dangerSubtle`.
   */
  variant?: 'primary' | 'secondary' | 'danger' | 'dangerSubtle' | 'neutral';
  /** Size (default 'medium'). 'small' is the compact size for dense table-row actions. */
  size?: 'medium' | 'small';
}

/**
 * Button - the canonical, token-driven button primitive.
 *
 * Replaces the divergent per-section `.button-primary` / `.button-secondary` /
 * `.button-danger` copies with one CSS-Module component. Styling is locally scoped
 * (see Button.module.css) and driven entirely by design tokens. Any unlisted prop
 * (`onClick`, `disabled`, `aria-*`, `title`, `ref` via callback, …) is forwarded to
 * the underlying `<button>`.
 */
const Button = ({ variant = 'primary', size = 'medium', type = 'button', className = '', children, ...rest }: ButtonProps) => {
  const variantClass = styles[variant] || styles.primary;
  const sizeClass = size === 'small' ? styles.small : '';
  const classes = [styles.button, variantClass, sizeClass, className].filter(Boolean).join(' ');
  return (
    // eslint-disable-next-line react/button-has-type
    <button {...rest} type={type} className={classes}>
      {children}
    </button>
  );
};

export default Button;
