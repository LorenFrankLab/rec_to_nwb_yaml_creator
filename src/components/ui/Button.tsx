import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

/** Props for the {@link Button} primitive; any unlisted `<button>` attribute is forwarded. */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant (default 'primary'). */
  variant?: 'primary' | 'secondary' | 'danger';
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
const Button = ({ variant = 'primary', type = 'button', className = '', children, ...rest }: ButtonProps) => {
  const variantClass = styles[variant] || styles.primary;
  const classes = [styles.button, variantClass, className].filter(Boolean).join(' ');
  return (
    // eslint-disable-next-line react/button-has-type
    <button {...rest} type={type} className={classes}>
      {children}
    </button>
  );
};

export default Button;
