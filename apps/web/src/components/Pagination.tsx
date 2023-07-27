import { PropConfigRecord, Props } from "@storyflow/react";
import { Pagination } from "./Pagination.client";

const props = {
  children: {
    type: "children",
    label: "Indhold",
  },
} satisfies PropConfigRecord;

export const PaginationConfig = {
  label: "Sideinddeling",
  props,
  component: Pagination,
};

export type PaginationProps = Props<typeof props>;
