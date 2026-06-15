import { useRef } from "react";

import { FolderPlusIcon } from "@/components/toolbar/ToolbarIcon";

type CsvImportButtonProps = {
  onImport: (text: string, fileName: string) => void;
  disabled?: boolean;
  /** Orange active styling when a diagram is loaded */
  active?: boolean;
};

const IMPORT_LABEL = "Import file";

export function CsvImportButton({ onImport, disabled, active = false }: CsvImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="csv-import">
      <button
        type="button"
        className={`toolbar-icon-btn${active ? " toolbar-icon-btn--primary" : ""}`}
        disabled={disabled}
        aria-label={IMPORT_LABEL}
        title={IMPORT_LABEL}
        onClick={() => inputRef.current?.click()}
      >
        <FolderPlusIcon />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.sdc.json,.json,text/csv,application/json"
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
