import type { CardProps as AntCardProps } from "antd";
import { Card as AntCard } from "antd";
import type { CSSProperties, ReactNode } from "react";

export interface CardProps extends Omit<AntCardProps, "style"> {
  children: ReactNode;
  style?: CSSProperties;
}

export function Card({ children, ...props }: CardProps) {
  return <AntCard {...props}>{children}</AntCard>;
}
