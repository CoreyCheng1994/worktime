import type { SpinProps as AntSpinProps } from "antd";
import { Spin as AntSpin } from "antd";
import type { CSSProperties } from "react";

export interface SpinProps extends Omit<AntSpinProps, "style"> {
  style?: CSSProperties;
}

export function Spin(props: SpinProps) {
  return <AntSpin {...props} />;
}
