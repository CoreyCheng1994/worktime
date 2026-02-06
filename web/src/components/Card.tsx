import { Card as AntCard, CardProps as AntCardProps } from "antd";
import { CSSProperties, ReactNode } from "react";

export interface CardProps extends Omit<AntCardProps, "style"> {
  children: ReactNode;
  style?: CSSProperties;
}

export function Card({ children, ...props }: CardProps) {
  return <AntCard {...props}>{children}</AntCard>;
}
