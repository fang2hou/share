/** Keep browser selection and context menus off decorative interface metadata. */
export function suppressContextMenu(element: HTMLElement): () => void {
  const prevent = (event: Event) => event.preventDefault();
  element.addEventListener("contextmenu", prevent);
  return () => element.removeEventListener("contextmenu", prevent);
}
