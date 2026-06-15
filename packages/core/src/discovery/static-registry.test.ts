import { describe, expect, it } from "vitest";
import { StaticRegistry } from "./static-registry.js";

describe("StaticRegistry", () => {
  it("returns endpoints by service name", () => {
    const registry = new StaticRegistry({
      UserService: [
        { host: "127.0.0.1", port: 4000 },
        { host: "127.0.0.1", port: 4001 },
      ],
    });

    expect(registry.lookup("UserService")).toEqual([
      { host: "127.0.0.1", port: 4000 },
      { host: "127.0.0.1", port: 4001 },
    ]);
  });

  it("returns empty array when service is unknown", () => {
    const registry = new StaticRegistry({});

    expect(registry.lookup("MissingService")).toEqual([]);
  });
});