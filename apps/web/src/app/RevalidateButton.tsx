"use client";

export function RevalidateButton() {
  return <button onClick={() => fetch("/api/revalidate")}>revalidate</button>;
}
