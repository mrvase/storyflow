import { Result } from "@storyflow/result";

export function onInterval(
  callback: (
    event: "start" | "stop" | "interval" | "unload"
  ) => Promise<Result<any>> | undefined,
  options: {
    duration?: number;
  } = {}
) {
  let { duration = 2000 } = options;

  let int: ReturnType<typeof setInterval> | null = null;

  let error = false;

  const run = async (event: "start" | "stop" | "interval" | "unload") => {
    const result = await callback(event);
    /*
    if (result && isError(result)) {
      error = true;
      startInterval(); // this might change the condition for the interval
    }
    */
  };

  const startInterval = async () => {
    if (int === null) {
      int = setInterval(() => run("interval"), duration);
    }
  };

  const stopInterval = () => {
    // BLOCKING UPLOAD AS WELL!!
    if (int !== null) {
      clearInterval(int);
      setTimeout(() => run("stop"), duration); // one last run
      int = null;
    }
  };

  const onFocus = () => {
    startInterval();
  };

  const onBlur = () => {
    stopInterval();
  };

  const onUnload = async () => {
    run("unload");
    localStorage.setItem(
      "UNLOADED",
      String(Number(localStorage.getItem("UNLOADED") ?? "0") + 1)
    );
  };

  const start = () => {
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    window.addEventListener("beforeunload", onUnload);

    if (document.hasFocus()) {
      startInterval();
    }
    if (int === null) {
      run("start");
    }

    return stop;
  };

  const stop = () => {
    if (int !== null) {
      clearInterval(int);
      int = null;
    }
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("beforeunload", onUnload);
  };

  return start();
}
