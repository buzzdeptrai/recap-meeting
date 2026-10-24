import type { AuthService } from "@recap/auth";
import { checkPasswordPolicy, hashPassword } from "@recap/auth";
import type { Repositories, StoredUser, UserRole } from "@recap/db";
import { z } from "zod";
import { ServiceError } from "./service-error";

const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_PASSWORD = 256;

const nameSchema = z.string().trim().min(1, "Tên không được để trống").max(MAX_NAME);
const roleSchema = z.enum(["admin", "member"]);

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Email không hợp lệ").max(MAX_EMAIL)),
  name: nameSchema,
  role: roleSchema.default("member"),
  /** Omit to get a generated one-time password. */
  password: z.string().max(MAX_PASSWORD).optional(),
});

export const patchUserSchema = z
  .object({
    name: nameSchema.optional(),
    role: roleSchema.optional(),
    disabled: z.boolean().optional(),
    resetPassword: z.literal(true).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Không có gì để cập nhật");

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type PatchUserInput = z.infer<typeof patchUserSchema>;

export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  disabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

/** Never includes the password hash. */
export const toUserDto = (user: StoredUser): UserDto => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  disabled: user.disabled,
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt,
});

export interface UsersDeps {
  repos: Pick<Repositories, "users" | "sessions">;
  auth: AuthService;
}

export const listUsers = ({ repos }: UsersDeps): UserDto[] => repos.users.list().map(toUserDto);

export async function createUser(
  deps: UsersDeps,
  input: CreateUserInput,
): Promise<{ user: UserDto; tempPassword?: string }> {
  const { repos, auth } = deps;
  if (repos.users.getByEmail(input.email)) {
    throw new ServiceError(409, "EMAIL_TAKEN", "Email này đã được dùng.");
  }
  const generated = input.password === undefined ? auth.generateTempPassword() : undefined;
  const password = input.password ?? (generated as string);
  const problem = checkPasswordPolicy(password);
  if (problem) throw new ServiceError(400, "VALIDATION", problem);
  const user = repos.users.create({
    email: input.email,
    name: input.name,
    role: input.role,
    passwordHash: await hashPassword(password),
  });
  return { user: toUserDto(user), ...(generated ? { tempPassword: generated } : {}) };
}

/** Guards: nobody locks themselves out, and at least one enabled admin always remains. */
function assertSafeChange(
  deps: UsersDeps,
  actorId: string,
  target: StoredUser,
  patch: PatchUserInput,
) {
  const demotes = patch.role === "member" && target.role === "admin";
  const disables = patch.disabled === true && !target.disabled;
  if (!demotes && !disables) return;
  if (target.id === actorId) {
    throw new ServiceError(409, "SELF_LOCKOUT", "Bạn không thể tự khóa hoặc hạ quyền chính mình.");
  }
  const removesActiveAdmin = target.role === "admin" && !target.disabled;
  if (removesActiveAdmin && deps.repos.users.countActiveAdmins() <= 1) {
    throw new ServiceError(409, "LAST_ADMIN", "Phải còn ít nhất một quản trị viên đang hoạt động.");
  }
}

export async function updateUser(
  deps: UsersDeps,
  actorId: string,
  id: string,
  patch: PatchUserInput,
): Promise<{ user: UserDto; tempPassword?: string }> {
  const { repos, auth } = deps;
  const target = repos.users.getById(id);
  if (!target) throw new ServiceError(404, "NOT_FOUND", "Không tìm thấy người dùng này.");
  assertSafeChange(deps, actorId, target, patch);

  if (patch.name !== undefined) repos.users.setName(id, patch.name);
  if (patch.role !== undefined) repos.users.setRole(id, patch.role);
  if (patch.disabled !== undefined) {
    repos.users.setDisabled(id, patch.disabled);
    if (patch.disabled) repos.sessions.deleteForUser(id);
  }
  let tempPassword: string | undefined;
  if (patch.resetPassword) {
    tempPassword = auth.generateTempPassword();
    await auth.resetPassword(id, tempPassword);
  }
  const updated = repos.users.getById(id) as StoredUser;
  return { user: toUserDto(updated), ...(tempPassword ? { tempPassword } : {}) };
}
