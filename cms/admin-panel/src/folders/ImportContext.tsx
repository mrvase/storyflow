import React from "react";
import { useFileInput } from "../data/files/useFileInput";
import { addContext } from "../custom-events";
import { DocumentId } from "@storyflow/shared/types";
import { useGlobalContext } from "../state/context";
import { useDocumentPageContext } from "../documents/DocumentPageContext";

type ImportState =
  | { state: "open" }
  | { state: "closed" }
  | {
      state: "data";
      labels: string[];
      rows: string[][];
    };

export const ImportContext = React.createContext<
  [ImportState, React.Dispatch<React.SetStateAction<ImportState>>]
>(null!);

export const useImportContext = () => React.useContext(ImportContext);

export function ImportContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const state = React.useState<ImportState>({ state: "closed" });

  return (
    <ImportContext.Provider value={state}>{children}</ImportContext.Provider>
  );
}

function parseCSV(file: File) {
  return new Promise<{ labels: string[]; rows: string[][] }>(
    (resolve, reject) => {
      const reader = new FileReader();

      reader.onload = function (event) {
        if (!event.target) {
          reject("No target");
          return;
        }

        const csvData = event.target.result as string;
        const lines = csvData.split(/\r\n|\n/);
        const labels = lines[0].split(",");
        const rows = [];

        for (let i = 1; i < lines.length; i++) {
          if (lines[i]) {
            const row = lines[i].split(",");
            rows.push(row);
          }
        }

        resolve({ labels, rows });
      };

      reader.onerror = function (event) {
        reject(event?.target?.error ?? "Unknown error");
      };

      reader.readAsText(file);
    }
  );
}

export function ImportData() {
  const { id: documentId } = useDocumentPageContext();
  const [imports, setState] = useImportContext();

  const [{ file }, { onChange, dragEvents }] = useFileInput({
    async onFile(file) {
      try {
        const result = await parseCSV(file);
        console.log("RESULT", result);
        setState({ state: "data", ...result });
      } catch (err) {
        console.error(err);
      }
    },
  });

  const [selected_, setSelected] = React.useState<number>(0);
  const selected =
    imports.state === "data" ? selected_ % imports.rows.length : 0;
  const [values, setValues] = useGlobalContext(documentId, {});

  React.useEffect(() => {
    if (imports.state === "data") {
      const values = Object.fromEntries(
        imports.rows[selected].map((el, index) => [`import:${index}`, el])
      );
      setValues(values);
    }
  }, [imports.state === "data" ? imports.rows : undefined, selected]);

  if (imports.state === "closed") {
    return null;
  }

  if (imports.state === "open") {
    return (
      <div className="mx-5 mb-8 ">
        <label
          className="flex w-full rounded bg-teal-50 border border-teal-400 hover:bg-teal-100 text-teal-800 transition-colors p-5"
          {...dragEvents}
        >
          <input
            type="file"
            className="absolute w-0 h-0 opacity-0"
            onChange={onChange}
            accept=".csv"
          />
          Importer fra fil
        </label>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-20 mx-5 mb-8 ">
      <div className="w-full rounded bg-teal-50 border border-teal-400 text-teal-800 p-5">
        <div className="flex gap-5">
          {imports.rows.length} dokumenter
          <button onClick={() => setSelected((ps) => ps - 1)}>&lt;</button>
          <div>{selected}</div>
          <button onClick={() => setSelected((ps) => ps + 1)}>&gt;</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {imports.labels.map((label, index) => (
            <div
              className="py-0.5 px-2 rounded bg-pink-50 border border-pink-400 cursor-alias"
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => {
                addContext.dispatch(`import:${index}`);
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
