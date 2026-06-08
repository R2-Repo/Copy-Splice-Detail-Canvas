import { useRef } from "react";

type CsvImportButtonProps = {
  onImport: (text: string, fileName: string) => void;
  disabled?: boolean;
};

export function CsvImportButton({ onImport, disabled }: CsvImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="csv-import">
      <button
        type="button"
        className="csv-import__button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        Import Bentley CSV
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
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
