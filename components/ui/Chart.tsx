import { useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, Text, View } from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import Svg, { Circle, G, Line, Path, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { COLORS } from '../../constants/theme';

const IS_WEB = Platform.OS === 'web';

/**
 * Chart (ui)
 * Thin wrapper around react-native-chart-kit so screens can drop in a chart
 * without handling width measurement. Measures its own container and renders
 * a Line, Bar, or Pie chart accordingly. Works on web via react-native-svg.
 */

type ChartKind = 'line' | 'bar' | 'pie';

export interface ChartDataset {
  data: number[];
  color: string;
  name?: string;
}

export interface ChartPieDatum {
  name: string;
  value: number;
  color: string;
  legendFontColor?: string;
  legendFontSize?: number;
}

export interface ChartProps {
  kind?: ChartKind;
  title?: string;
  labels?: string[];
  datasets?: ChartDataset[];
  pieData?: ChartPieDatum[];
  height?: number;
}

const BRAND = COLORS.brand;
const gray = (opacity = 1) => `rgba(107, 114, 128, ${opacity})`;

// Helper to convert numbers to strings for SVG props on web
const str = (n: number | string): string => String(n);

function useChartWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  return [width, onLayout];
}

export function Chart({
  kind = 'line',
  title,
  labels = [],
  datasets = [],
  pieData = [],
  height = 220,
}: ChartProps) {
  const [width, onLayout] = useChartWidth();
  const chartWidth = Math.max(width - 16, 200);

  const config = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`,
    labelColor: () => gray(),
    propsForDots: { r: '4', strokeWidth: '2', stroke: BRAND },
    fillShadowGradient: BRAND,
    fillShadowGradientOpacity: 0.2,
    style: { borderRadius: 16 },
  };

  return (
    <View onLayout={onLayout} className="w-full">
      {title ? <Text className="text-base font-semibold text-gray-900 mb-3">{title}</Text> : null}

      {width > 0 && kind === 'line' && datasets.length > 0 && labels.length > 0 && (
        IS_WEB ? (
          <WebLineChart width={chartWidth} height={height} labels={labels} datasets={datasets} />
        ) : (
          <LineChart
            data={{
              labels,
              datasets: datasets.map((d) => ({
                data: d.data,
                color: (o = 1) => `${d.color}${Math.round(o * 255).toString(16).padStart(2, '0')}`,
              })),
            }}
            width={chartWidth}
            height={height}
            chartConfig={config}
            bezier
            style={styles.chart}
          />
        )
      )}

      {width > 0 && kind === 'bar' && (
        IS_WEB ? (
          <WebBarChart width={chartWidth} height={height} labels={labels} datasets={datasets} />
        ) : (
          <BarChart
            data={{
              labels,
              datasets: datasets.map((d) => ({
                data: d.data,
                color: (o = 1) => `${d.color}${Math.round(o * 255).toString(16).padStart(2, '0')}`,
              })),
            }}
            width={chartWidth}
            height={height}
            chartConfig={config}
            fromZero
            showValuesOnTopOfBars
            yAxisLabel="$"
            yAxisSuffix=""
            style={styles.chart}
          />
        )
      )}

      {width > 0 && kind === 'pie' && pieData.length > 0 && (
        IS_WEB ? (
          <WebPieChart width={chartWidth} height={height} data={pieData} />
        ) : (
          <View className="items-center">
            <PieChart
              data={pieData}
              width={chartWidth}
              height={height}
              chartConfig={config}
              accessor="value"
              backgroundColor="transparent"
              paddingLeft="0"
              center={[10, 0]}
              absolute
            />
          </View>
        )
      )}

      {width === 0 && <View style={{ height }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    borderRadius: 16,
    marginLeft: -8,
  },
});

const PAD_TOP = 20;
const PAD_BOTTOM = 24;
const PAD_LEFT = 40;
const PAD_RIGHT = 12;
const Y_TICKS = 4;

function WebLineChart({
  width,
  height,
  labels,
  datasets,
}: {
  width: number;
  height: number;
  labels: string[];
  datasets: ChartDataset[];
}) {
  const plotW = width - PAD_LEFT - PAD_RIGHT;
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const values = datasets.flatMap((d) => d.data).filter((v) => typeof v === 'number' && isFinite(v));
  const min = values.length ? Math.min(0, ...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const range = max - min || 1;
  const n = Math.max(labels.length, ...datasets.map((d) => d.data.length), 2);

  const x = (i: number) => PAD_LEFT + (plotW * i) / (n - 1);
  const y = (v: number) => PAD_TOP + plotH - ((v - min) / range) * plotH;

  const grid = [];
  for (let t = 0; t <= Y_TICKS; t++) {
    const v = min + (range * t) / Y_TICKS;
    const yy = y(v);
    grid.push(
      <G key={`grid-${t}`}>
        <Line x1={str(PAD_LEFT)} y1={str(yy)} x2={str(width - PAD_RIGHT)} y2={str(yy)} stroke="#e5e7eb" strokeWidth={str(1)} strokeDasharray="5,10" />
        <SvgText x={str(PAD_LEFT - 6)} y={str(yy + 4)} fontSize={str(10)} fill="#6b7280" textAnchor="end">
          {Math.round(v)}
        </SvgText>
      </G>
    );
  }

  const lines = datasets.map((d, di) => {
    const color = d.color || BRAND;
    const points = d.data
      .map((v, i) => `${x(i)},${y(v)}`)
      .join(' ');
    return (
      <G key={`line-${di}`}>
        <Polyline points={points} fill="none" stroke={color} strokeWidth={str(2)} strokeLinejoin="round" />
      </G>
    );
  });

  const dots = datasets.map((d, di) =>
    d.data.map((v, i) => (
      <Circle key={`dot-${di}-${i}`} cx={str(x(i))} cy={str(y(v))} r={str(3)} fill={d.color || BRAND} />
    ))
  );

  const xLabels = labels.map((l, i) => (
    <SvgText key={`xlabel-${i}`} x={str(x(i))} y={str(height - 6)} fontSize={str(10)} fill="#6b7280" textAnchor="middle">
      {l}
    </SvgText>
  ));

  return (
    <Svg width={str(width)} height={str(height)}>
      {grid}
      {lines}
      {dots}
      {xLabels}
    </Svg>
  );
}

function WebBarChart({
  width,
  height,
  labels,
  datasets,
}: {
  width: number;
  height: number;
  labels: string[];
  datasets: ChartDataset[];
}) {
  const plotW = width - PAD_LEFT - PAD_RIGHT;
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const values = datasets.flatMap((d) => d.data).filter((v) => typeof v === 'number' && isFinite(v));
  const max = values.length ? Math.max(0, ...values) : 1;
  const n = Math.max(labels.length, ...datasets.map((d) => d.data.length), 1);

  const y = (v: number) => PAD_TOP + plotH - (v / max) * plotH;

  const grid = [];
  for (let t = 0; t <= Y_TICKS; t++) {
    const v = (max * t) / Y_TICKS;
    const yy = y(v);
    grid.push(
      <G key={`grid-${t}`}>
        <Line x1={str(PAD_LEFT)} y1={str(yy)} x2={str(width - PAD_RIGHT)} y2={str(yy)} stroke="#e5e7eb" strokeWidth={str(1)} strokeDasharray="5,10" />
        <SvgText x={str(PAD_LEFT - 6)} y={str(yy + 4)} fontSize={str(10)} fill="#6b7280" textAnchor="end">
          {Math.round(v)}
        </SvgText>
      </G>
    );
  }

  const groupW = plotW / n;
  const barCount = Math.max(datasets.length, 1);
  const barW = Math.min((groupW / barCount) * 0.6, 24);
  const gap = barW * 0.35;

  const bars = datasets.map((d, di) =>
    d.data.map((v, i) => {
      const cx = PAD_LEFT + groupW * i + groupW / 2;
      const x0 = cx - ((barCount - 1) / 2) * (barW + gap) + di * (barW + gap) - barW / 2;
      const y0 = y(v);
      return (
        <G key={`bar-${di}-${i}`}>
          <Rect x={str(x0)} y={str(y0)} width={str(barW)} height={str(Math.max(PAD_TOP + plotH - y0, 0))} rx={str(3)} fill={d.color || BRAND} />
          {v > 0 && (
            <SvgText x={str(x0 + barW / 2)} y={str(y0 - 4)} fontSize={str(9)} fill={d.color || BRAND} textAnchor="middle">
              {Math.round(v)}
            </SvgText>
          )}
        </G>
      );
    })
  );

  const xLabels = labels.map((l, i) => (
    <SvgText key={`xlabel-${i}`} x={str(PAD_LEFT + groupW * i + groupW / 2)} y={str(height - 6)} fontSize={str(10)} fill="#6b7280" textAnchor="middle">
      {l}
    </SvgText>
  ));

  return (
    <Svg width={str(width)} height={str(height)}>
      {grid}
      {bars}
      {xLabels}
    </Svg>
  );
}

function WebPieChart({
  width,
  height,
  data,
}: {
  width: number;
  height: number;
  data: ChartPieDatum[];
}) {
  const total = data.reduce((sum, d) => sum + (typeof d.value === 'number' && isFinite(d.value) ? d.value : 0), 0);
  const radius = Math.max(Math.min(width, height) / 2 - 24, 10);
  const cx = width / 2;
  const cy = height / 2;

  if (total <= 0) {
    return (
      <Svg width={str(width)} height={str(height)}>
        <Circle cx={str(cx)} cy={str(cy)} r={str(radius)} fill="#e5e7eb" />
      </Svg>
    );
  }

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const polar = (angleDeg: number, r: number) => {
    const rad = toRad(angleDeg);
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };

  const segments = [];
  let angle = -90;
  const legendItems = [];

  for (let i = 0; i < data.length; i++) {
    const frac = data[i].value / total;
    const sweep = frac * 360;
    if (sweep <= 0) continue;
    const [x0, y0] = polar(angle, radius);
    const [x1, y1] = polar(angle + sweep, radius);
    const largeArc = sweep > 180 ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x0} ${y0} A ${radius} ${radius} 0 ${largeArc} 1 ${x1} ${y1} Z`;
    const mid = angle + sweep / 2;
    const [lx, ly] = polar(mid, radius * 0.6);
    segments.push(
      <G key={`seg-${i}`}>
        <Path d={path} fill={data[i].color} />
        {frac >= 0.05 && (
          <SvgText x={str(lx)} y={str(ly)} fontSize={str(11)} fill="#ffffff" textAnchor="middle" alignmentBaseline="central">
            {Math.round(frac * 100)}%
          </SvgText>
        )}
      </G>
    );
    legendItems.push(
      <G key={`legend-${i}`}>
        <Rect x={str(12)} y={str(12 + i * 16)} width={str(10)} height={str(10)} rx={str(2)} fill={data[i].color} />
        <SvgText x={str(28)} y={str(21 + i * 16)} fontSize={str(11)} fill="#374151">
          {data[i].name}: {data[i].value}
        </SvgText>
      </G>
    );
    angle += sweep;
  }

  return (
    <Svg width={str(width)} height={str(height)}>
      {segments}
      {legendItems}
    </Svg>
  );
}
