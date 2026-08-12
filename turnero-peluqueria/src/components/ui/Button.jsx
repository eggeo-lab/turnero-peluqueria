import './Button.css';

export default function Button({
  children,
  variant = 'primary',
  full = true,
  disabled = false,
  icon: Icon,
  onClick,
  type = 'button',
}) {
  return (
    <button
      type={type}
      className={`btn btn--${variant}${full ? ' btn--full' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      {Icon && <Icon size={19} weight="bold" />}
      <span>{children}</span>
    </button>
  );
}
