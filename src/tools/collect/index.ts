import { getCollectBalance } from "./get_collect_balance.js";
import { listCollectVouchers } from "./list_collect_vouchers.js";
import { listCollectHistory } from "./list_collect_history.js";
import { redeemCollectPoints } from "./redeem_collect_points.js";

export const tools = [
  getCollectBalance,
  listCollectVouchers,
  listCollectHistory,
  redeemCollectPoints
];
