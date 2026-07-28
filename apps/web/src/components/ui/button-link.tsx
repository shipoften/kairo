import { Link } from "@/i18n/navigation";
import { buttonClassName, type ButtonStyleProps } from "./button";

export function ButtonLink({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  href,
  children,
  ...props
}: React.ComponentProps<typeof Link> & ButtonStyleProps) {
  return (
    <Link
      href={href}
      className={buttonClassName({ variant, size, fullWidth, className })}
      {...props}
    >
      {children}
    </Link>
  );
}
