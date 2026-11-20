import { formatThaiShortDate } from "../utils/formatThaiShortDate";

export interface WeeklyActivityPoint {
    weekStart: string;
    count: number;
}

interface WeeklyActivityChartProps {
    data: WeeklyActivityPoint[];
}

const MAX_BAR_HEIGHT = 96;
const MIN_NONZERO_BAR_HEIGHT = 10;
const ZERO_BAR_HEIGHT = 6;

// Plain CSS bars (no charting library): height is proportional to count,
// weeks with 0 summaries get a short, pale, fixed-height bar instead of nothing.
function WeeklyActivityChart({ data }: WeeklyActivityChartProps) {
    const maxCount = Math.max(1, ...data.map((point) => point.count));

    return (
        <div className="flex items-end gap-1.5 sm:gap-3">
            {data.map((point) => {
                const barHeight =
                    point.count === 0
                        ? ZERO_BAR_HEIGHT
                        : Math.max(MIN_NONZERO_BAR_HEIGHT, Math.round((point.count / maxCount) * MAX_BAR_HEIGHT));

                return (
                    <div key={point.weekStart} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                        <span className="text-xs font-medium text-ink-muted">{point.count}</span>
                        <div
                            className={`w-full rounded-t-md ${point.count === 0 ? "bg-background" : "bg-primary-500"}`}
                            style={{ height: `${barHeight}px` }}
                        />
                        <span className="text-center text-[10px] leading-tight whitespace-nowrap text-ink-muted">
                            {formatThaiShortDate(point.weekStart)}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

export default WeeklyActivityChart;
