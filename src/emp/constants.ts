export const AUTH_DOMAIN = "https://myenergykey.com";
export const AUTH_CLIENT_ID = "MCVlPomnunRHO86S3Ju1JUJENA8hEI4i";
export const AUTH_REDIRECT_URI = "emob://myenergykey.com/android/com.enbw.ev/callback";
export const AUTH_AUDIENCE = "https://pro-login.enbw.com/";
export const AUTH_SCOPE = "openid email offline_access";
export const AUTH_CUSTOM_SCOPE = [
  "read:bsr:airship",
  "read:bsr:emp",
  "read:bsr:lms",
  "read:bsr:cmdm",
  "read:bsr:permission",
  "read:bsr:thunderhead",
  "read:bsr:smart-mobility",
  "read:bsr:mobilityplus-engage"
].join(" ");

export const EMP_API_BASE = "https://api.emp.emob-enbw.com/emobility-complete/api/";
export const EMP_SUBSCRIPTION_KEY = "c7097f4712dd4c20aae95ff6ad95d171";
export const EMP_APP_VERSION = "8.18.2 (build 410)";
export const EMP_VERSION_CODE = "410";
export const BROWSER_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
export const OKHTTP_UA = "okhttp/4.12.0";
