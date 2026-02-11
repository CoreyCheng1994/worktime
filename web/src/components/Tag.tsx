import type { TagProps as AntTagProps } from "antd";
import { Tag as AntTag } from "antd";
import type { CSSProperties, ReactNode } from "react";

export interface TagProps extends Omit<AntTagProps, "style"> {
  children: ReactNode;
  style?: CSSProperties;
}

export function Tag({ children, ...props }: TagProps) {
  return <AntTag {...props}>{children}</AntTag>;
}
