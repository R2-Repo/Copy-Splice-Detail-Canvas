import { type NodeProps, useReactFlow, useUpdateNodeInternals } from "@xyflow/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  CALLOUT_BOX,
  CALLOUT_BOX_CHROME_Y,
} from "@/features/canvas/callouts/cableCalloutGeometry";
import { useCalloutPersist } from "@/features/canvas/callouts/CalloutPersistContext";
import type { CableCalloutNodeData } from "@/features/canvas/nodes/types";

export function CableCalloutNode({ id, data }: NodeProps) {
  const d = data as CableCalloutNodeData;
  const { onTextChange } = useCalloutPersist();
  const { setNodes, getNode } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const [text, setText] = useState(d.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [contentHeight, setContentHeight] = useState<number>(
    CALLOUT_BOX.minHeight,
  );

  useEffect(() => {
    setText(d.text);
  }, [d.text]);

  const persist = useCallback(
    (next: string) => {
      onTextChange(id, next);
    },
    [id, onTextChange],
  );

  const syncNodeHeight = useCallback(
    (nextHeight: number) => {
      const clamped = Math.max(CALLOUT_BOX.minHeight, nextHeight);
      setContentHeight(clamped);

      const current = getNode(id);
      if (current?.height === clamped) return;

      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id ? { ...node, height: clamped } : node,
        ),
      );
      updateNodeInternals(id);
    },
    [getNode, id, setNodes, updateNodeInternals],
  );

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "0px";
    const textHeight = el.scrollHeight;
    el.style.height = `${textHeight}px`;
    syncNodeHeight(textHeight + CALLOUT_BOX_CHROME_Y);
  }, [text, syncNodeHeight]);

  return (
    <div
      className="cable-callout"
      style={{
        width: CALLOUT_BOX.width,
        minHeight: CALLOUT_BOX.minHeight,
        height: contentHeight,
      }}
    >
      <textarea
        ref={textareaRef}
        className="cable-callout__text"
        value={text}
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
