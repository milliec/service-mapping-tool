/** Legacy default title from imports; show the current placeholder instead. */
export function blueprintTitleLabel(serviceName: string) {
  return serviceName === 'Imported Blueprint' ? 'Enter title' : serviceName;
}
