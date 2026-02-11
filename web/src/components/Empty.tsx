import type { EmptyProps as AntEmptyProps } from "antd";
import { Empty as AntEmpty } from "antd";
import type { CSSProperties } from "react";

export interface EmptyProps extends Omit<AntEmptyProps, "style"> {
  style?: CSSProperties;
}

export function Empty(props: EmptyProps) {
  return <AntEmpty {...props} />;
}
