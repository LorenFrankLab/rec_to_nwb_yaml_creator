import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'dangerSubtle' | 'neutral';
type ButtonSize = 'medium' | 'small';

interface ButtonStyleProps {
  /**
   * Visual variant (default 'primary').
   * - `danger` — a filled red for consequential confirms (e.g. a delete confirm dialog).
   * - `dangerSubtle` — a *restrained* destructive treatment (red text on white, neutral
   *   border) for low-commitment, repeated destructive actions like a table row's Delete,
   *   so a list of rows isn't a wall of filled red.
   * - `neutral` — a quiet grey action (e.g. a table row's Edit) that pairs with `dangerSubtle`.
   */
  variant?: ButtonVariant;
  /** Size (default 'medium'). 'small' is the compact size for dense table-row actions. */
  size?: ButtonSize;
}

/** Props for the {@link Button} primitive; any unlisted `<button>` attribute is forwarded. */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyleProps {}

/** Props for {@link ButtonLink}; any unlisted `<a>` attribute is forwarded. */
interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement>, ButtonStyleProps {}

/** The class list for a variant/size, shared by the button and link renderings. */
function buttonClasses(variant: ButtonVariant, size: ButtonSize, className: string): string {
  const variantClass = styles[variant] || styles.primary;
  const sizeClass = size === 'small' ? styles.small : '';
  return [styles.button, variantClass, sizeClass, className].filter(Boolean).join(' ');
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
const Button = ({ variant = 'primary', size = 'medium', type = 'button', className = '', children, ...rest }: ButtonProps) => (
  // eslint-disable-next-line react/button-has-type
  <button {...rest} type={type} className={buttonClasses(variant, size, className)}>
    {children}
  </button>
);

/**
 * ButtonLink - a navigation link styled as a {@link Button}. Use it for a call-to-action that
 * changes route (an `<a href>`), so the primitive's look isn't re-created as a global class on an
 * anchor. It stays a real link: right-click / middle-click / focus semantics are the anchor's.
 */
export const ButtonLink = ({ variant = 'primary', size = 'medium', className = '', children, ...rest }: ButtonLinkProps) => (
  <a {...rest} className={buttonClasses(variant, size, className)}>
    {children}
  </a>
);

export default Button;
