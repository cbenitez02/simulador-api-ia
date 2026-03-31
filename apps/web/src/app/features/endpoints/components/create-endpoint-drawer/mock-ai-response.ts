import type { HttpMethod } from '../../../../shared/models/endpoint-preview.model';

/** Local fake “AI” payload for the create-endpoint flow (replace with API later). */
export function mockAiResponseBody(method: HttpMethod, pathRaw: string): unknown {
  const normalized = pathRaw.trim().toLowerCase().replace(/\/+$/, '') || '/';

  if (method === 'GET' && normalized.includes('users')) {
    return {
      users: [
        {
          id: 1,
          name: 'Juan Pérez',
          email: 'juan@example.com',
          orders: [{ id: 101, total: 1200 }],
        },
        {
          id: 2,
          name: 'Ana Gómez',
          email: 'ana@example.com',
          orders: [],
        },
      ],
    };
  }

  if (method === 'GET' && normalized.includes('orders')) {
    return {
      orders: [
        { id: 101, userId: 1, total: 4999, currency: 'usd', status: 'paid' },
        { id: 102, userId: 2, total: 1200, currency: 'usd', status: 'pending' },
      ],
    };
  }

  if ((method === 'POST' || method === 'PUT' || method === 'PATCH') && normalized.includes('users')) {
    return {
      id: 'usr_new',
      name: 'New User',
      email: 'new@example.com',
      createdAt: new Date().toISOString(),
    };
  }

  const displayPath = pathRaw.trim() || '/resource';
  const path = displayPath.startsWith('/') ? displayPath : `/${displayPath}`;

  return {
    message: `Mock ${method} response`,
    path,
    generatedAt: new Date().toISOString(),
    note: 'Replace with your real schema when the generator API is connected.',
  };
}
