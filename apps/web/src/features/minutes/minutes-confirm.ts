import type { MinutesLang, MinutesTopic } from "@recap/core";
import { langName, otherMinutesLang } from "./minutes-langs";

export type Confirm =
  | { kind: "regenerate" }
  | { kind: "retranslate" }
  | { kind: "lang"; lang: MinutesLang }
  | { kind: "topic"; topic: MinutesTopic };

export interface ConfirmCopy {
  title: string;
  description: string;
  action: string;
  destructive: boolean;
}

export interface ConfirmContext {
  /** Language of the open tab. */
  lang: MinutesLang;
  /** Source language picked in the regenerate dialog. */
  sourceLang: MinutesLang;
  /** The other language already has minutes (a different source would replace them). */
  otherExists: boolean;
}

function regenerateDescription({ lang, sourceLang, otherExists }: ConfirmContext): string {
  const target = otherMinutesLang(sourceLang);
  const parts = [
    `Biên bản ${langName(sourceLang)} mới sẽ thay thế bản hiện tại. Mọi chỉnh sửa của bạn trong bản đó sẽ mất.`,
    `Sau đó bản ${langName(target)} được dịch lại tự động.`,
  ];
  if (sourceLang !== lang && otherExists) {
    parts.unshift(`Bản ${langName(sourceLang)} đang có sẽ bị thay bằng biên bản mới.`);
  }
  return parts.join(" ");
}

/** Dialog copy for each confirmation. */
export function describeConfirm(confirm: Confirm, context: ConfirmContext): ConfirmCopy {
  switch (confirm.kind) {
    case "regenerate":
      return {
        title: "Tạo lại biên bản?",
        description: regenerateDescription(context),
        action: "Tạo lại",
        destructive: true,
      };
    case "retranslate":
      return {
        title: "Dịch lại và ghi đè?",
        description:
          "Bạn đã chỉnh sửa bản dịch này. Dịch lại sẽ thay bằng bản dịch mới từ bản gốc và các chỉnh sửa của bạn sẽ mất.",
        action: "Dịch lại",
        destructive: true,
      };
    case "lang":
      return {
        title: "Bỏ thay đổi chưa lưu?",
        description: "Bạn có chỉnh sửa chưa lưu. Chuyển ngôn ngữ sẽ bỏ các chỉnh sửa này.",
        action: "Bỏ và chuyển",
        destructive: true,
      };
    case "topic":
      return {
        title: "Xóa chủ đề này?",
        description: "Các ý chính và kết luận của chủ đề sẽ bị xóa khỏi biên bản.",
        action: "Xóa chủ đề",
        destructive: true,
      };
  }
}
