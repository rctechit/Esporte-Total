class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  if (response.status === 204) {
    return null;
  }

  let payload = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    payload = await response.json();
  }

  if (!response.ok) {
    const message = (payload && payload.error) || `Erro na requisição (${response.status})`;
    throw new ApiError(message, response.status, payload && payload.details);
  }

  return payload;
}

const api = {
  get: (path) => apiFetch(path),
  post: (path, body) => apiFetch(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: (path, body) => apiFetch(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: (path) => apiFetch(path, { method: "DELETE" }),
};
