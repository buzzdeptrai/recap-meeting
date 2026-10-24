import { describe, expect, it } from "vitest";
import { checkSameOrigin } from "./http";

const post = (headers: Record<string, string>) =>
  new Request("http://localhost:3000/api/meetings", { method: "POST", headers });

describe("checkSameOrigin", () => {
  it("allows requests without Origin and with a matching Origin", () => {
    expect(checkSameOrigin(post({}))).toBeNull();
    expect(
      checkSameOrigin(post({ origin: "http://localhost:3000", host: "localhost:3000" })),
    ).toBeNull();
  });

  it("refuses a foreign or malformed Origin with 403", async () => {
    for (const origin of ["https://evil.example", "not a url", "null"]) {
      const response = checkSameOrigin(post({ origin, host: "localhost:3000" }));
      expect(response?.status).toBe(403);
    }
  });
});
