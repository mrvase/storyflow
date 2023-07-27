"use client";
// @ts-expect-error
import { createFromReadableStream } from "next/dist/compiled/react-server-dom-webpack/client";
import React from "react";

const PaginationContext = React.createContext<number>(0);

export const Paginate = ({
  children,
  page,
}: {
  children: React.ReactNode;
  page: number;
}) => {
  return (
    <PaginationContext.Provider value={page}>
      {children}
    </PaginationContext.Provider>
  );
};

export function Pagination({
  children,
  action,
  options,
  id,
}: {
  children: React.ReactNode;
  action?: () => Promise<React.ReactElement[] | null>;
  id: string;
  options: string[];
}) {
  const [current, setCurrent] = React.useState(children);

  const offset = React.useContext(PaginationContext);

  const offsetRef = React.useRef(offset);

  React.useEffect(() => {
    let error: string;
    if (offset < 0) return;
    if (cached.current[offset]?.data) {
      setCurrent(cached.current[offset].data);
      return;
    }
    try {
      if (!cached.current[offset]?.promise) {
        const promise = fetch(
          `/api/getLoopComponent?input=${JSON.stringify({
            id,
            options,
            offset,
          })}`
        ).then(async (response) => {
          if (response.status !== 200) {
            throw "ERROR";
          }
          const data = await createFromReadableStream(response.body);
          cached.current[offset] = { promise: undefined, data };
          if (offsetRef.current === offset) {
            setCurrent(data);
          }
        });
        cached.current[offset] = { promise, data: undefined };
      }
    } catch (err) {
      console.log(err);
      error = "FETCH_ERROR";
      cached.current[offset] = { promise: undefined, data: null };
    }
    offsetRef.current = offset;
  }, [offset]);

  const cached = React.useRef<
    Record<
      number,
      | { promise: Promise<any>; data: undefined }
      | { promise: undefined; data: any }
    >
  >({
    0: { promise: undefined, data: children },
  });

  return <Paginate page={0}>{current}</Paginate>;
}
