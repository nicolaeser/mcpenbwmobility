import { listChargingHistory } from "./list_charging_history.js";
import { getActiveCharging } from "./get_active_charging.js";
import { listBookings } from "./list_bookings.js";

export const tools = [
  listChargingHistory,
  getActiveCharging,
  listBookings
];
