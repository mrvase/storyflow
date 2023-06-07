import { useImmutableQuery, useQuery } from "@nanorpc/client/swr";
import { mutate, query } from "../../clients/client";
import { isError } from "@nanorpc/client";
import { servicesQuery } from "../../clients/client-services";

function useFilesQuery() {
  return useImmutableQuery(query.files.getAll(undefined));
}

export function useFileLabel(name: string) {
  const defaultLabel = "Fil uden navn";
  const { data } = useFilesQuery();
  if (!data) return defaultLabel;
  return data.find((el) => el.name === name)?.label ?? defaultLabel;
}

export function useFiles() {
  const { data, setData } = useFilesQuery();

  const upload = async (
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

  const files = data ?? [];

  return [files, upload] as [typeof files, typeof upload];
}
