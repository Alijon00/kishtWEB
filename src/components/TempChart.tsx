import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "../i18n";

export interface TempPoint {
  year: number;
  /** Mean summer temperature for the year, °C. */
  temp: number;
  /** Fitted trend value for the year, °C. */
  trend: number;
}

interface TempChartProps {
  data: TempPoint[];
}

export default function TempChart({ data }: TempChartProps) {
  const { d } = useI18n();
  return (
    <div className="card chart-card">
      <h2>{d.charts.tempTitle}</h2>
      <div className="chart-sub">{d.charts.tempSub}</div>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
            <CartesianGrid stroke="#26332e" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 12, fill: "#93a39b" }}
              stroke="#26332e"
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              width={44}
              tick={{ fontSize: 12, fill: "#93a39b" }}
              stroke="#26332e"
              domain={["dataMin - 1", "dataMax + 1"]}
              tickFormatter={(v: number) => `${v.toFixed(0)}°`}
            />
            <Tooltip
              formatter={(value: number, name) => [
                `${value.toFixed(1)} °C`,
                name === "temp" ? d.charts.tempTooltipMean : d.charts.tempTooltipTrend,
              ]}
              labelFormatter={(label) => d.charts.tempYear({ year: label })}
              contentStyle={{
                fontFamily: "IBM Plex Mono, monospace",
                fontSize: 12,
                borderRadius: 10,
                background: "#1b2521",
                border: "1px solid #26332e",
                color: "#e6ede8",
              }}
              itemStyle={{ color: "#e6ede8" }}
              labelStyle={{ color: "#93a39b" }}
            />
            <Line
              type="monotone"
              dataKey="temp"
              stroke="#4fc3dc"
              strokeWidth={2.5}
              dot={{ r: 2.5, fill: "#4fc3dc" }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
            <Line
              type="linear"
              dataKey="trend"
              stroke="#e3b04b"
              strokeWidth={1.5}
              strokeDasharray="6 5"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
