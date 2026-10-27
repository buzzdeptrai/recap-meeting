import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { migrations } from "../src";

/**
 * Applied migrations are immutable: editing one desyncs every existing database (the runner skips
 * recorded versions). Changing SQL must be a NEW numbered migration. Add pins for new migrations here
 * (optional); never update an existing hash.
 */
const PINNED_SHA256: Record<number, string> = {
  1: "56b990a8c65ec08769603a302de723ce7458cb651947b72e6b64431f56d1903b",
  2: "df07ee466ea87e75aef01dfc8f47faf44a6bff658a38d70447657a4a291f8c1f",
  3: "d46cfa0ec5f9427f4cb87823c09ca316e49f99f8f72ef7c0c7a6e4f589caa579",
  4: "daf433f5b4569365a3bd6a7c3be39a4db3c72987d690ca665907eee9548e3cee",
  6: "85f4e74af0b8f9cb86288906ee5036be3f948f771411ef52bdc35643b4d8253d",
  7: "8b4d88092fbf096687efd6190fcac15de3ccdf606a8119d1219ea57790de69b1",
  10: "88943a86db18083c729cf56cb33be4a63071a971e31bb7a6ce794262ea94deff",
  11: "0f825029a1c0f462e09d17fc17af32978c4f8b8e4a874bfcf5b8f4688cb74510",
  12: "1db116fd2cae6115fffcfb58b15d90de71436d7c0793c33da1328af291df07fd",
  13: "ad4ca7ae490ff9b9d2a68c1af40e1044537ff74d68110d75e5816dd952f9f747",
};

const sha = (sql: string) => createHash("sha256").update(sql).digest("hex");

describe("migration checksums", () => {
  it("never changes an already pinned migration", () => {
    for (const migration of migrations) {
      const pinned = PINNED_SHA256[migration.version];
      if (pinned) expect(sha(migration.sql), `migration ${migration.version}`).toBe(pinned);
    }
  });
});
