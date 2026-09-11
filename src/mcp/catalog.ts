import { tools as account } from "../tools/account/index.js";
import { tools as charging } from "../tools/charging/index.js";
import { tools as collect } from "../tools/collect/index.js";
import { tools as favorites } from "../tools/favorites/index.js";
import { tools as history } from "../tools/history/index.js";
import { tools as invoices } from "../tools/invoices/index.js";
import { tools as search } from "../tools/search/index.js";
import { tools as stations } from "../tools/stations/index.js";
import { tools as wallet } from "../tools/wallet/index.js";

export const TOOL_CATALOG = [
  ...account,
  ...charging,
  ...collect,
  ...favorites,
  ...history,
  ...invoices,
  ...search,
  ...stations,
  ...wallet
];

export const TOOL_NAMES = TOOL_CATALOG.map((entry) => entry.name);
