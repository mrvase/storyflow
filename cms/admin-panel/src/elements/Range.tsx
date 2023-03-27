import React from "react";

export function Range({
  value: valueFromProps,
  setValue: setValueFromProps,
}: {
  value: number;
  setValue: (value: number) => void;
}) {
  const [value, setValue] = React.useState(valueFromProps);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(Number(e.target.value));
  };

  return (
    <div className="flex">
      <input
        type="range"
        className="w-full"
        min={1}
        max={25}
        value={value}
        onChange={handleChange}
        onMouseUp={() => valueFromProps !== value && setValueFromProps(value)}
      />
      <span className="text-xs font-bold opacity-75 w-8 text-right">
        {value}
      </span>
    </div>
  );
}
