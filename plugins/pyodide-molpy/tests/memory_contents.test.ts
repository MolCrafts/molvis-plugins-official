import { describe, expect, it } from "@rstest/core";
import { MemoryContentsManager } from "../src/kernel/memory_contents";

describe("MemoryContentsManager", () => {
  it("saves and loads text files", async () => {
    const c = new MemoryContentsManager();
    await c.save("foo/bar.py", {
      type: "file",
      format: "text",
      content: "print(1)\n",
    });
    const model = await c.get("foo/bar.py");
    expect(model.type).toBe("file");
    expect(model.content).toBe("print(1)\n");
  });

  it("lists directory children", async () => {
    const c = new MemoryContentsManager();
    await c.save("pkg/a.py", { type: "file", format: "text", content: "a" });
    await c.save("pkg/b.py", { type: "file", format: "text", content: "b" });
    const dir = await c.get("pkg");
    expect(dir.type).toBe("directory");
    const names = (dir.content as { name: string }[]).map((x) => x.name).sort();
    expect(names).toEqual(["a.py", "b.py"]);
  });
});
