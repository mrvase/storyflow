import { Suspense } from "react";

export type LazyComponent = (props: {
  children: React.ReactNode;
  type?: string;
}) => ReturnType<typeof lazy>;

export const lazy = (
  components: any,
  { type, children }: { children: React.ReactNode; type?: string }
) => {
  if (!type || !(type in components)) {
    return <>{children}</>;
  }
  const Component = components[type as keyof typeof components];
  return (
    <Suspense fallback={<>loading...</>}>
      <Component>{children}</Component>
    </Suspense>
  );
};
