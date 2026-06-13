import { useEffect, useMemo, useState } from "react";

import { colorHex, needsFiberContrastOutlineHex } from "@/features/diagram/colorCode";
import type {
  ConnectionInspectorConnection,
  ConnectionInspectorModel,
  ConnectionInspectorSide,
  ConnectionInspectorStrand,
} from "@/features/report/connectionInspectorModel";

type ConnectionInspectorOverlayProps = {
  open: boolean;
  model: ConnectionInspectorModel | null;
  onClose: () => void;
};

type TubeGroup = {
  tubeColor: string;
  strands: ConnectionInspectorStrand[];
};

function groupByTube(
  strands: ConnectionInspectorStrand[],
): TubeGroup[] {
  const groups = new Map<string, ConnectionInspectorStrand[]>();
  strands.forEach((strand) => {
    const list = groups.get(strand.tubeColor) ?? [];
    list.push(strand);
    groups.set(strand.tubeColor, list);
  });
  return [...groups.entries()].map(([tubeColor, tubeStrands]) => ({
    tubeColor,
    strands: tubeStrands,
  }));
}

function strandCodeLabel(strand: ConnectionInspectorStrand): string {
  const inferred = strand.inferred ? "*" : "";
  return `#${strand.fiberNumber} ${strand.fiberColor}${inferred}`;
}

function endpointCodeLabel(
  endpoint: ConnectionInspectorConnection["left"],
  inferred: boolean,
): string {
  const star = inferred ? "*" : "";
  return `#${endpoint.fiberNumber} ${endpoint.fiberColor}${star}`;
}

function connectionSummary(connection: ConnectionInspectorConnection): string {
  const existing = connection.existing ? " [existing]" : "";
  const fullButt = connection.fullButt ? " [full butt]" : "";
  return `${connection.left.cable} ${connection.left.tubeColor} ${endpointCodeLabel(connection.left, connection.leftInferred)} -> ${connection.right.cable} ${connection.right.tubeColor} ${endpointCodeLabel(connection.right, connection.rightInferred)}${existing}${fullButt}`;
}

function strandHighlight(
  strand: ConnectionInspectorStrand,
  activeConnectionIds: ReadonlySet<string>,
): boolean {
  return strand.connectionIds.some((id) => activeConnectionIds.has(id));
}

function strandsForCable(
  model: ConnectionInspectorModel,
  side: ConnectionInspectorSide,
  cable: string,
): ConnectionInspectorStrand[] {
  const keys = model.strandKeysByCableSide[side].get(cable) ?? [];
  return keys
    .map((key) => model.strandByKey.get(key))
    .filter((strand): strand is ConnectionInspectorStrand => strand != null);
}

export function ConnectionInspectorOverlay({
  open,
  model,
  onClose,
}: ConnectionInspectorOverlayProps) {
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(
    null,
  );
  const [selectedStrandKey, setSelectedStrandKey] = useState<string | null>(null);
  const [selectedLeftCable, setSelectedLeftCable] = useState("");
  const [selectedRightCable, setSelectedRightCable] = useState("");

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !model) return;
    setSelectedConnectionId(null);
    setSelectedStrandKey(null);
    setSelectedLeftCable((current) =>
      model.cableNamesBySide.left.includes(current)
        ? current
        : (model.cableNamesBySide.left[0] ?? ""),
    );
    setSelectedRightCable((current) =>
      model.cableNamesBySide.right.includes(current)
        ? current
        : (model.cableNamesBySide.right[0] ?? ""),
    );
  }, [open, model]);

  const activeConnectionIds = useMemo(() => {
    if (!model) return new Set<string>();
    if (selectedConnectionId) return new Set([selectedConnectionId]);
    if (selectedStrandKey) {
      return new Set(model.connectionIdsByStrandKey.get(selectedStrandKey) ?? []);
    }
    return new Set<string>();
  }, [model, selectedConnectionId, selectedStrandKey]);

  const leftStrands = useMemo(
    () =>
      model && selectedLeftCable
        ? strandsForCable(model, "left", selectedLeftCable)
        : [],
    [model, selectedLeftCable],
  );
  const rightStrands = useMemo(
    () =>
      model && selectedRightCable
        ? strandsForCable(model, "right", selectedRightCable)
        : [],
    [model, selectedRightCable],
  );

  const leftTubes = useMemo(() => groupByTube(leftStrands), [leftStrands]);
  const rightTubes = useMemo(() => groupByTube(rightStrands), [rightStrands]);

  const selectConnection = (connection: ConnectionInspectorConnection) => {
    setSelectedConnectionId(connection.connectionId);
    setSelectedStrandKey(null);
    setSelectedLeftCable(connection.left.cable);
    setSelectedRightCable(connection.right.cable);
  };

  if (!open) return null;

  return (
    <div
      className="connection-inspector-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Connection inspector"
    >
      <div className="connection-inspector-overlay__backdrop" onClick={onClose} />
      <div className="connection-inspector-overlay__panel">
        <header className="connection-inspector-overlay__header">
          <h2 className="connection-inspector-overlay__title">Connection inspector</h2>
          <div className="connection-inspector-overlay__actions">
            <button
              type="button"
              className="csv-import__button csv-import__button--secondary"
              onClick={() => {
                setSelectedConnectionId(null);
                setSelectedStrandKey(null);
              }}
            >
              Clear highlight
            </button>
            <button type="button" className="csv-import__button" onClick={onClose}>
              Close
            </button>
          </div>
        </header>

        {!model || model.connections.length === 0 ? (
          <div className="connection-inspector-overlay__empty">
            Import a CSV to inspect connections.
          </div>
        ) : (
          <div className="connection-inspector">
            <section className="connection-inspector__panel connection-inspector__panel--left">
              <div className="connection-inspector__panel-header">
                <h3>Left side</h3>
                <label className="connection-inspector__select-wrap">
                  <span>Left cable</span>
                  <select
                    aria-label="Left cable"
                    value={selectedLeftCable}
                    onChange={(event) => setSelectedLeftCable(event.target.value)}
                  >
                    {model.cableNamesBySide.left.map((cable) => (
                      <option key={cable} value={cable}>
                        {cable}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="connection-inspector__strand-scroll">
                {leftTubes.map((tube) => (
                  <div key={`left-${tube.tubeColor}`} className="connection-inspector__tube-group">
                    <h4 className="connection-inspector__tube-title">{tube.tubeColor}</h4>
                    <div className="connection-inspector__strand-list" role="listbox" aria-label={`Left ${tube.tubeColor} strands`}>
                      {tube.strands.map((strand) => {
                        const highlighted = strandHighlight(strand, activeConnectionIds);
                        const swatch = colorHex(strand.fiberColor);
                        return (
                          <button
                            key={strand.key}
                            type="button"
                            role="option"
                            aria-selected={highlighted}
                            className={`connection-inspector__strand${highlighted ? " connection-inspector__strand--active" : ""}`}
                            onClick={() => {
                              setSelectedConnectionId(null);
                              setSelectedStrandKey(strand.key);
                            }}
                            aria-label={`Left ${strand.cable} ${strand.tubeColor} ${strandCodeLabel(strand)}`}
                          >
                            <span
                              className="connection-inspector__swatch"
                              style={{
                                background: swatch,
                                borderColor: needsFiberContrastOutlineHex(swatch)
                                  ? "#0f172a"
                                  : "rgba(15, 23, 42, 0.2)",
                              }}
                            />
                            <span className="connection-inspector__strand-text">
                              {strandCodeLabel(strand)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="connection-inspector__panel connection-inspector__panel--center">
              <div className="connection-inspector__panel-header">
                <h3>Connections</h3>
                <span className="connection-inspector__count">
                  {model.connections.length} total
                </span>
              </div>
              <div className="connection-inspector__connections" role="listbox" aria-label="Connection rows">
                {model.connections.map((connection) => {
                  const highlighted = activeConnectionIds.has(connection.connectionId);
                  return (
                    <button
                      key={connection.connectionId}
                      type="button"
                      role="option"
                      aria-selected={highlighted}
                      className={`connection-inspector__connection${highlighted ? " connection-inspector__connection--active" : ""}`}
                      onClick={() => selectConnection(connection)}
                      aria-label={connectionSummary(connection)}
                    >
                      <div className="connection-inspector__connection-main">
                        <span>{connection.left.cable}</span>
                        <span className="connection-inspector__arrow" aria-hidden>
                          →
                        </span>
                        <span>{connection.right.cable}</span>
                      </div>
                      <div className="connection-inspector__connection-sub">
                        <span>
                          {connection.left.tubeColor}{" "}
                          {endpointCodeLabel(connection.left, connection.leftInferred)}
                        </span>
                        <span aria-hidden>·</span>
                        <span>
                          {connection.right.tubeColor}{" "}
                          {endpointCodeLabel(connection.right, connection.rightInferred)}
                        </span>
                        {connection.existing ? (
                          <>
                            <span aria-hidden>·</span>
                            <span className="connection-inspector__badge">existing</span>
                          </>
                        ) : null}
                        {connection.fullButt ? (
                          <>
                            <span aria-hidden>·</span>
                            <span className="connection-inspector__badge">full butt</span>
                          </>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="connection-inspector__panel connection-inspector__panel--right">
              <div className="connection-inspector__panel-header">
                <h3>Right side</h3>
                <label className="connection-inspector__select-wrap">
                  <span>Right cable</span>
                  <select
                    aria-label="Right cable"
                    value={selectedRightCable}
                    onChange={(event) => setSelectedRightCable(event.target.value)}
                  >
                    {model.cableNamesBySide.right.map((cable) => (
                      <option key={cable} value={cable}>
                        {cable}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="connection-inspector__strand-scroll">
                {rightTubes.map((tube) => (
                  <div key={`right-${tube.tubeColor}`} className="connection-inspector__tube-group">
                    <h4 className="connection-inspector__tube-title">{tube.tubeColor}</h4>
                    <div className="connection-inspector__strand-list" role="listbox" aria-label={`Right ${tube.tubeColor} strands`}>
                      {tube.strands.map((strand) => {
                        const highlighted = strandHighlight(strand, activeConnectionIds);
                        const swatch = colorHex(strand.fiberColor);
                        return (
                          <button
                            key={strand.key}
                            type="button"
                            role="option"
                            aria-selected={highlighted}
                            className={`connection-inspector__strand${highlighted ? " connection-inspector__strand--active" : ""}`}
                            onClick={() => {
                              setSelectedConnectionId(null);
                              setSelectedStrandKey(strand.key);
                            }}
                            aria-label={`Right ${strand.cable} ${strand.tubeColor} ${strandCodeLabel(strand)}`}
                          >
                            <span
                              className="connection-inspector__swatch"
                              style={{
                                background: swatch,
                                borderColor: needsFiberContrastOutlineHex(swatch)
                                  ? "#0f172a"
                                  : "rgba(15, 23, 42, 0.2)",
                              }}
                            />
                            <span className="connection-inspector__strand-text">
                              {strandCodeLabel(strand)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
