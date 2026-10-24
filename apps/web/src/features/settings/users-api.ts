/** Client for C1's `/api/users` routes (admin only). Error bodies are `{error:{message}}`. */
export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
  disabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface UserMutation {
  user: UserRow;
  tempPassword?: string;
}

export class UsersApiError extends Error {}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
  } catch {
    throw new UsersApiError("Không gọi được máy chủ.");
  }
  const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!response.ok) throw new UsersApiError(body.error?.message ?? `Lỗi ${response.status}.`);
  return body as T;
}

export const fetchUsers = async () => (await call<{ users: UserRow[] }>("/api/users")).users;

export const createUser = (input: {
  email: string;
  name: string;
  role: "admin" | "member";
  password?: string;
}) => call<UserMutation>("/api/users", { method: "POST", body: JSON.stringify(input) });

export const patchUser = (
  id: string,
  patch: { name?: string; role?: "admin" | "member"; disabled?: boolean; resetPassword?: true },
) => call<UserMutation>(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
