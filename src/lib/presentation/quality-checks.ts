export type LayoutRegistryIssue = { layoutId: string; field: string; message: string };

type RegistryValidationShape = {
  id: string;
  slideType: string;
  family: string;
  contentLimits: { slots: readonly unknown[] };
  fits: (...args: never[]) => unknown;
  render: (...args: never[]) => unknown;
};

export function validateLayoutRegistry(layouts: readonly RegistryValidationShape[]): LayoutRegistryIssue[] {
  const issues: LayoutRegistryIssue[] = [];
  const ids = new Set<string>();
  for (const layout of layouts) {
    if (!layout.id.trim()) issues.push({ layoutId: layout.id, field: "id", message: "Layout ID is required." });
    if (ids.has(layout.id)) issues.push({ layoutId: layout.id, field: "id", message: "Layout IDs must be unique." });
    ids.add(layout.id);
    if (!layout.slideType) issues.push({ layoutId: layout.id, field: "slideType", message: "Slide type is required." });
    if (!layout.family.trim()) issues.push({ layoutId: layout.id, field: "family", message: "Layout family is required." });
    if (layout.contentLimits.slots.length === 0) issues.push({ layoutId: layout.id, field: "contentLimits", message: "At least one named content slot is required." });
    if (typeof layout.fits !== "function") issues.push({ layoutId: layout.id, field: "fits", message: "Fit validation is required." });
    if (typeof layout.render !== "function") issues.push({ layoutId: layout.id, field: "render", message: "A render function is required." });
  }
  return issues;
}
