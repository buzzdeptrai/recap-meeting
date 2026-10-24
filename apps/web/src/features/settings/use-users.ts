"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchUsers, patchUser, type UserRow } from "./users-api";

export interface TempSecret {
  email: string;
  password: string;
}

export type UserPatch = Parameters<typeof patchUser>[1];

const messageOf = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** Users list + mutations against `/api/users`. Every successful change reloads the list. */
export function useUsers() {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<TempSecret | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    fetchUsers()
      .then((list) => {
        if (!alive) return;
        setUsers(list);
        setError(null);
      })
      .catch((e: unknown) => {
        if (alive) setError(messageOf(e, "Không tải được danh sách."));
      });
    return () => {
      alive = false;
    };
  }, [version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  /** Applies a change and reloads; throws so a confirm dialog can show the failure in place. */
  const apply = useCallback(
    async (user: UserRow, patch: UserPatch) => {
      const result = await patchUser(user.id, patch);
      if (result.tempPassword) setSecret({ email: user.email, password: result.tempPassword });
      reload();
    },
    [reload],
  );

  /** Inline changes (role select): failures go to the panel banner. */
  const mutate = useCallback(
    async (user: UserRow, patch: UserPatch) => {
      try {
        await apply(user, patch);
      } catch (e) {
        setError(messageOf(e, "Không cập nhật được."));
      }
    },
    [apply],
  );

  return { users, error, secret, setSecret, reload, mutate, apply };
}
