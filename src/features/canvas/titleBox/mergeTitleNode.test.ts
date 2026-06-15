import { describe, expect, it } from "vitest";

import { mergeTitleNode } from "@/features/canvas/titleBox/mergeTitleNode";
import { DIAGRAM_TITLE_NODE_ID } from "@/features/canvas/titleBox/titleBoxLayout";

describe("mergeTitleNode", () => {
  it("injects title node with header defaults", () => {
    const nodes = mergeTitleNode(
      [
        {
          id: "cable-a",
          type: "cable",
          position: { x: 24, y: 100 },
          width: 200,
          height: 400,
          data: {},
        },
      ],
      {
        street: "3300 S & 3175 E",
        cityState: "COTTONWOOD HEIGHTS",
        reportDate: "Wed May 20 13:11:52 2026",
        description: "UDOT",
        location: "40.699735 -111.803808",
      },
      1400,
      1,
    );

    expect(nodes).toHaveLength(2);
    const title = nodes.find((n) => n.id === DIAGRAM_TITLE_NODE_ID);
    expect(title?.type).toBe("diagramTitle");
    expect(title?.draggable).toBe(false);
    expect(title?.position.y).toBeLessThan(100);
    expect((title?.data as { street?: string }).street).toBe("3300 S & 3175 E");
    expect((title?.data as { description?: string }).description).toBe("UDOT");
  });

  it("prefers persisted titleBlock overrides", () => {
    const nodes = mergeTitleNode(
      [],
      { description: "from csv" },
      1400,
      1,
      { description: "user edit" },
    );
    const title = nodes[0]!;
    expect((title.data as { description?: string }).description).toBe(
      "user edit",
    );
  });
});
