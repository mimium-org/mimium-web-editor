import * as monaco from "monaco-editor";

export function registerThemes(): void {
  monaco.editor.defineTheme("mimium-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword.operator.mimium", foreground: "C586C0", fontStyle: "bold" },
      { token: "keyword.mimium", foreground: "C586C0" },
      { token: "keyword.other.mimium", foreground: "C586C0" },
      { token: "type.mimium", foreground: "4EC9B0" },
      { token: "variable.predefined.mimium", foreground: "9CDCFE", fontStyle: "italic" },
      { token: "support.function.mimium", foreground: "DCDCAA" },
      { token: "number.mimium", foreground: "B5CEA8" },
      { token: "number.float.mimium", foreground: "B5CEA8" },
      { token: "number.hex.mimium", foreground: "B5CEA8" },
      { token: "string.mimium", foreground: "CE9178" },
      { token: "comment.mimium", foreground: "6A9955" },
      { token: "operator.mimium", foreground: "D4D4D4" },
      { token: "constant.language.mimium", foreground: "569CD6" },
    ],
    colors: {
      "editor.background": "#1E1E2E",
      "editor.foreground": "#D4D4D4",
    },
  });

  monaco.editor.defineTheme("mimium-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "keyword.operator.mimium", foreground: "AF00DB", fontStyle: "bold" },
      { token: "keyword.mimium", foreground: "AF00DB" },
      { token: "keyword.other.mimium", foreground: "AF00DB" },
      { token: "type.mimium", foreground: "267F99" },
      { token: "variable.predefined.mimium", foreground: "001080", fontStyle: "italic" },
      { token: "support.function.mimium", foreground: "795E26" },
      { token: "number.mimium", foreground: "098658" },
      { token: "number.float.mimium", foreground: "098658" },
      { token: "string.mimium", foreground: "A31515" },
      { token: "comment.mimium", foreground: "008000" },
      { token: "operator.mimium", foreground: "000000" },
      { token: "constant.language.mimium", foreground: "0000FF" },
    ],
    colors: {},
  });
}
