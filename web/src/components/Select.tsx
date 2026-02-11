import type { SelectProps as AntSelectProps } from "antd";
import { Select as AntSelect } from "antd";
import type { CSSProperties } from "react";

export interface SelectProps<T = unknown> extends Omit<AntSelectProps<T>, "style"> {
  style?: CSSProperties;
}

export function Select<T = unknown>(props: SelectProps<T>) {
  return <AntSelect<T> {...props} />;
}
