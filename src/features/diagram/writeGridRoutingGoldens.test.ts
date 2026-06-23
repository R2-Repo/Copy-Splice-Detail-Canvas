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
    "writes routing characterization goldens",
    () => {
      const gridOut: Record<string, ReturnType<typeof characterizeReferenceCsv>> =
        {};
      const nodesOut: Record<string, ReturnType<typeof characterizeReferenceCsv>> =
        {};
      for (const file of files) {
        gridOut[file] = characterizeReferenceCsv(examplesDir, file, "grid");
        nodesOut[file] = characterizeReferenceCsv(examplesDir, file, "nodes");
      }
      writeFileSync(
        join(
          process.cwd(),
          "src/features/diagram/__goldens__/routingCharacterization.grid.json",
        ),
        `${JSON.stringify(gridOut, null, 2)}\n`,
      );
      writeFileSync(
        join(
          process.cwd(),
          "src/features/diagram/__goldens__/routingCharacterization.json",
        ),
        `${JSON.stringify(nodesOut, null, 2)}\n`,
      );
    },
  );
});
