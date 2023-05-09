"use client";
import { useSearchParams } from "next/navigation";

import Link from "next/link";
import { libraries, configs } from "../../../components";
import React from "react";
import { RenderStories } from "@storyflow/react/stories";

export default function Page() {
  const params = useSearchParams();

  const array = React.useMemo(() => {
    return [params.get("l"), params.get("c"), params.get("s")].filter(
      (el): el is Exclude<typeof el, null> => el !== null
    );
  }, [params]);

  return (
    <RenderStories
      story={array}
      libraries={libraries}
      configs={configs}
      Link={Link}
    />
  );
}
