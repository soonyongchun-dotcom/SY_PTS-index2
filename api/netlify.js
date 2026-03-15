// Helper to adapt a Vercel-style handler (req, res) into a Netlify Function handler.

const createHandler = (handler) => {
  return async (event, context) => {
    const headers = { ...(event.headers || {}) };

    // Normalize header keys to exactly what the handler expects (case-insensitive)
    const normalizedHeaders = {};
    Object.entries(headers).forEach(([k, v]) => {
      normalizedHeaders[k.toLowerCase()] = v;
    });

    const req = {
      method: event.httpMethod,
      headers: normalizedHeaders,
      query: event.queryStringParameters || {},
      body: event.body,
    };

    let status = 200;
    const responseHeaders = {};
    let body = '';

    const res = {
      setHeader: (key, value) => {
        responseHeaders[key] = value;
      },
      status: (code) => {
        status = code;
        return res;
      },
      json: (payload) => {
        body = JSON.stringify(payload);
        responseHeaders['Content-Type'] = 'application/json';
        return res;
      },
      end: (payload) => {
        body = payload ?? '';
        return res;
      },
    };

    await handler(req, res);

    return {
      statusCode: status,
      headers: responseHeaders,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    };
  };
};

module.exports = { createHandler };
