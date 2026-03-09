// Recharts + React 19 타입 호환성 패치
// https://github.com/recharts/recharts/issues/3615
import "react";

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}
