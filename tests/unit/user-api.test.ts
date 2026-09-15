import { describe, expect, it, vi } from "vitest";
import { fetchSleeperUser } from "../../src/sleeper/user-api";

describe("Sleeper user API", () => {
  it("resolves and normalizes a Sleeper username", async () => {
    const fetchMock = vi.fn(async () =>
      response({ user_id: "123", username: "manager", display_name: "Draft Manager" }),
    );

    await expect(fetchSleeperUser(" manager ", fetchMock as typeof fetch)).resolves.toEqual({
      userId: "123",
      username: "manager",
      displayName: "Draft Manager",
    });
    expect(fetchMock).toHaveBeenCalledWith("https://api.sleeper.app/v1/user/manager", {
      method: "GET",
      cache: "no-store",
    });
  });

  it("rejects an empty username without making a request", async () => {
    const fetchMock = vi.fn();
    await expect(fetchSleeperUser("   ", fetchMock as typeof fetch)).rejects.toThrow(
      "Enter a Sleeper username.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("provides a useful not-found error", async () => {
    const fetchMock = vi.fn(async () => response({}, false, 404));
    await expect(fetchSleeperUser("missing", fetchMock as typeof fetch)).rejects.toThrow(
      "Sleeper could not find that username.",
    );
  });
});

function response(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}
