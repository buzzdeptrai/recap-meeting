import {
  ChartBar,
  Flag,
  Gear,
  Microphone,
  Plus,
  SpeakerHigh,
  Trash,
} from "@phosphor-icons/react/dist/ssr";
import {
  Badge,
  Banner,
  Bubble,
  Button,
  Card,
  CardHeader,
  Dialog,
  DropdownMenu,
  Chip,
  EmptyState,
  Field,
  FloatCard,
  FloatingActionBar,
  IconBadge,
  IconTile,
  Input,
  Kbd,
  LevelMeter,
  PageHeader,
  PillTabs,
  Pill,
  ProgressBar,
  SegmentedControl,
  Skeleton,
  Sparkline,
  StatTile,
  StatusDot,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  type Tone,
} from "../src";

const TONES: Tone[] = ["main", "blue", "orange", "green", "red", "dark"];

export function KitPage() {
  return (
    <>
      <PageHeader breadcrumb={["Quản trị", "Bộ thành phần"]} title="Bộ thành phần" />
      <div className="grid grid-cols-12 gap-6 max-[640px]:gap-4">
        <Card className="col-span-6 max-[1100px]:col-span-12">
          <CardHeader
            title="Nút bấm"
            description="primary, outline, ghost, danger; sm, md, lg; đang tải"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button>Lưu thay đổi</Button>
            <Button variant="outline">Hủy</Button>
            <Button variant="ghost">Bỏ qua</Button>
            <Button variant="danger" size="sm">
              <Trash width={14} />
              Xóa
            </Button>
            <Button size="lg">
              <Plus width={16} />
              Cuộc họp mới
            </Button>
            <Button loading>Đang lưu</Button>
            <Button disabled variant="outline">
              Vô hiệu
            </Button>
          </div>
        </Card>
        <Card className="col-span-6 max-[1100px]:col-span-12">
          <CardHeader
            title="Biểu tượng & trạng thái"
            description="IconTile 6 tông, Badge, Pill, StatusDot"
          />
          <div className="flex flex-wrap items-center gap-3">
            {TONES.map((t) => (
              <IconTile key={t} tone={t}>
                <ChartBar />
              </IconTile>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="ok">Hoàn tất</Badge>
            <Badge variant="rec">Đang ghi</Badge>
            <Badge variant="warn">Chưa có biên bản</Badge>
            <Badge variant="error">Lỗi</Badge>
            <Badge shape="chip" variant="accent">
              VI
            </Badge>
            <Badge shape="chip" variant="cyan">
              EN
            </Badge>
            <Pill>ví dụ</Pill>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-5 text-[13px]">
            {(["ok", "warn", "bad", "rec", "idle"] as const).map((s) => (
              <span key={s} className="flex items-center gap-2">
                <StatusDot status={s} />
                {s}
              </span>
            ))}
          </div>
        </Card>
        <Card className="col-span-6 max-[1100px]:col-span-12">
          <CardHeader
            title="Điều khiển"
            description="SegmentedControl, Tabs, Tooltip, Menu, Dialog"
          />
          <div className="flex flex-wrap items-center gap-4">
            <SegmentedControl
              ariaLabel="Khoảng"
              value="b"
              onValueChange={() => {}}
              options={[
                { value: "a", label: "7 ngày" },
                { value: "b", label: "30 ngày" },
              ]}
            />
            <Tabs defaultValue="vi">
              <TabsList>
                <TabsTrigger value="vi">Tiếng Việt</TabsTrigger>
                <TabsTrigger value="en">English</TabsTrigger>
              </TabsList>
              <TabsContent value="vi">Nội dung VI</TabsContent>
              <TabsContent value="en">EN content</TabsContent>
            </Tabs>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Tooltip content="Cài đặt">
              <Button variant="outline" size="icon" aria-label="Cài đặt">
                <Gear />
              </Button>
            </Tooltip>
            <DropdownMenu
              trigger={<Button variant="outline">Tài khoản</Button>}
              items={[
                { id: "p", label: "Hồ sơ" },
                { id: "o", label: "Đăng xuất", tone: "danger" },
              ]}
            />
            <Dialog
              trigger={<Button variant="outline">Mở hộp thoại</Button>}
              title="Xóa cuộc họp?"
              description="Thao tác này không thể hoàn tác."
              footer={
                <>
                  <Button variant="outline">Hủy</Button>
                  <Button variant="danger">Xóa</Button>
                </>
              }
            />
          </div>
        </Card>
        <Card className="col-span-6 max-[1100px]:col-span-12">
          <CardHeader title="Biểu mẫu" description="Field, Input (bình thường và lỗi)" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tên cuộc họp" hint="Hiện trên biên bản">
              <Input placeholder="Rà soát hợp đồng" />
            </Field>
            <Field label="Email" error="Email không hợp lệ">
              <Input defaultValue="abc@" />
            </Field>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold text-soft-muted">ProgressBar</p>
              <ProgressBar value={64} label="64%" />
              <ProgressBar className="mt-3" tone="blue" value={30} label="30%" />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-soft-muted">Sparkline</p>
              <Sparkline values={[1, 3, 2, 4, 3, 6, 5, 7]} width={180} height={40} />
            </div>
          </div>
        </Card>
        <Card className="col-span-6 max-[1100px]:col-span-12">
          <CardHeader title="Trạng thái rỗng" />
          <EmptyState
            icon={<ChartBar />}
            title="Chưa có dữ liệu sử dụng"
            description="Dữ liệu sẽ xuất hiện sau cuộc họp đầu tiên."
            action={<Button size="sm">Tạo cuộc họp</Button>}
          />
        </Card>
        <Card className="col-span-6 max-[1100px]:col-span-12">
          <CardHeader title="Đang tải" description="Skeleton" />
          <div className="space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-24 w-full" />
          </div>
        </Card>
      </div>
      <h2 className="mt-8 mb-4 text-lg font-bold text-soft-ink">v2: thẻ nổi</h2>
      <div className="grid grid-cols-12 gap-6 rounded-soft-card bg-soft-page p-6 max-[640px]:gap-4 max-[640px]:p-3">
        <FloatCard
          className="col-span-7 max-[1100px]:col-span-12"
          header={
            <PillTabs
              ariaLabel="Ví dụ"
              idBase="demo"
              tabs={[
                { id: "a", label: "Mục A", count: 2 },
                { id: "b", label: "Mục B", count: 3, countTone: "decision" },
                { id: "c", label: "Mục C", disabled: true, disabledReason: "Chưa có dữ liệu" },
              ]}
            />
          }
        >
          <div className="relative flex min-h-[320px] flex-col gap-4 pb-20">
            <Bubble tone="tone-a">Nội dung dòng a</Bubble>
            <Bubble tone="tone-b">Nội dung dòng b</Bubble>
            <Bubble tone="dashed">Đang nhập…</Bubble>
            <Bubble tone="tone-a" emphasis="decision">
              Dòng được nhấn mạnh
            </Bubble>
            <FloatingActionBar ariaLabel="Thao tác nhanh" hint="Gợi ý dưới thanh">
              <Button variant="outline" shape="pill" icon={<Flag />}>
                Mục mới <Kbd>T</Kbd>
              </Button>
              <Button variant="outline" shape="pill" disabled>
                Chốt <Kbd>K</Kbd>
              </Button>
            </FloatingActionBar>
          </div>
        </FloatCard>
        <FloatCard className="col-span-5 max-[1100px]:col-span-12" bodyClassName="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Chip>neutral</Chip>
            <Chip tone="outline" size="sm">
              VI
            </Chip>
            <Chip tone="info">info</Chip>
            <Chip tone="ok">ok</Chip>
            <Chip tone="warn">warn</Chip>
            <Chip tone="decision" size="lg" icon={<Flag />}>
              decision
            </Chip>
            <Chip tone="danger">danger</Chip>
          </div>
          <div className="flex items-center gap-3">
            <IconBadge tone="tone-a">
              <Microphone />
            </IconBadge>
            <IconBadge tone="tone-b">
              <SpeakerHigh />
            </IconBadge>
            <IconBadge />
          </div>
          <LevelMeter
            variant="compact"
            label="Kênh a"
            value={4}
            bars={10}
            statusText="ổn"
            statusTone="ok"
            tone="tone-a"
            icon={<Microphone />}
          />
          <LevelMeter
            variant="compact"
            label="Kênh b"
            value={0}
            bars={10}
            statusText="chưa có"
            tone="tone-b"
            icon={<SpeakerHigh />}
            disabled
          />
          <SegmentedControl
            variant="soft"
            ariaLabel="Chế độ"
            value="a"
            onValueChange={() => {}}
            options={[
              { value: "a", label: "Song ngữ" },
              { value: "b", label: "Gốc" },
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Độ trễ" value="0,9" unit="giây" />
            <StatTile label="Đoạn" value="128" />
          </div>
          <Banner tone="warn" radius="lg" onDismiss={() => {}}>
            Cảnh báo olive, có thể đóng.
          </Banner>
        </FloatCard>
      </div>
    </>
  );
}
