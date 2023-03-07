import { createSpliceTransformer } from "./splice-transform";
import { inputConfig } from "./inputConfig";
import { ComputationOp, targetTools } from "./operations";
import { getNestedChild } from "@storyflow/backend/traverse";
import { Computation, FieldType, FunctionName } from "@storyflow/backend/types";
import { tools } from "./editor-tools";

const getArrayMethods = (operation: ComputationOp) => {
  // const { input } = targetTools.parse(operation.target);
  return {
    splice: tools.slice,
    getLength: tools.getLength,
  };
};

export const createComputationTransformer = (initialValue: Computation) => {
  const getInitialValue = (operation: ComputationOp) => {
    const { location: path, input } = targetTools.parse(operation.target);

    if (path === "") {
      return inputConfig.getSpliceableValue(initialValue);
    }

    try {
      const child = getNestedChild(initialValue, path.split("."));
      if (!child) throw "error";
      if (!inputConfig.getSpliceableValue) return [];
      return inputConfig.getSpliceableValue(child);
    } catch (err) {
      if (input === "computation") {
        return fieldConfig.default.initialValue;
      }
      return []; // it is safe to assume it is something of length 0
    }
  };
  return createSpliceTransformer<ComputationOp>(
    getInitialValue,
    getArrayMethods
  );
};

export const fieldConfig: Record<
  FieldType,
  { initialValue: Computation; transform?: FunctionName }
> = {
  default: {
    initialValue: [],
  },
  url: {
    initialValue: [{ "(": true }, "", "", { ")": "url" }],
    transform: "url",
  },
  slug: {
    initialValue: [{ "(": true }, { ")": "slug" }],
    transform: "slug",
  },
};

export const getConfig = <T extends keyof typeof fieldConfig>(
  key: T
): (typeof fieldConfig)[T] => {
  return fieldConfig[key];
};
