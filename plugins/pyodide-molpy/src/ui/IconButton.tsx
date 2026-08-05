import type { CSSProperties, ReactNode } from "react";
import { css } from "./styles";

/** Ghost icon control — no border, no fill; accent/danger via icon color only. */
export function IconButton({
  label,
  onClick,
  disabled,
  danger,
  accent,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** Use product accent color for the icon (selected / primary action). */
  accent?: boolean;
  children: ReactNode;
}) {
  const base = css.iconBtn({ danger, accent, disabled });
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      style={base as CSSProperties}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = css.interactive;
        if (!accent && !danger) {
          e.currentTarget.style.color = css.fg;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = base.color;
        e.currentTarget.style.opacity = String(base.opacity);
      }}
    >
      {children}
    </button>
  );
}
