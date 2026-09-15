export interface SelectedWorkbook {
  file: File;
  handle?: FileSystemFileHandle;
}

interface FilePickerWindow extends Window {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<FileSystemFileHandle[]>;
}

export async function pickWorkbookFile(): Promise<SelectedWorkbook | null> {
  const picker = (window as FilePickerWindow).showOpenFilePicker;

  if (picker) {
    try {
      const [handle] = await picker({
        multiple: false,
        types: [
          {
            description: "Excel workbook",
            accept: {
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
              "application/vnd.ms-excel": [".xls"],
            },
          },
        ],
      });

      return handle ? { file: await handle.getFile(), handle } : null;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return null;
      }
      throw error;
    }
  }

  return pickWorkbookWithInput();
}

function pickWorkbookWithInput(): Promise<SelectedWorkbook | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";

    input.addEventListener(
      "change",
      () => {
        const file = input.files?.[0];
        resolve(file ? { file } : null);
      },
      { once: true },
    );
    input.addEventListener("cancel", () => resolve(null), { once: true });
    input.click();
  });
}
