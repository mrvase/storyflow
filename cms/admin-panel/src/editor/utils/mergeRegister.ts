export function mergeRegister(...func: Array<() => void>): () => void {
  return () => {
    func.forEach((f) => f());
  };
}
