/* Picture-in-picture mini tracker using the Document Picture-in-Picture API. */
/* eslint-disable @typescript-eslint/no-explicit-any */

export function pipSupported(): boolean {
  return typeof window !== "undefined" && "documentPictureInPicture" in window;
}

export type PipHandle = {
  update: (lines: { title: string; subtitle: string }) => void;
  close: () => void;
};

export async function openPipTracker(
  initial: { title: string; subtitle: string },
  onClose?: () => void,
): Promise<PipHandle | null> {
  if (!pipSupported()) return null;
  const pipWindow: any = await (window as any).documentPictureInPicture.requestWindow({
    width: 300,
    height: 170,
  });

  const style = pipWindow.document.createElement("style");
  style.textContent = `
    body { margin:0; font-family: system-ui, sans-serif; background:#141821; color:#f4f6fb;
      display:flex; flex-direction:column; justify-content:center; gap:6px; padding:18px; }
    .tag { font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:#f0b429; }
    .title { font-size:26px; font-weight:700; }
    .sub { font-size:13px; color:#8d97ad; }
  `;
  pipWindow.document.head.appendChild(style);

  const tag = pipWindow.document.createElement("div");
  tag.className = "tag";
  tag.textContent = "WARBUDDY tracking";
  const title = pipWindow.document.createElement("div");
  title.className = "title";
  title.textContent = initial.title;
  const sub = pipWindow.document.createElement("div");
  sub.className = "sub";
  sub.textContent = initial.subtitle;
  pipWindow.document.body.append(tag, title, sub);

  pipWindow.addEventListener("pagehide", () => onClose?.());

  return {
    update: (lines) => {
      title.textContent = lines.title;
      sub.textContent = lines.subtitle;
    },
    close: () => pipWindow.close(),
  };
}
