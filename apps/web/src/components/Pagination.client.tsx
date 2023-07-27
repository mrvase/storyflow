"use client";

import { Paginate } from "@storyflow/react/rsc";
import React from "react";
import { PaginationProps } from "./Pagination";

export const Pagination = ({ children }: PaginationProps) => {
  const [page, setPage] = React.useState(0);

  return (
    <Paginate page={page}>
      <div>{children}</div>
      <div>
        <button onClick={() => setPage((ps) => ps - 1)}>&lt;</button>
        <button onClick={() => setPage((ps) => ps + 1)}>&gt;</button>
      </div>
    </Paginate>
  );
};
