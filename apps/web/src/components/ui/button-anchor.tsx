import { buttonClassName, type ButtonStyleProps } from "./button";

export function ButtonAnchor({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  href,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & ButtonStyleProps) {
  return (
    <a
      href={href}
      className={buttonClassName({ variant, size, fullWidth, className })}
      {...props}
    >
      {children}
    </a>
  );
}
