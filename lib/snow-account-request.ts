const accountOrigin = "https://www.linkoteq.com";
const accountFrameUrl = accountOrigin + "/account/header-session";

export function requestSnowThroughAccount(payload: unknown): Promise<{ ok: boolean; data: unknown }> {
  const frame = document.querySelector("linkoteq-header")?.shadowRoot
    ?.querySelector<HTMLIFrameElement>(`iframe[src="${accountFrameUrl}"]`);
  const accountWindow = frame?.contentWindow;
  if (!accountWindow) return Promise.reject(new Error("The Linkoteq account session is unavailable. Reload and sign in before running Snow."));

  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", receive);
    };
    function receive(event: MessageEvent) {
      if (event.origin !== accountOrigin || event.source !== accountWindow) return;
      const result = event.data;
      if (result?.type !== "linkoteq:snow-result" || result.id !== id || typeof result.ok !== "boolean") return;
      cleanup();
      resolve({ ok: result.ok, data: result.data });
    }
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("The Snow request timed out. Reload the page or try again."));
    }, 40000);
    window.addEventListener("message", receive);
    accountWindow.postMessage({ type: "linkoteq:header-connect" }, accountOrigin);
    accountWindow.postMessage({ type: "linkoteq:snow-request", id, payload }, accountOrigin);
  });
}
