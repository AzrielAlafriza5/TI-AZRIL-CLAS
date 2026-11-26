let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!isFormData && options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const isJson = contentType.includes('application/json');
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    if (res.status === 405 && !isJson) {
      throw new ApiError(
        'Server backend API belum aktif (HTTP 405). Pastikan server backend atau Vercel /api serverless functions telah di-deploy.',
        405
      );
    }
    const message =
      typeof data === 'object' && data && 'error' in data
        ? String((data as any).error)
        : `Permintaan gagal (${res.status})`;
    throw new ApiError(message, res.status);
  }

  if (path.startsWith('/api') && !isJson) {
    throw new ApiError(
      'Backend API tidak terhubung (respons bukan JSON). Pastikan /api berjalan dengan benar.',
      503
    );
  }

  return data as T;
}

export async function uploadFileToServer(file: File): Promise<{ file_url: string; file_name: string }> {
  const form = new FormData();
  form.append('file', file);
  return apiFetch('/api/upload', {
    method: 'POST',
    body: form,
  });
}

export function downloadProtectedFile(fileUrl: string, suggestedName?: string): void {
  const headers: Record<string, string> = {};
  if (inMemoryToken) {
    headers.Authorization = `Bearer ${inMemoryToken}`;
  }
  fetch(fileUrl, { headers, credentials: 'include' })
    .then(async (res) => {
      if (!res.ok) throw new Error('Gagal mengunduh file');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = suggestedName || 'lampiran';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    })
    .catch(() => {
      // handled silently or via toast in caller
    });
}
