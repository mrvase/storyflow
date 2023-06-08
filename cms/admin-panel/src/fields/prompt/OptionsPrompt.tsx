import { Option } from "./Option";
import { Option as OptionType } from "@storyflow/shared/types";

export function OptionsPrompt({ options }: { options: OptionType[] }) {
  return (
    <div className="p-2.5">
      <div className="font-medium text-gray-400 mb-1 ml-1">Muligheder</div>
      {options.map((el) => (
        <Option key={el.value} value={el.value} onEnter={() => {}}>
          {el.label ?? el.alias ?? el.value}
        </Option>
      ))}
    </div>
  );
}
