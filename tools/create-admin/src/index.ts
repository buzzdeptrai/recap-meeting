/**
 * Usage: npm run create-admin -- --email <email> --name <name>
 *
 * The password is read from the terminal with echo disabled (asked twice). For non-interactive
 * use set RECAP_ADMIN_PASSWORD. The password is never printed or logged.
 */
import { parseArgs } from "node:util";
import { dbPathFromEnv, loadRootEnv } from "@recap/core/node";
import { createRepositories, openDatabase } from "@recap/db";
import { createOrUpdateAdmin } from "./create-admin";
import { readHidden } from "./prompt";

const USAGE = "Usage: npm run create-admin -- --email <email> --name <name>";

async function obtainPassword(): Promise<string> {
  const fromEnv = process.env.RECAP_ADMIN_PASSWORD;
  if (fromEnv) return fromEnv;
  const first = await readHidden("Mật khẩu (tối thiểu 10 ký tự): ");
  const second = await readHidden("Nhập lại mật khẩu: ");
  if (first !== second) throw new Error("Hai lần nhập mật khẩu không khớp.");
  return first;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { email: { type: "string" }, name: { type: "string" }, help: { type: "boolean" } },
  });
  if (values.help || !values.email || !values.name) {
    console.log(USAGE);
    process.exit(values.help ? 0 : 1);
  }
  loadRootEnv();
  const password = await obtainPassword();
  const db = openDatabase(dbPathFromEnv());
  try {
    const result = await createOrUpdateAdmin(createRepositories(db), {
      email: values.email,
      name: values.name,
      password,
    });
    console.log(
      `Đã ${result.action === "created" ? "tạo" : "cập nhật"} quản trị viên ${result.email}.`,
    );
  } finally {
    db.close();
  }
}

main().catch((error: unknown) => {
  console.error(`create-admin: ${error instanceof Error ? error.message : "lỗi không xác định"}`);
  process.exit(1);
});
