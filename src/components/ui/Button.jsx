import PropTypes from 'prop-types';
import styles from './Button.module.css';

/**
 * Button - the canonical, token-driven button primitive.
 *
 * Replaces the divergent per-section `.button-primary` / `.button-secondary` /
 * `.button-danger` copies with one CSS-Module component. Styling is locally scoped
 * (see Button.module.css) and driven entirely by design tokens. Any unlisted prop
 * (`onClick`, `disabled`, `aria-*`, `title`, `ref` via callback, …) is forwarded to
 * the underlying `<button>`.
 *
 * @param {object} props - Component props.
 * @param {'primary'|'secondary'|'danger'} [props.variant] - Visual variant (default 'primary').
 * @param {'button'|'submit'|'reset'} [props.type] - Native button type (default 'button', so it
 *   never accidentally submits a form).
 * @param {string} [props.className] - Extra class names appended after the module classes.
 * @param {React.ReactNode} [props.children] - Button label/content.
 * @returns {JSX.Element} The rendered button.
 */
const Button = ({ variant = 'primary', type = 'button', className = '', children, ...rest }) => {
  const variantClass = styles[variant] || styles.primary;
  const classes = [styles.button, variantClass, className].filter(Boolean).join(' ');
  return (
    // eslint-disable-next-line react/button-has-type
    <button {...rest} type={type} className={classes}>
      {children}
    </button>
  );
};

Button.propTypes = {
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger']),
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  className: PropTypes.string,
  children: PropTypes.node,
};

export default Button;
