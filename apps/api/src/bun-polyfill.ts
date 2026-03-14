import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

if (typeof globalThis.Bun === "undefined") {
  (globalThis as any).Bun = {
    file(pathOrUrl: string | URL) {
      const filePath =
        pathOrUrl instanceof URL
          ? fileURLToPath(pathOrUrl)
          : typeof pathOrUrl === "string" && pathOrUrl.startsWith("file://")
            ? fileURLToPath(pathOrUrl)
            : pathOrUrl;
      return {
        async exists() {
          return existsSync(filePath);
        },
        async text() {
          try {
            return readFileSync(filePath, "utf-8");
          } catch {
            return "";
          }
        },
      };
    },
    async write(pathOrUrl: string | URL, content: string) {
      const filePath =
        pathOrUrl instanceof URL
          ? fileURLToPath(pathOrUrl)
          : typeof pathOrUrl === "string" && pathOrUrl.startsWith("file://")
            ? fileURLToPath(pathOrUrl)
            : pathOrUrl;
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, content, "utf-8");
    },
  };
}
