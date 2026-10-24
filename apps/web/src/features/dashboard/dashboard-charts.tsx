"use client";

import { formatNumber, LineAreaChart } from "@recap/admin-ui";

const PINK = "#FF0080";
const NAVY = "#3A416F";

/** Meetings per day (left axis) with recorded hours per day (right axis). */
export function MeetingsChart(props: {
  labels: string[];
  meetings: number[];
  hours: number[];
  rangeText: string;
}) {
  return (
    <LineAreaChart
      ariaLabel={`Biểu đồ đường: số cuộc họp và giờ họp mỗi ngày, ${props.rangeText}`}
      labels={props.labels}
      height={350}
      axis={{ right: { format: (v) => formatNumber(v, 1) } }}
      series={[
        {
          id: "meetings",
          label: "Cuộc họp",
          values: props.meetings,
          color: NAVY,
          areaOpacity: 0.12,
          formatValue: (v) => formatNumber(v),
        },
        {
          id: "hours",
          label: "Giờ họp",
          values: props.hours,
          color: PINK,
          axis: "right",
          formatValue: (v) => `${formatNumber(v, 1)} giờ`,
        },
      ]}
    />
  );
}
