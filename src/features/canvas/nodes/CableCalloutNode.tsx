import { type NodeProps } from "@xyflow/react";
import { useCallback, useEffect, useState } from "react";

import { CALLOUT_BOX } from "@/features/canvas/callouts/cableCalloutGeometry";
import { useCalloutPersist } from "@/features/canvas/callouts/CalloutPersistContext";
import type { CableCalloutNodeData } from "@/features/canvas/nodes/types";

export function CableCalloutNode({ id, data }: NodeProps) {
  const d = data as CableCalloutNodeData;
  const { onTextChange } = useCalloutPersist();
  const [text, setText] = useState(d.text);

  useEffect(() => {
    setText(d.text);
  }, [d.text]);

  const persist = useCallback(
    (next: string) => {
      onTextChange(id, next);
    },
    [id, onTextChange],
  );

  return (
    <div
      className="cable-callout"
      style={{
        width: CALLOUT_BOX.width,
        minHeight: CALLOUT_BOX.height,
      }}
    >
      <textarea
        className="cable-callout__text"
        value={text}
        rows={2}
        spellCheck={false}
        onChange={(event) => {
          setText(event.target.value);
        }}
        onBlur={() => {
          persist(text);
        }}
      />
    </div>
  );
}
