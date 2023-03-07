import { DragIcon } from "./DragIcon";

function Space({
  label,
  buttons,
  children,
}: {
  label: string;
  buttons: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center mb-3.5 h-7 px-5">
        <div className="cursor-grab opacity-25 hover:opacity-100 transition-opacity">
          <DragIcon className="w-4 h-4 mr-5" />
        </div>
        <h2 className="text-gray-400">{label}</h2>
        <div className="ml-auto flex gap-2">{buttons}</div>
      </div>
      {children}
    </div>
  );
}

function Button({
  icon: Icon,
  onClick,
}: {
  icon: React.FC<{ className: string }>;
  onClick: () => void;
}) {
  return (
    <button
      className="px-3 rounded py-1.5 ring-button text-button"
      onClick={onClick}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

export default Object.assign(Space, {
  Button,
});
