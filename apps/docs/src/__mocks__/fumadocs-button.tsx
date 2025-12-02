import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { cloneElement, isValidElement } from 'react';

interface ButtonProps extends ComponentProps<'button'> {
  children: ReactNode;
  variant?: string;
  size?: string;
  asChild?: boolean;
}

export function Button({ children, asChild, variant, size, ...props }: ButtonProps) {
  if (asChild && isValidElement(children)) {
    return cloneElement(children as ReactElement<any>, props);
  }
  return <button {...props}>{children}</button>;
}
