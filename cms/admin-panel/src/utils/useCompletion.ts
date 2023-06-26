import { useCallback, useEffect, useId, useRef, useState } from "react";
import useSWRMutation from "swr/mutation";
import useSWR from "swr";

function createChunkDecoder() {
  const decoder = new TextDecoder();
  return function (chunk: Uint8Array | undefined): string {
    if (!chunk) return "";
    return decoder.decode(chunk, { stream: true });
  };
}

export type UseCompletionHelpers = {
  /** The current completion result */
  completion: string;
  /**
   * Send a new prompt to the API endpoint and update the completion state.
   */
  complete: (prompt: string) => Promise<string | null | undefined>;
  /** The error object of the API request */
  error: undefined | Error;
  /**
   * Abort the current API request but keep the generated tokens.
   */
  stop: () => void;
  /** Whether the API request is in progress */
  isLoading: boolean;
};

export function useCompletion({
  id,
}: { id?: string } = {}): UseCompletionHelpers {
  const api = "/api/ai";

  // Generate an unique id for the completion if not provided.
  const hookId = useId();
  const completionId = id || hookId;

  // Store the completion state in SWR, using the completionId as the key to share states.
  const { data, mutate } = useSWR<{
    completion: string;
    isGenerating: boolean;
  }>([api, completionId], null, {
    fallbackData: { completion: "", isGenerating: false },
  });
  const completion = data!.completion;
  const isGenerating = data!.isGenerating;

  // Abort controller to cancel the current API call.
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);

  // Actual mutation hook to send messages to the API endpoint and update the
  // chat state.
  const { error, trigger, isMutating } = useSWRMutation<
    string | null,
    any,
    [string, string],
    {
      prompt: string;
    }
  >(
    [api, completionId],
    async (_, { arg }) => {
      try {
        const { prompt } = arg;

        const abortController = new AbortController();
        setAbortController(abortController);

        // Empty the completion immediately.
        mutate({ completion: "", isGenerating: true }, false);

        const res = await fetch(api, {
          method: "POST",
          body: JSON.stringify({
            prompt,
          }),
          signal: abortController.signal,
        }).catch((err) => {
          throw err;
        });

        if (!res.ok) {
          throw new Error(
            (await res.text()) || "Failed to fetch the chat response."
          );
        }

        if (!res.body) {
          throw new Error("The response body is empty.");
        }

        let result = "";
        const reader = res.body.getReader();
        const decoder = createChunkDecoder();

        while (true) {
          const { done, value } = await reader.read();

          result += decoder(value);

          // Update the completion state with the new message tokens.
          mutate({ completion: result, isGenerating: !done }, false);

          if (done) break;

          // The request has been aborted, stop reading the stream.
          if (abortController === null) {
            reader.cancel();
            break;
          }
        }

        setAbortController(null);
        return result;
      } catch (err) {
        // Ignore abort errors as they are expected.
        if ((err as any).name === "AbortError") {
          setAbortController(null);
          return null;
        }

        throw err;
      }
    },
    {
      populateCache: false,
      revalidate: false,
    }
  );

  const stop = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
  }, [abortController]);

  const complete = useCallback<UseCompletionHelpers["complete"]>(
    async (prompt) => {
      return trigger({
        prompt,
      });
    },
    [trigger]
  );

  return {
    completion,
    complete,
    error,
    stop,
    isLoading: isMutating || isGenerating,
  };
}
