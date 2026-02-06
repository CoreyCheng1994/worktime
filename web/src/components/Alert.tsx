import { Alert as AntAlert, AlertProps as AntAlertProps } from "antd";
import { CSSProperties } from "react";

export interface AlertProps extends Omit<AntAlertProps, "style"> {
  style?: CSSProperties;
}

export function Alert(props: AlertProps) {
  return <AntAlert {...props} />;
}
