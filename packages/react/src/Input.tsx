"use client";

import React from "react";
import { IdContext } from "./IdContext";

type FormStatus = {
  isLoading: boolean;
  error: "FETCH_ERROR" | "SERVER_ERROR" | undefined;
  success: true | undefined;
};

const formStatuses = new Map<string, FormStatus>();
const subscribers = new Map<string, Set<() => void>>();

const setFormStatus = (action: string, status: FormStatus) => {
  formStatuses.set(action, status);
  subscribers.get(action)?.forEach((cb) => cb());
};

export const useFormStatus = (action: string) => {
  const getSnapshot = () => {
    let status = formStatuses.get(action);
    if (!status) {
      status = { isLoading: false, error: undefined, success: undefined };
      formStatuses.set(action, status);
    }
    return status;
  };

  const subscribe = (callback: () => void) => {
    let subs = subscribers.get(action);
    if (!subs) {
      subs = new Set();
      subscribers.set(action, subs);
    }
    subs.add(callback);
    return () => {
      subs!.delete(callback);
    };
  };

  const status = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot
  );

  return React.useMemo(
    () => ({
      ...status,
      reset: () =>
        setFormStatus(action, {
          isLoading: false,
          error: undefined,
          success: undefined,
        }),
    }),
    [status]
  );
};

const uploadFile = async (
  file: File,
  options: { slug: string; private?: boolean }
) => {
  const response = await fetch(
    `${
      process.env.NODE_ENV === "production"
        ? "https://www.app.storyflow.dk"
        : "http://localhost:3000"
    }/api/bucket/getUploadLinkForForm?input=${JSON.stringify({
      type: file.type,
      size: file.size,
      name: file.name,
      slug: options.slug,
      access: options.private ? "private" : "public",
    })}`
  ).then((res) => res.json());

  if ("error" in response) {
    throw new Error("Generating presigned link failed.");
  }

  const { name, url, headers } = response;

  const upload = await fetch(url, {
    method: "PUT",
    body: file,
    mode: "cors",
  });

  if (!upload.ok) {
    console.error("Upload failed.");
  }

  return name;
};

export const Form = React.forwardRef<
  HTMLFormElement,
  Omit<React.ComponentProps<"form">, "action"> & {
    action: string;
    slug?: string;
    privateFiles?: boolean;
    // uploadFile?: (file: File) => string | Promise<string>;
  }
>((props, ref) => {
  const { action, slug, privateFiles, ...rest } = props;

  const { isLoading } = useFormStatus(action);

  const id = React.useContext(IdContext);

  if (!action) {
    throw new Error("No action specified for form");
  }

  const setError = (error: FormStatus["error"]) => {
    setFormStatus(action, {
      isLoading: false,
      error,
      success: undefined,
    });
  };

  const onSubmit = React.useCallback(
    async (ev: React.FormEvent<HTMLFormElement>) => {
      console.log("SUBMITTED");
      ev.preventDefault();
      if (isLoading) return;

      // set loading state
      setFormStatus(action, {
        isLoading: true,
        error: undefined,
        success: undefined,
      });

      if (props.onSubmit) props.onSubmit(ev);

      const entries = new FormData(ev.target as HTMLFormElement).entries();

      let dataEntries = [];

      try {
        dataEntries = await Promise.all(
          Array.from(entries).map(async (el) => {
            const key = `form:${el[0]}`;
            if (typeof el[1] === "string") {
              return [key, [el[1]]];
            }

            if (el[1].size === 0) {
              return [key, []];
            } else if (slug) {
              const src = await uploadFile(el[1], {
                slug,
                private: privateFiles,
              });
              return [key, [{ src }]];
            }
            return [key, [el[1].name]];
          })
        );
      } catch (err) {
        setError("FETCH_ERROR");
        return;
      }

      const data = Object.fromEntries(dataEntries);
      console.log("DATA", data);

      const body = JSON.stringify({
        input: {
          id,
          action,
          data,
        },
      });

      try {
        const result = await fetch("/api/submit", { method: "POST", body });
        if (result.status !== 200) {
          setError("SERVER_ERROR");
          return;
        }
      } catch (err) {
        setError("FETCH_ERROR");
        return;
      }

      setFormStatus(action, {
        isLoading: false,
        error: undefined,
        success: true,
      });
    },
    [action, isLoading]
  );

  const className = React.useMemo(
    () =>
      [props.className, isLoading ? "form-is-loading" : ""]
        .filter(Boolean)
        .join(" "),
    [props.className, isLoading]
  );

  return <form ref={ref} {...rest} onSubmit={onSubmit} className={className} />;
});

export const Input = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "name"> & { name: string }
>((props, ref) => {
  const id = React.useContext(IdContext);

  console.log("ID", id);

  if (!props.name) {
    throw new Error("No name specified for input");
  }

  return <input ref={ref} {...props} name={`${id}/${props.name}`} />;
});

export const TextArea = React.forwardRef<
  HTMLTextAreaElement,
  Omit<React.ComponentProps<"textarea">, "name"> & { name: string }
>((props, ref) => {
  const id = React.useContext(IdContext);

  if (!props.name) {
    throw new Error("No name specified for textarea");
  }

  return <textarea ref={ref} {...props} name={`${id}/${props.name}`} />;
});
