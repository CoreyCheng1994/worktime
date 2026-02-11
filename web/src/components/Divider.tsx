import type { DividerProps as AntDividerProps } from "antd";
import { Divider as AntDivider } from "antd";
import type { CSSProperties } from "react";

export interface DividerProps extends Omit<AntDividerProps, "style"> {
  style?: CSSProperties;
}

export function Divider(props: DividerProps) {
  return <AntDivider {...props} />;
}
