import { Button } from "@/components/ui/button";
import { Clipboard, Download } from "lucide-react";
import { css } from "../styles";

export function PreviewStep({
  script,
  onCopy,
  onDownload,
}: {
  script: string;
  onCopy: () => void;
  onDownload: () => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 4, marginBottom: 6 }}>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onCopy} aria-label="Copy script" title="Copy script">
          <Clipboard />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onDownload} aria-label="Download in.eq" title="Download in.eq">
          <Download />
        </Button>
      </div>
      <pre style={css.pre}>{script}</pre>
    </div>
  );
}
