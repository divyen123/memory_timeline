const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

const normalizeApiBase = (value = "") => String(value || "")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api$/i, "");

const getRequestBody = (request) => new Promise((resolve, reject) => {
  const chunks = [];

  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", () => resolve(Buffer.concat(chunks)));
  request.on("error", reject);
});

const getProxyPath = (request) => {
  const rawPath = Array.isArray(request.query?.path)
    ? request.query.path.join("/")
    : String(request.query?.path || "");

  return rawPath
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(decodeURIComponent(part)))
    .join("/");
};

export default async function handler(request, response) {
  const apiBase = normalizeApiBase(process.env.API_PROXY_URL || process.env.VITE_API_URL);

  if(!apiBase || apiBase.startsWith("/")){
    response.status(500).json({message:"API proxy URL is not configured"});
    return;
  }

  const path = getProxyPath(request);
  const incomingUrl = new URL(request.url, "https://memory-timeline.local");
  incomingUrl.searchParams.delete("path");
  const query = incomingUrl.search || "";
  const targetUrl = apiBase + "/api/" + path + query;
  const headers = new Headers();

  Object.entries(request.headers).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase();

    if(HOP_BY_HOP_HEADERS.has(lowerKey) || value === undefined){
      return;
    }

    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  });

  headers.set("x-forwarded-host", request.headers.host || "");
  headers.set("x-forwarded-proto", "https");

  const hasBody = !["GET", "HEAD"].includes(String(request.method || "GET").toUpperCase());
  let upstreamResponse;

  try{
    upstreamResponse = await fetch(targetUrl, {
      method:request.method,
      headers,
      body:hasBody ? await getRequestBody(request) : undefined,
      redirect:"manual"
    });
  }catch{
    response.status(502).json({message:"API server is unreachable"});
    return;
  }

  response.status(upstreamResponse.status);

  upstreamResponse.headers.forEach((value, key) => {
    if(!HOP_BY_HOP_HEADERS.has(key.toLowerCase())){
      response.setHeader(key, value);
    }
  });

  const setCookie = upstreamResponse.headers.getSetCookie?.() || [];
  if(setCookie.length){
    response.setHeader("set-cookie", setCookie);
  }

  const body = Buffer.from(await upstreamResponse.arrayBuffer());
  response.send(body);
}
