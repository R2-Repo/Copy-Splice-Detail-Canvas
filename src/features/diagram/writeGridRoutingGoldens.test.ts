import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "vitest";

import { characterizeReferenceCsv } from "./routingCharacterization";

const examplesDir = join(process.cwd(), "docs/reference/examples");
const files = [
  "Left-SP-3254.5.csv",
  "Left-STATE_OFFICE.csv",
  "Left-SPI-215_I-80.csv",
] as const;

/** Regenerate: `UPDATE_GRID_GOLDENS=1 npx vitest run writeGridRoutingGoldens` */
describe("grid routing golden writer", () => {
  it.runIf(process.env.UPDATE_GRID_GOLDENS === "1")(
    "writes routingCharacterization.grid.json",
    () => {
      const out: Record<string, ReturnType<typeof characterizeReferenceCsv>> =
        {};
      for (const file of files) {
        out[file] = characterizeReferenceCsv(examplesDir, file, "grid");
      }
      writeFileSync(
        join(
          process.cwd(),
          "src/features/diagram/__goldens__/routingCharacterization.grid.json",
        ),
        `${JSON.stringify(out, null, 2)}\n`,
      );
    },
  );
});
