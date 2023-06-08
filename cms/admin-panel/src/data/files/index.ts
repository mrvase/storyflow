import { useImmutableQuery, useQuery } from "@nanorpc/client/swr";
import { mutate, query } from "../../clients/client";
import { isError } from "@nanorpc/client";
import { servicesQuery } from "../../clients/client-services";
import type { ErrorCodes } from "@storyflow/api";
import React from "react";

export function useFileLabel(name: string) {
  const defaultLabel = "Fil uden navn";
  const { data } = useImmutableQuery(query.files.getAll());
  if (!data) return defaultLabel;
  return data.find((el) => el.name === name)?.label ?? defaultLabel;
}

function useAction<Args extends any[], TResult, TErrors extends string>(
  func: (...args: Args) => Promise<TResult | ErrorCodes<TErrors>>
) {
  const [isMutating, setIsMutating] = React.useState(false);
  const [error, setError] = React.useState<TErrors | undefined>(undefined);
  const [data, setResult] = React.useState<TResult | undefined>(undefined);

  const action = React.useCallback(
    async (...args: Args) => {
      setIsMutating(true);
      const result = await func(...args);
      setIsMutating(false);
      if (isError(result)) {
        setError(result.error);
        return result;
      } else {
        setResult(result);
        return result;
      }
    },
    [func]
  );

  return React.useMemo(
    () => Object.assign(action, { isMutating, error, data }),
    [action, isMutating, error, data]
  );
}

export function useFiles() {
  const { data = [], setData } = useImmutableQuery(query.files.getAll());

  const uploadFile = async (
    file: File,
    label: string,
    metadata: { width?: number; height?: number; size?: number } = {}
  ) => {
    const newState = await setData(async (ps) => {
      const response = await servicesQuery.bucket.getUploadLink({
        label,
        type: file.type,
        size: file.size,
        extension: (file.name ?? "").replace(/.*(\.[^.]+)$/, "$1"),
        metadata,
      });

      if (isError(response)) {
        console.error("Generating presigned link failed.");
        return ps;
      }

      const { name, url, headers } = response;

      const upload = await fetch(url, {
        method: "PUT",
        body: file,
        mode: "cors",
      });

      if (!upload.ok) {
        console.error("Upload failed.");
        return ps;
      }
      console.log("Uploaded successfully!");

      const save = await mutate.files.saveFile({ name, label });

      if (isError(save)) {
        console.error("Saving file failed.");
        return ps;
      }

      return [
        {
          name,
          label,
        },
        ...(ps ?? []),
      ];
    });
    if (newState && newState !== data) {
      return newState[0].name;
    }
  };

  const renameFile = useAction((newFile: { name: string; label: string }) => {
    const promise = mutate.files.renameFile(newFile);

    setData(async (ps) => {
      const result = await promise;
      if (!ps) return;
      if (isError(result)) {
        console.error("Saving file failed.");
        return ps;
      }
      return ps.map((file) => {
        if (file.name === newFile.name) {
          return { ...file, label: newFile.label };
        }
        return file;
      });
    });

    return promise;
  });

  const actions = {
    uploadFile,
    renameFile,
  };

  return [data, actions] as [typeof data, typeof actions];
}
