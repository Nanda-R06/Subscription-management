const API_BASE = '/api/v1';

export async function apiRequest(endpoint, { method = 'GET', body, headers = {}, token = null } = {}) {
  const reqHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  };

  const storedToken = token || localStorage.getItem('bl_access_token');
  if (storedToken) {
    reqHeaders['Authorization'] = `Bearer ${storedToken}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // If unauthorized and we have a refresh token, attempt token refresh once
    if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/refresh-token') {
      const refreshToken = localStorage.getItem('bl_refresh_token');
      if (refreshToken) {
        try {
          const refreshRes = await fetch(`${API_BASE}/auth/refresh-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });
          const refreshData = await refreshRes.json();
          if (refreshRes.ok && refreshData.data?.accessToken) {
            localStorage.setItem('bl_access_token', refreshData.data.accessToken);
            localStorage.setItem('bl_refresh_token', refreshData.data.refreshToken);

            // Retry original request with new token
            reqHeaders['Authorization'] = `Bearer ${refreshData.data.accessToken}`;
            const retryRes = await fetch(`${API_BASE}${endpoint}`, {
              method,
              headers: reqHeaders,
              body: body ? JSON.stringify(body) : undefined,
            });
            return await retryRes.json();
          }
        } catch {
          // Token refresh failed, continue to throw
        }
      }
    }

    const error = new Error(data.error?.message || 'Request failed');
    error.status = response.status;
    error.code = data.error?.code;
    error.details = data.error?.details;
    throw error;
  }

  return data;
}
