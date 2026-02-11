import type { AlertProps as AntAlertProps } from "antd";
import { Alert as AntAlert } from "antd";
import type { CSSProperties } from "react";

export interface AlertProps extends Omit<AntAlertProps, "style"> {
  style?: CSSProperties;
}

export function Alert(props: AlertProps) {
  return <AntAlert {...props} />;
}
