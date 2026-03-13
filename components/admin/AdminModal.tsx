"use client";

import type { ReactNode } from "react";

export function AdminModal({
  open,
  title,
  children,
  onClose,
  variant = "default"
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  variant?: "default" | "confirm";
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="admin-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`glass admin-modal${variant === "confirm" ? " admin-modal-confirm" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="admin-modal-header">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="button secondary admin-modal-close" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
