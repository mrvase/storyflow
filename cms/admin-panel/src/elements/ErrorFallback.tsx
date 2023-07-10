import React from "react";
import { FallbackProps } from "react-error-boundary";

export function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const [showMessage, toggleMessage] = React.useReducer((ps) => !ps, false);
  return (
    <div className="p-5 bg-white dark:bg-gray-850 text-center h-full">
      Der skete en fejl 💥
      <br />
      <br />
      <button
        onClick={() => {
          resetErrorBoundary();
        }}
        className="py-2 px-3 rounded bg-teal-600 mx-auto hover:bg-teal-700"
      >
        Prøv igen.
      </button>
      <br />
      <br />
      <div className="text-red-300 text-sm">
        <button
          onClick={() => {
            toggleMessage();
            console.error(error);
          }}
        >
          {showMessage ? "Skjul" : "Vis"} fejlmeddelelse
        </button>
        {showMessage && (
          <>
            <br />
            {error.message}
          </>
        )}
      </div>
    </div>
  );
}
