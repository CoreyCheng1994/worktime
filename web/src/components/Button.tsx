import type { ButtonProps as AntButtonProps } from "antd";
import { Button as AntButton } from "antd";
import type { CSSProperties, ReactNode } from "react";

export interface ButtonProps extends Omit<AntButtonProps, "style"> {
  children: ReactNode;
  style?: CSSProperties;
}

export function Button({ children, ...props }: ButtonProps) {
  return <AntButton {...props}>{children}</AntButton>;
}
