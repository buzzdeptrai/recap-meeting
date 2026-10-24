import { StatTile } from "@recap/admin-ui";
import { formatSeconds } from "@/lib/format";
import { averageLatencyMs, type RoomState } from "./state";

/** Content of the "Phiên" tab: four tiles. Never money, tokens or usage (those live on /usage). */
export function SessionStats({ room }: { room: RoomState }) {
  const latency = averageLatencyMs(room.latencies);
  const { stats } = room;
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <StatTile label="Độ trễ dịch" value={latency === null ? "—" : formatSeconds(latency)} />
      <StatTile label="Số đoạn" value={stats.segments} />
      <StatTile label="Số từ" value={stats.words} />
      <StatTile label="Đã dịch" value={`${stats.translated}/${stats.segments}`} />
    </div>
  );
}
