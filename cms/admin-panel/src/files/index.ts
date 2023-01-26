import { isError, unwrap } from "@storyflow/result";
import { SWRClient, useClient } from "../client";

export function useFiles() {
  const { data, mutate } = SWRClient.files.getAll.useQuery();

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
