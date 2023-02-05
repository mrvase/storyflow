import { isError, unwrap } from "@storyflow/result";
import { SWRClient, useClient } from "../client";

function useFilesQuery() {
  return SWRClient.files.getAll.useQuery(undefined, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
  });
}

export function useFileLabel(name: string) {
  const defaultLabel = "Fil uden navn";
  const { data } = useFilesQuery();
  if (!data) return defaultLabel;
  return data.find((el) => el.name === name)?.label ?? defaultLabel;
}

export function useFiles() {
  const { data, mutate } = useFilesQuery();

  const client = useClient();

  const upload = async (
    file: File,
    label: string,
    metadata: { width?: number; height?: number; size?: number } = {}
  ) => {
    const newState = await mutate(async (ps) => {
      const response = await client.bucket.getUploadLink.query({
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

      const { name, url, headers } = unwrap(response);

      const upload = await fetch(url, {
        method: "PUT",
        body: file,
        headers: headers,
      });

      if (upload.ok) {
        console.log("Uploaded successfully!");
        return [
          {
            name,
            label,
          },
          ...(ps ?? []),
        ];
      } else {
        console.error("Upload failed.");
        return ps;
      }
    });
    if (newState && newState !== data) {
      return newState[0].name;
    }
  };

  const files = data ?? [];

  return [files, upload] as [typeof files, typeof upload];
}
