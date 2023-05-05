import { Result } from "@storyflow/result";

export function onInterval(
  callback: (
    index: number,
    event: "start" | "stop" | "interval" | "unload" | "visibilitychange"
  ) => void,
  options: {
    duration?: number;
  } = {}
) {
  let { duration = 2000 } = options;

  let int: ReturnType<typeof setInterval> | null = null;

  let index = 0;

  // moved throttle in here from calling function
  let lastSync = 0;
  function throttle<T>(callback: () => T, time: number): T | undefined {
    if (Date.now() - lastSync > time) {
      return callback();
    }
    return;
  }

  const run = async (
    event: "start" | "stop" | "interval" | "unload" | "visibilitychange"
  ) => {
    if (
      event === "start" ||
      event === "unload" ||
      event === "visibilitychange"
    ) {
      lastSync = Date.now();
      return await callback(index++, event);
    }
    return await throttle(() => {
      lastSync = Date.now();
      return callback(index++, event);
    }, duration / 2);
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
    run("start");
    startInterval();
  };

  const onBlur = () => {
    stopInterval();
  };

  const onVisibilityChange = async () => {
    run("visibilitychange");
  };

  const onUnload = async () => {
    run("unload");
    /*
    localStorage.setItem(
      "UNLOADED",
      String(Number(localStorage.getItem("UNLOADED") ?? "0") + 1)
    );
    */
  };

  const start = () => {
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    window.addEventListener("visibilitychange", onVisibilityChange);
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
    window.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("beforeunload", onUnload);
  };

  return start();
}
