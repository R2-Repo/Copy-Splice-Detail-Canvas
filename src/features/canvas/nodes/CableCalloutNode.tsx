import { type NodeProps, useReactFlow, useUpdateNodeInternals, useViewport } from "@xyflow/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

import {
  CALLOUT_BOX,
  CALLOUT_BOX_CHROME_Y,
} from "@/features/canvas/callouts/cableCalloutGeometry";
import { useCalloutPersist } from "@/features/canvas/callouts/CalloutPersistContext";
import { useCalloutScale } from "@/features/canvas/callouts/CalloutScaleContext";
import type { CableCalloutNodeData } from "@/features/canvas/nodes/types";

export function CableCalloutNode({ id, data }: NodeProps) {
  const d = data as CableCalloutNodeData;
  const { onTextChange } = useCalloutPersist();
  const { effectiveScale } = useCalloutScale();
  const viewport = useViewport();
  const { setNodes, getNode } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const [text, setText] = useState(d.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scale = effectiveScale(viewport.zoom);
  const scaledWidth = CALLOUT_BOX.width * scale;
  const scaledMinHeight = CALLOUT_BOX.minHeight * scale;
  const scaledChromeY = CALLOUT_BOX_CHROME_Y * scale;
  const [contentHeight, setContentHeight] = useState<number>(scaledMinHeight);

  useEffect(() => {
    setText(d.text);
  }, [d.text]);

  const persist = useCallback(
    (next: string) => {
      onTextChange(id, next);
    },
    [id, onTextChange],
  );

  const syncNodeDimensions = useCallback(
    (nextHeight: number) => {
      const clamped = Math.max(scaledMinHeight, nextHeight);
      setContentHeight(clamped);

      const current = getNode(id);
      if (current?.width === scaledWidth && current?.height === clamped) return;

      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? { ...node, width: scaledWidth, height: clamped }
            : node,
        ),
      );
      updateNodeInternals(id);
    },
    [getNode, id, scaledMinHeight, scaledWidth, setNodes, updateNodeInternals],
  );

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "0px";
    const textHeight = el.scrollHeight;
    el.style.height = `${textHeight}px`;
    syncNodeDimensions(textHeight + scaledChromeY);
  }, [text, scale, scaledChromeY, syncNodeDimensions]);

  return (
    <div
      className="cable-callout"
      style={
        {
          width: scaledWidth,
          minHeight: scaledMinHeight,
          height: contentHeight,
          "--callout-scale": scale,
        } as CSSProperties
      }
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
