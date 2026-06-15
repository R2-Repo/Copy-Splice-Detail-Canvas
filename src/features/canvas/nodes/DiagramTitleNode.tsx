import { type NodeProps } from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useTitlePersist } from "@/features/canvas/titleBox/TitlePersistContext";
import { TITLE_BOX } from "@/features/canvas/titleBox/titleBoxLayout";
import type { DiagramTitleNodeData } from "@/features/canvas/nodes/types";
import type { DiagramTitleBlock } from "@/types/splice";

type TitleField = keyof DiagramTitleBlock;

function fieldValue(data: DiagramTitleNodeData, key: TitleField): string {
  return data[key] ?? "";
}

function TitleValue({
  field,
  value,
  onCommit,
}: {
  field: TitleField;
  value: string;
  onCommit: (field: TitleField, next: string) => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing && ref.current && ref.current.textContent !== value) {
      ref.current.textContent = value;
    }
  }, [value, editing]);

  const commit = useCallback(() => {
    const next = ref.current?.textContent ?? "";
    setEditing(false);
    onCommit(field, next);
  }, [field, onCommit]);

  return (
    <span
      ref={ref}
      className="diagram-title__value nodrag nopan"
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={field}
      tabIndex={0}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onFocus={() => setEditing(true)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          ref.current?.blur();
        }
      }}
    >
      {value}
    </span>
  );
}

export function DiagramTitleNode({ data }: NodeProps) {
  const d = data as DiagramTitleNodeData;
  const { onFieldChange } = useTitlePersist();
  const scale = d.diagramScale ?? 1;
  const width = d.boxWidth ?? TITLE_BOX.minWidth;

  const [values, setValues] = useState<DiagramTitleBlock>(() => ({
    street: fieldValue(d, "street"),
    cityState: fieldValue(d, "cityState"),
    poleNumber: fieldValue(d, "poleNumber"),
    reportDate: fieldValue(d, "reportDate"),
    description: fieldValue(d, "description"),
    location: fieldValue(d, "location"),
  }));

  useEffect(() => {
    setValues({
      street: fieldValue(d, "street"),
      cityState: fieldValue(d, "cityState"),
      poleNumber: fieldValue(d, "poleNumber"),
      reportDate: fieldValue(d, "reportDate"),
      description: fieldValue(d, "description"),
      location: fieldValue(d, "location"),
    });
  }, [
    d.street,
    d.cityState,
    d.poleNumber,
    d.reportDate,
    d.description,
    d.location,
  ]);

  const commit = useCallback(
    (field: TitleField, next: string) => {
      setValues((prev) => ({ ...prev, [field]: next }));
      onFieldChange(field, next);
    },
    [onFieldChange],
  );

  return (
    <div
      className="diagram-title nodrag nopan"
      style={{
        width,
        fontSize: `${TITLE_BOX.baseFontPx * scale}px`,
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="diagram-title__line diagram-title__line--triple">
        <span className="diagram-title__label">Street:</span>
        <TitleValue field="street" value={values.street ?? ""} onCommit={commit} />
        <span className="diagram-title__label">City/St:</span>
        <TitleValue field="cityState" value={values.cityState ?? ""} onCommit={commit} />
        <span className="diagram-title__label">Pole #:</span>
        <TitleValue field="poleNumber" value={values.poleNumber ?? ""} onCommit={commit} />
      </div>
      <div className="diagram-title__line">
        <span className="diagram-title__label">Report Date:</span>
        <TitleValue field="reportDate" value={values.reportDate ?? ""} onCommit={commit} />
      </div>
      <div className="diagram-title__line">
        <span className="diagram-title__label">Desc:</span>
        <TitleValue field="description" value={values.description ?? ""} onCommit={commit} />
      </div>
      <div className="diagram-title__line">
        <span className="diagram-title__label">Location:</span>
        <TitleValue field="location" value={values.location ?? ""} onCommit={commit} />
      </div>
    </div>
  );
}
