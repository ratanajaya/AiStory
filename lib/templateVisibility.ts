export function visibleTemplate<T extends Record<string, unknown>>(template: T, isAdmin: boolean): T {
  if (isAdmin) return template;
  const { isPublic: _isPublic, ...visible } = template;
  void _isPublic;
  return visible as T;
}
