import cl from "clsx";
import { useDragItem } from "@storyflow/dnd";
import {
  ArrowPathRoundedSquareIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { usePanelActions } from "../panel-router/PanelRouter";
import { replacePanelPath } from "../panel-router/utils";
import { useLocation, useNavigate } from "@storyflow/router";
import React from "react";

export function LinkReceiver({
  id,
  type = "new",
  edge,
  index,
}: {
  id: string;
  index: number;
  type?: "new" | "existing";
  edge?: "right" | "left";
}) {
  const actions = usePanelActions();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const reject = (dragType: string) => {
    return type === "existing" && dragType.endsWith(String(index));
  };

  const onChange = React.useCallback(
    ([action]: any) => {
      if (action.type === "delete" || typeof action.item !== "string") {
        return;
      }
      if (type === "new") {
        actions.open({ path: action.item, index });
      } else {
        const url = replacePanelPath(pathname, { path: action.item, index });
        navigate(url);
      }
    },
    [pathname, actions, navigate, index]
  );

  const { ref, state } = useDragItem({
    id,
    type: "link-receiver",
    onChange,
    canReceive: {
      link: ({ type }) => {
        return type.startsWith("link")
          ? reject(type)
            ? "reject"
            : "accept"
          : "ignore";
      },
      move: () => "ignore",
    },
  });

  const Icon = type === "existing" ? ArrowPathRoundedSquareIcon : PlusIcon;

  return (
    <div
      ref={ref}
      className={cl(
        "absolute flex items-center inset-y-0 z-10 w-2 pointer-events-none",
        edge === "left" ? "left-0" : edge === "right" ? "right-0" : "ml-[50%]"
      )}
    >
      <div
        className={cl(
          "flex-center shrink-0 transition-opacity",
          type === "existing" ? "bg-yellow-400/75" : "bg-green-500/75",
          edge === "left"
            ? "h-20 w-10 rounded-r-full pr-3"
            : edge === "right"
            ? "h-20 w-10 -translate-x-9 rounded-l-full pl-3"
            : "h-20 w-20 -translate-x-10 rounded-full",
          state.isTarget && state.acceptsLink ? "opacity-100" : "opacity-0"
        )}
      >
        <Icon className="w-6 h-6" />
      </div>
    </div>
  );
}
