import { Divider as AntDivider, DividerProps as AntDividerProps } from "antd";
import { CSSProperties } from "react";

export interface DividerProps extends Omit<AntDividerProps, "style"> {
  style?: CSSProperties;
}

export function Divider(props: DividerProps) {
  return <AntDivider {...props} />;
}
