/**
 * Minimal ambient types for `react-native-chart-kit`.
 *
 * The package ships JavaScript only — no bundled `.d.ts` and no
 * `@types/react-native-chart-kit` in `devDependencies` — so under `strict`
 * every import from it was an implicit `any` and `tsc --noEmit` failed. The
 * declarations below cover exactly the props `components/ui/Chart.tsx` passes.
 *
 * The only chart-kit–specific decision is the `color` callbacks: they take an
 * optional opacity and must return a colour string, so they are typed as
 * `(opacity?: number) => string` rather than `any`.
 */
declare module 'react-native-chart-kit' {
  import type { StyleProp, ViewStyle } from 'react-native';

  interface ChartKitDataset {
    data: number[];
    color?: (opacity?: number) => string;
    withDots?: boolean;
    withScrollableDot?: boolean;
    strokeWidth?: number;
    strokeDasharray?: number[];
  }

  interface ChartKitData {
    labels: string[];
    datasets: ChartKitDataset[];
    legend?: string[];
  }

  interface ChartKitPieDatum {
    name: string;
    value: number;
    color: string;
    legendFontColor?: string;
    legendFontSize?: number;
  }

  interface ChartKitChartConfig {
    backgroundGradientFrom?: string;
    backgroundGradientTo?: string;
    backgroundGradientFromOpacity?: number;
    backgroundGradientToOpacity?: number;
    color?: (opacity?: number) => string;
    labelColor?: (opacity?: number) => string;
    decimalPlaces?: number;
    propsForDots?: Record<string, unknown>;
    propsForBackgroundLines?: Record<string, unknown>;
    fillShadowGradient?: string;
    fillShadowGradientOpacity?: number;
    style?: Record<string, unknown>;
    [key: string]: unknown;
  }

  interface BaseChartProps {
    data: ChartKitData | ChartKitPieDatum[];
    width: number;
    height: number;
    chartConfig: ChartKitChartConfig;
    style?: StyleProp<ViewStyle>;
    accessor?: string;
    backgroundColor?: string;
    paddingLeft?: string | number;
    center?: [number, number];
    absolute?: boolean;
    fromZero?: boolean;
    showValuesOnTopOfBars?: boolean;
    yAxisLabel?: string;
    yAxisSuffix?: string;
    bezier?: boolean;
    withInnerLines?: boolean;
    segments?: number;
  }

  export function LineChart(props: BaseChartProps): JSX.Element;
  export function BarChart(props: BaseChartProps): JSX.Element;
  export function PieChart(props: BaseChartProps): JSX.Element;
}
