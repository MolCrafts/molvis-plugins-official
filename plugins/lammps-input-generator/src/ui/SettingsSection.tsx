import type { CSSProperties, ReactNode } from "react";
import { css } from "./styles";

export function SettingsSection({
  id,
  title,
  description,
  children,
  last = false,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div
      style={last ? css.sectionWrapLast : css.sectionWrap}
      data-settings-section={id}
    >
      <section style={css.section} id={id}>
        <header style={css.sectionHeader}>
          <h3 style={css.sectionTitle}>{title}</h3>
          {description ? <p style={css.sectionDesc}>{description}</p> : null}
        </header>
        <div style={css.stack}>{children}</div>
      </section>
    </div>
  );
}

export function SettingsRow({
  label,
  children,
  stacked = false,
}: {
  label: ReactNode;
  children: ReactNode;
  /** Full-width control under the label (for long inputs / lists). */
  stacked?: boolean;
}) {
  if (stacked) {
    return (
      <div style={css.field}>
        <span style={css.label as CSSProperties}>{label}</span>
        {children}
      </div>
    );
  }
  return (
    <div style={css.settingsRow}>
      <span style={css.settingsLabel}>{label}</span>
      <div style={css.settingsControl}>{children}</div>
    </div>
  );
}
