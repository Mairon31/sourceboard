import { describe, expect, it } from "vitest";
import { handleApiRequest } from "../../worker/api";

describe("GET /api/health", () => {
  it("returns a healthy JSON response with the request id", async () => {
    const request = new Request("https://sourceboard.test/api/health", {
      headers: { "x-request-id": "req-health" },
    });

    const response = await handleApiRequest(request);

    expect(response?.status).toBe(200);
    expect(response?.headers.get("content-type")).toContain("application/json");
    expect(response?.headers.get("x-request-id")).toBe("req-health");
    await expect(response?.json()).resolves.toEqual({
      status: "ok",
      service: "sourceboard",
      requestId: "req-health",
    });
  });

  it("returns null for non-api-health requests so React Router can handle them", async () => {
    const response = await handleApiRequest(new Request("https://sourceboard.test/"));
    expect(response).toBeNull();
  });
});
