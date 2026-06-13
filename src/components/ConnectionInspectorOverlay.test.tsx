import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConnectionInspectorOverlay } from "./ConnectionInspectorOverlay";

import type {
  ConnectionInspectorConnection,
  ConnectionInspectorModel,
  ConnectionInspectorStrand,
} from "@/features/report/connectionInspectorModel";
import type { FiberEndpoint } from "@/types/splice";

function endpoint(
  cable: string,
  csvColumn: "from" | "to",
  tubeColor: "BL" | "OR",
  fiberNumber: number,
  fiberColor: "BL" | "OR",
): FiberEndpoint {
  return {
    device: "Device",
    cable,
    csvColumn,
    tubeColor,
    fiberNumber,
    fiberColor,
  };
}

function strand(
  key: string,
  side: "left" | "right",
  cable: string,
  csvColumn: "from" | "to",
  tubeColor: "BL" | "OR",
  fiberNumber: number,
  fiberColor: "BL" | "OR",
  connectionIds: string[],
): ConnectionInspectorStrand {
  return {
    key,
    side,
    cable,
    csvColumn,
    tubeColor,
    fiberNumber,
    fiberColor,
    inferred: false,
    connectionIds,
  };
}

function createModel(): ConnectionInspectorModel {
  const connections: ConnectionInspectorConnection[] = [
    {
      connectionId: "pair-1",
      left: endpoint("LEFT-A", "from", "BL", 1, "BL"),
      right: endpoint("RIGHT-B", "to", "BL", 1, "BL"),
      leftInferred: false,
      rightInferred: false,
      leftStrandKey: "left-1",
      rightStrandKey: "right-1",
      circuitName: "Circuit-1",
    },
    {
      connectionId: "pair-2",
      left: endpoint("LEFT-A", "from", "OR", 2, "OR"),
      right: endpoint("RIGHT-C", "to", "OR", 2, "OR"),
      leftInferred: false,
      rightInferred: false,
      leftStrandKey: "left-2",
      rightStrandKey: "right-2",
      circuitName: "Circuit-2",
      existing: true,
    },
  ];

  const strandByKey = new Map<string, ConnectionInspectorStrand>([
    ["left-1", strand("left-1", "left", "LEFT-A", "from", "BL", 1, "BL", ["pair-1"])],
    ["left-2", strand("left-2", "left", "LEFT-A", "from", "OR", 2, "OR", ["pair-2"])],
    ["right-1", strand("right-1", "right", "RIGHT-B", "to", "BL", 1, "BL", ["pair-1"])],
    ["right-2", strand("right-2", "right", "RIGHT-C", "to", "OR", 2, "OR", ["pair-2"])],
  ]);

  return {
    connections,
    connectionById: new Map(connections.map((connection) => [connection.connectionId, connection])),
    strandByKey,
    connectionIdsByStrandKey: new Map([
      ["left-1", ["pair-1"]],
      ["left-2", ["pair-2"]],
      ["right-1", ["pair-1"]],
      ["right-2", ["pair-2"]],
    ]),
    cableNamesBySide: {
      left: ["LEFT-A"],
      right: ["RIGHT-B", "RIGHT-C"],
    },
    strandKeysByCableSide: {
      left: new Map([["LEFT-A", ["left-1", "left-2"]]]),
      right: new Map([
        ["RIGHT-B", ["right-1"]],
        ["RIGHT-C", ["right-2"]],
      ]),
    },
  };
}

describe("ConnectionInspectorOverlay", () => {
  const noop = () => undefined;

  it("does not render when closed", () => {
    render(
      <ConnectionInspectorOverlay open={false} model={createModel()} onClose={noop} />,
    );
    expect(screen.queryByRole("dialog", { name: "Connection inspector" })).not.toBeInTheDocument();
  });

  it("clicking a connection row highlights matching left/right strands", () => {
    render(<ConnectionInspectorOverlay open model={createModel()} onClose={noop} />);

    const connectionRow = screen.getByRole("option", {
      name: /LEFT-A BL #1 BL -> RIGHT-B BL #1 BL/,
    });
    fireEvent.click(connectionRow);

    expect(connectionRow).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Left cable")).toHaveValue("LEFT-A");
    expect(screen.getByLabelText("Right cable")).toHaveValue("RIGHT-B");

    const leftStrand = screen.getByRole("option", {
      name: /Left LEFT-A BL #1 BL/,
    });
    const rightStrand = screen.getByRole("option", {
      name: /Right RIGHT-B BL #1 BL/,
    });
    expect(leftStrand).toHaveAttribute("aria-selected", "true");
    expect(rightStrand).toHaveAttribute("aria-selected", "true");
  });

  it("clicking a side strand highlights related connection rows", () => {
    render(<ConnectionInspectorOverlay open model={createModel()} onClose={noop} />);

    fireEvent.change(screen.getByLabelText("Right cable"), {
      target: { value: "RIGHT-C" },
    });

    const rightStrand = screen.getByRole("option", {
      name: /Right RIGHT-C OR #2 OR/,
    });
    fireEvent.click(rightStrand);

    const pair1 = screen.getByRole("option", {
      name: /LEFT-A BL #1 BL -> RIGHT-B BL #1 BL/,
    });
    const pair2 = screen.getByRole("option", {
      name: /LEFT-A OR #2 OR -> RIGHT-C OR #2 OR/,
    });
    expect(pair1).toHaveAttribute("aria-selected", "false");
    expect(pair2).toHaveAttribute("aria-selected", "true");
  });
});
