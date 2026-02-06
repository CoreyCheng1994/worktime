import { Spin as AntSpin, SpinProps as AntSpinProps } from "antd";
import { CSSProperties } from "react";

export interface SpinProps extends Omit<AntSpinProps, "style"> {
  style?: CSSProperties;
}

export function Spin(props: SpinProps) {
  return <AntSpin {...props} />;
}
