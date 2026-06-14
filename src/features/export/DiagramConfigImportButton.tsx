import { useRef } from "react";

import { ConfigImportIcon } from "@/components/toolbar/ToolbarIcon";

type DiagramConfigImportButtonProps = {
  onImport: (text: string, fileName: string) => void;
  disabled?: boolean;
};

const IMPORT_LABEL = "Import diagram config";

export function DiagramConfigImportButton({
  onImport,
  disabled,
}: DiagramConfigImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="csv-import">
      <button
        type="button"
        className="toolbar-icon-btn"
        disabled={disabled}
        aria-label={IMPORT_LABEL}
        title={IMPORT_LABEL}
        onClick={() => inputRef.current?.click()}
      >
        <ConfigImportIcon />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,.sdc.json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            const text = typeof reader.result === "string" ? reader.result : "";
            onImport(text, file.name);
            e.target.value = "";
          };
          reader.readAsText(file);
        }}
      />
    </div>
  );
}
