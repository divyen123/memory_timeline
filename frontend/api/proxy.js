import http from "node:http";
import https from "node:https";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
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

const buildForwardHeaders = (request, target) => {
  const headers = {};

  Object.entries(request.headers).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase();

    if(HOP_BY_HOP_HEADERS.has(lowerKey) || value === undefined){
      return;
    }

    headers[key] = Array.isArray(value) ? value.join(", ") : value;
  });

  headers.host = target.host;
  headers["x-forwarded-host"] = request.headers.host || "";
  headers["x-forwarded-proto"] = "https";

  return headers;
};

const requestUpstream = (targetUrl, request, body) => new Promise((resolve, reject) => {
  const target = new URL(targetUrl);
  const client = target.protocol === "http:" ? http : https;
  const upstreamRequest = client.request({
    protocol:target.protocol,
    hostname:target.hostname,
    port:target.port || undefined,
    path:target.pathname + target.search,
    method:request.method,
    headers:buildForwardHeaders(request, target)
  }, (upstreamResponse) => {
    const chunks = [];

    upstreamResponse.on("data", (chunk) => chunks.push(chunk));
    upstreamResponse.on("end", () => {
      resolve({
        statusCode:upstreamResponse.statusCode || 502,
        headers:upstreamResponse.headers,
        body:Buffer.concat(chunks)
      });
    });
  });

  upstreamRequest.on("error", reject);

  if(body?.length){
    upstreamRequest.write(body);
  }

  upstreamRequest.end();
});

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
  const hasBody = !["GET", "HEAD"].includes(String(request.method || "GET").toUpperCase());
  let upstream;

  try{
    upstream = await requestUpstream(targetUrl, request, hasBody ? await getRequestBody(request) : undefined);
  }catch{
    response.status(502).json({message:"API server is unreachable"});
    return;
  }

  response.status(upstream.statusCode);

  Object.entries(upstream.headers).forEach(([key, value]) => {
    if(!HOP_BY_HOP_HEADERS.has(key.toLowerCase()) && value !== undefined){
      response.setHeader(key, value);
    }
  });

  response.send(upstream.body);
}
