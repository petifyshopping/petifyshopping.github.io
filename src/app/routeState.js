export function normalizeRoutePath(pathname) {
  return pathname.replace(/\/+$/, "") || "/";
}

export function isPasswordResetLocation(search, hash) {
  const queryParams = new URLSearchParams(search);
  const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
  return (
    queryParams.get("password-reset") === "1" ||
    queryParams.get("view") === "reset-password" ||
    queryParams.get("type") === "recovery" ||
    queryParams.get("error_code") === "otp_expired" ||
    hash === "#reset-password" ||
    hashParams.get("type") === "recovery" ||
    hashParams.get("error_code") === "otp_expired"
  );
}

export function hasSuccessfulEmailConfirmationRedirect(location) {
  const url = new URL(location.href);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  return (
    url.searchParams.get("email-confirmed") === "1" &&
    !url.searchParams.has("error") &&
    !url.searchParams.has("error_code") &&
    !hashParams.has("error") &&
    !hashParams.has("error_code")
  );
}
