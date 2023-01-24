import * as React from "react";
import { CAN_USE_DOM } from "../utils/environment";

const useLayoutEffect: typeof React.useLayoutEffect = CAN_USE_DOM
  ? React.useLayoutEffect
  : React.useEffect;

export default useLayoutEffect;
