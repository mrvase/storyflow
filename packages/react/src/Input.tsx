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

export const Form = React.forwardRef<
  HTMLFormElement,
  Omit<React.ComponentProps<"form">, "action"> & { action: string }
>((props, ref) => {
  const { isLoading } = useFormStatus(props.action);

  const id = React.useContext(IdContext);

  if (!props.action) {
    throw new Error("No action specified for form");
  }

  const onSubmit = React.useCallback(
    async (ev: React.FormEvent<HTMLFormElement>) => {
      ev.preventDefault();
      if (isLoading) return;

      // set loading state
      setFormStatus(props.action, {
        isLoading: true,
        error: undefined,
        success: undefined,
      });

      if (props.onSubmit) props.onSubmit(ev);

      const entries = new FormData(ev.target as HTMLFormElement).entries();
      const data = Object.fromEntries(
        Array.from(entries).map((el) => [
          `form:${el[0]}`,
          typeof el[1] === "string" ? [el[1]] : [],
        ])
      );

      let error: FormStatus["error"] = undefined;

      const body = JSON.stringify({
        input: {
          id,
          action: props.action,
          data,
        },
      });

      try {
        const result = await fetch("/api/submit", { method: "POST", body });
        if (result.status !== 200) {
          error = "SERVER_ERROR";
        }
      } catch (err) {
        error = "FETCH_ERROR";
      }

      // set error state
      setFormStatus(props.action, {
        isLoading: false,
        error,
        success: !error ? true : undefined,
      });
    },
    [props.action, isLoading]
  );

  const className = React.useMemo(
    () =>
      [props.className, isLoading ? "form-is-loading" : ""]
        .filter(Boolean)
        .join(" "),
    [props.className, isLoading]
  );

  return (
    <form ref={ref} {...props} onSubmit={onSubmit} className={className} />
  );
});

export const Input = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "name"> & { name: string }
>((props, ref) => {
  const id = React.useContext(IdContext);

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
