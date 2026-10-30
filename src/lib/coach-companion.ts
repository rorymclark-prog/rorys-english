export type CoachCompanionMode = "picture-in-picture" | "popup";
export type CoachCompanionTarget = { window: Window; container: HTMLElement; mode: CoachCompanionMode };

type DocumentPictureInPicture = { requestWindow(options: { width: number; height: number }): Promise<Window>; window?: Window | null };
export type CompanionHost = Window & { documentPictureInPicture?: DocumentPictureInPicture };

export function supportsFloatingCoach(host: CompanionHost): boolean {
  return typeof host.documentPictureInPicture?.requestWindow === "function";
}

/** A hidden or closed companion must never keep background listening alive. */
export function companionIsVisible(target: Pick<CoachCompanionTarget, "window"> | null): boolean {
  try { return !!target && !target.window.closed && target.window.document.visibilityState !== "hidden"; }
  catch { return false; }
}

/** Copy presentation styles only; scripts, credentials and app state stay in the owner. */
export function prepareCompanionDocument(owner: Document, target: Document): HTMLElement {
  target.title = "Private teaching coach · Rory’s English";
  target.documentElement.lang = owner.documentElement.lang || "en";
  target.documentElement.className = owner.documentElement.className;
  const base = target.createElement("base"); base.href = owner.baseURI; target.head.append(base);
  for (const node of Array.from(owner.querySelectorAll('style, link[rel="stylesheet"]'))) {
    const copy = node.cloneNode(true) as HTMLElement;
    target.head.append(copy);
  }
  const viewport = target.createElement("meta"); viewport.name = "viewport"; viewport.content = "width=device-width,initial-scale=1"; target.head.append(viewport);
  target.body.className = "coach-companion-body";
  const container = target.createElement("div"); container.id = "private-coach-companion"; target.body.append(container);
  return container;
}

/** Called directly by a click handler: do not await anything before the browser opening call. */
export async function openCoachCompanion(host: CompanionHost, forcePopup = false): Promise<CoachCompanionTarget> {
  const pip = !forcePopup && supportsFloatingCoach(host);
  const opened = pip
    ? await host.documentPictureInPicture!.requestWindow({ width: 390, height: 570 })
    : host.open("", "_blank", "popup,width=390,height=570");
  if (!opened) throw new Error("Allow the private coach window to open, then try again.");
  try {
    const container = prepareCompanionDocument(host.document, opened.document);
    return { window: opened, container, mode: pip ? "picture-in-picture" : "popup" };
  } catch (error) {
    opened.close();
    throw error;
  }
}
