const DEPLOYED_API_BASE_URL = "https://backend.swagatsuite.com/api";
const LOCAL_API_BASE_URL = "http://localhost:4510/api";
const HEALTH_CHECK_TIMEOUT_MS = 5000;

export let API_BASE_URL = DEPLOYED_API_BASE_URL;

function toHealthUrl(apiBaseUrl) {
  return apiBaseUrl.replace(/\/api\/?$/, "/");
}

async function isBackendReachable(apiBaseUrl) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(toHealthUrl(apiBaseUrl), {
      method: "GET",
      signal: controller.signal,
      cache: "no-store"
    });
    return response.ok;
  } catch (_error) {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function resolveApiBaseUrl() {
  if (await isBackendReachable(DEPLOYED_API_BASE_URL)) {
    return DEPLOYED_API_BASE_URL;
  }

  if (await isBackendReachable(LOCAL_API_BASE_URL)) {
    return LOCAL_API_BASE_URL;
  }

  return DEPLOYED_API_BASE_URL;
}

let apiBaseUrlPromise = null;

export function ensureApiBaseUrl() {
  if (!apiBaseUrlPromise) {
    apiBaseUrlPromise = resolveApiBaseUrl().then((resolvedBaseUrl) => {
      API_BASE_URL = resolvedBaseUrl;
      return API_BASE_URL;
    });
  }

  return apiBaseUrlPromise;
}
