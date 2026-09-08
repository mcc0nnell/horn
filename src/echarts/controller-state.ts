export function forwardReadonlyProperty(
  target: object,
  source: object,
  key: PropertyKey,
): void {
  Object.defineProperty(target, key, {
    enumerable: true,
    configurable: true,
    get: () => Reflect.get(source, key),
  });
}
