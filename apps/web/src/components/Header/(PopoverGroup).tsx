"use client";

import React from "react";
import { Popover } from "@headlessui/react";

export const PopoverGroup = ({ children }: { children: React.ReactNode }) => {
  return (
    <Popover.Group as="nav" className="hidden space-x-10 md:flex">
      {children}
    </Popover.Group>
  );
};
