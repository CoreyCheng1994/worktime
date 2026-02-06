import { Select as AntSelect, SelectProps as AntSelectProps } from "antd";
import { CSSProperties } from "react";

export interface SelectProps<T = unknown> extends Omit<AntSelectProps<T>, "style"> {
  style?: CSSProperties;
}

export function Select<T = unknown>(props: SelectProps<T>) {
  return <AntSelect<T> {...props} />;
}
