import { Typography as AntTypography, TypographyProps as AntTypographyProps } from "antd";
import { CSSProperties, ReactNode } from "react";

const { Title: AntTitle, Text: AntText, Paragraph: AntParagraph } = AntTypography;

export interface TitleProps {
  level?: 1 | 2 | 3 | 4 | 5;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Title({ level = 1, children, className, style }: TitleProps) {
  return (
    <AntTitle level={level} className={className} style={style}>
      {children}
    </AntTitle>
  );
}

export interface TextProps {
  children: ReactNode;
  type?: "secondary" | "success" | "warning" | "danger";
  className?: string;
  style?: CSSProperties;
  strong?: boolean;
}

export function Text({ children, type, className, style, strong }: TextProps) {
  return (
    <AntText type={type} className={className} style={style} strong={strong}>
      {children}
    </AntText>
  );
}

export interface ParagraphProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Paragraph({ children, className, style }: ParagraphProps) {
  return (
    <AntParagraph className={className} style={style}>
      {children}
    </AntParagraph>
  );
}
