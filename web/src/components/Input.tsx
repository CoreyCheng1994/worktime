import { Input as AntInput, InputNumber as AntInputNumber, InputProps as AntInputProps, InputNumberProps as AntInputNumberProps } from "antd";
import { CSSProperties } from "react";

export interface InputProps extends Omit<AntInputProps, "style"> {
  style?: CSSProperties;
}

export function Input(props: InputProps) {
  return <AntInput {...props} />;
}

export interface InputNumberProps extends Omit<AntInputNumberProps, "style"> {
  style?: CSSProperties;
}

export function InputNumber(props: InputNumberProps) {
  return <AntInputNumber {...props} />;
}
