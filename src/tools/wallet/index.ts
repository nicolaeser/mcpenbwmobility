import { listWallet } from "./list_wallet.js";
import { redeemVoucher } from "./redeem_voucher.js";
import { applyIssuedCollectVouchers } from "./apply_issued_collect_vouchers.js";

export const tools = [
  listWallet,
  redeemVoucher,
  applyIssuedCollectVouchers
];
