// Recharts + React 19 타입 호환성 패치
// https://github.com/recharts/recharts/issues/3615
import "react";

declare module "react" {
   
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}
