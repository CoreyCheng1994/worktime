import { Tag as AntTag, TagProps as AntTagProps } from "antd";
import { CSSProperties, ReactNode } from "react";

export interface TagProps extends Omit<AntTagProps, "style"> {
  children: ReactNode;
  style?: CSSProperties;
}

export function Tag({ children, ...props }: TagProps) {
  return <AntTag {...props}>{children}</AntTag>;
}
