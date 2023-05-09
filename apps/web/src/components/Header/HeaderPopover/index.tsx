"use client";

import React, { Suspense } from "react";

const Lazy = React.lazy(() => import("./lazy"));

export const HeaderPopover = (props: any) => (
  <Suspense>
    <Lazy {...props} />
  </Suspense>
);
