import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "../i18n";

export interface RainPoint {
  month: string;
  baseline: number;
  recent: number;
}

interface RainChartProps {
  data: RainPoint[];
}

export default function RainChart({ data }: RainChartProps) {
  const { d } = useI18n();
  return (
    <div className="card chart-card">
      <h2>{d.charts.rainTitle}</h2>
      <div className="chart-sub">{d.charts.rainSub}</div>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
            <CartesianGrid stroke="#26332e" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: "#93a39b" }}
              stroke="#26332e"
            />
            <YAxis
              width={44}
              tick={{ fontSize: 12, fill: "#93a39b" }}
              stroke="#26332e"
              tickFormatter={(v: number) => `${v.toFixed(0)}`}
            />
            <Tooltip
              formatter={(value: number, name) => [
                `${value.toFixed(0)} mm`,
                name === "baseline" ? d.charts.periodBaseline : d.charts.periodRecent,
              ]}
              cursor={{ fill: "rgba(79,195,220,0.08)" }}
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
            <Legend
              wrapperStyle={{ fontSize: 13, fontFamily: "IBM Plex Sans, sans-serif", color: "#93a39b" }}
              formatter={(value) =>
                value === "baseline" ? d.charts.periodBaseline : d.charts.periodRecent
              }
            />
            <Bar dataKey="baseline" fill="#93a39b" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="recent" fill="#4fc3dc" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
