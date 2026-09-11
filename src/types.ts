import type { LoginBag } from "./auth/fields.js";
import type { CollectClient } from "./collect/client.js";
import type { EmpClient } from "./emp/client.js";

export interface ToolContext {
  readonly client: EmpClient;
  readonly collect: CollectClient;
  readonly bag: LoginBag;
  readonly secrets: readonly string[];
}

export type ToolContent = {
  readonly type: "text";
  readonly text: string;
};

export interface ToolResult {
  readonly content: readonly ToolContent[];
  readonly isError?: boolean;
}
