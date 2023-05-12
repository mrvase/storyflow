export const DragIcon = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className ?? "w-6 h-6"}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M 9 6.75 a 0.75 0.75 0 1 1 0 -1.5 a 0.75 0.75 0 0 1 0 1.5 z M 9 12.75 a 0.75 0.75 0 1 1 0 -1.5 a 0.75 0.75 0 0 1 0 1.5 z M 9 18.75 a 0.75 0.75 0 1 1 0 -1.5 a 0.75 0.75 0 0 1 0 1.5 z M 15 6.75 a 0.75 0.75 0 1 1 0 -1.5 a 0.75 0.75 0 0 1 0 1.5 z M 15 12.75 a 0.75 0.75 0 1 1 0 -1.5 a 0.75 0.75 0 0 1 0 1.5 z M 15 18.75 a 0.75 0.75 0 1 1 0 -1.5 a 0.75 0.75 0 0 1 0 1.5 z"
      />
    </svg>
  );
};
