"use client";

export default function QuickLibraryPanelStylesV05() {
  return (
    <style jsx global>{`
      [role="dialog"][aria-modal="true"] {
        background: rgba(16, 24, 40, 0.22) !important;
        backdrop-filter: blur(2px);
      }

      [role="dialog"][aria-modal="true"] > section {
        width: min(440px, calc(100vw - 24px)) !important;
        background: #fff !important;
        color: #17202a;
        padding: 16px !important;
        border-left: 1px solid #e4e7ec;
        box-shadow: -10px 0 30px rgba(16, 24, 40, 0.18);
      }

      [role="dialog"][aria-modal="true"] > section > div:first-child {
        min-height: 48px;
        margin: -16px -16px 14px;
        padding: 8px 12px;
        border-bottom: 1px solid #e4e7ec;
        background: #fff;
      }

      [role="dialog"][aria-modal="true"] h2 {
        margin: 2px 0 0;
        font-size: 15px;
        line-height: 1.2;
        color: #17202a;
      }

      [role="dialog"][aria-modal="true"] h3,
      [role="dialog"][aria-modal="true"] h4 {
        margin: 0 0 6px;
        font-size: 11px;
        color: #344054;
      }

      [role="dialog"][aria-modal="true"] p {
        margin: 8px 0;
        color: #475467;
        font-size: 10px;
        line-height: 1.45;
      }

      [role="dialog"][aria-modal="true"] small {
        color: #667085;
        font-size: 10px;
        line-height: 1.35;
      }

      [role="dialog"][aria-modal="true"] button {
        border: 1px solid #cfd6df;
        background: #fff;
        color: #17202a;
        border-radius: 6px;
        padding: 6px 8px;
        font-size: 11px;
        font-weight: 600;
        line-height: 1.2;
      }

      [role="dialog"][aria-modal="true"] button:hover:not(:disabled) {
        background: #f2f4f7;
        border-color: #b8c2cf;
      }

      [role="dialog"][aria-modal="true"] input,
      [role="dialog"][aria-modal="true"] select {
        width: 100%;
        min-height: 32px;
        border: 1px solid #d0d5dd;
        border-radius: 6px;
        padding: 6px 7px;
        background: #fff;
        color: #17202a;
        font-size: 11px;
        outline: none;
      }

      [role="dialog"][aria-modal="true"] input:focus,
      [role="dialog"][aria-modal="true"] select:focus {
        border-color: #6b9bc7;
        box-shadow: 0 0 0 2px rgba(107, 155, 199, 0.14);
      }

      [role="dialog"][aria-modal="true"] label {
        display: grid;
        gap: 4px;
        margin: 6px 0;
        color: #475467;
        font-size: 10px;
        font-weight: 600;
      }

      [role="dialog"][aria-modal="true"] article,
      [role="dialog"][aria-modal="true"] details,
      [role="dialog"][aria-modal="true"] > section > div[style*="border"] {
        border-color: #e4e7ec !important;
        border-radius: 8px !important;
        background: #fbfcfd;
      }

      [role="dialog"][aria-modal="true"] article {
        box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
      }

      [role="dialog"][aria-modal="true"] details {
        padding: 9px 10px;
      }

      [role="dialog"][aria-modal="true"] summary {
        color: #344054;
        font-size: 11px;
        font-weight: 700;
      }

      [role="dialog"][aria-modal="true"] hr {
        border: 0;
        border-top: 1px solid #e4e7ec;
        margin: 14px 0;
      }

      @media (max-width: 760px) {
        [role="dialog"][aria-modal="true"] > section {
          width: min(390px, calc(100vw - 8px)) !important;
          padding: 12px !important;
        }

        [role="dialog"][aria-modal="true"] > section > div:first-child {
          margin: -12px -12px 12px;
          padding: 8px 10px;
        }

        [role="dialog"][aria-modal="true"] h2 {
          font-size: 13px;
        }

        [role="dialog"][aria-modal="true"] button,
        [role="dialog"][aria-modal="true"] input,
        [role="dialog"][aria-modal="true"] select {
          font-size: 10px;
        }
      }
    `}</style>
  );
}
