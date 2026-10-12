import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import './button.css'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface CommonProps {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  iconAfter?: ReactNode
  block?: boolean
}

function classes({
  variant = 'secondary',
  size = 'md',
  block,
  iconOnly,
  className,
}: CommonProps & { iconOnly?: boolean; className?: string }) {
  return [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    block ? 'btn--block' : '',
    iconOnly ? 'btn--icon' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')
}

export interface ButtonProps
  extends CommonProps,
    ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  /** Text announced/shown while loading. Defaults to the button label. */
  loadingText?: string
}

export function Button({
  variant,
  size,
  icon,
  iconAfter,
  block,
  loading = false,
  loadingText,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const iconOnly = !children && !!icon
  return (
    <button
      type={type}
      className={classes({ variant, size, block, iconOnly, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="btn__icon spin" aria-hidden /> : icon}
      {loading && loadingText ? loadingText : children}
      {!loading && iconAfter}
    </button>
  )
}

export function LinkButton({
  variant,
  size,
  icon,
  iconAfter,
  block,
  className,
  children,
  ...rest
}: CommonProps & LinkProps) {
  return (
    <Link className={classes({ variant, size, block, className })} {...rest}>
      {icon}
      {children}
      {iconAfter}
    </Link>
  )
}
