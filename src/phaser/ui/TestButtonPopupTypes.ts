export type PopupButton = { label: string; onClick?: () => void };

export type ScenarioPickerConfig = {
  title?: string;
  options: string[];
  value?: string;
  onChange?: (value: string) => void;
};

export type TestButtonPopupConfig = Partial<
  Record<"button1" | "button2" | "button3" | "button4" | "button5" | "button6" | "button7" | "button8", PopupButton>
> & {
  gameId?: string;
  joinToken?: string;
  isAutoPolling?: boolean;
  joinUrlBase?: string;
  scenarioPicker?: ScenarioPickerConfig;
};
