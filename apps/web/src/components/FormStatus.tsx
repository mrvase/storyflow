"use client";

import { useFormStatus } from "@storyflow/react";

export function FormStatus({ action }: { action: string }) {
  const { isLoading } = useFormStatus(action);

  return <>{`${isLoading}`}</>;
}
