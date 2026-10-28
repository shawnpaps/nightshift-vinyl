// Local verification of the generated Vercel fetch handler; this is not a deployment.
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import app from '../.vercel/output/_functions/entry.mjs';

const port = Number(process.env.PORT || 4322);
const staticRoot = resolve('.vercel/output/static');
createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, `http://localhost:${port}`);
    const file = resolve(staticRoot, `.${decodeURIComponent(url.pathname)}`);
    if (file.startsWith(staticRoot + sep)) {
      try {
        const content = await readFile(file);
        const types = { '.js':'application/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.ico':'image/x-icon' };
        outgoing.setHeader('Content-Type',types[extname(file)] || 'application/octet-stream');
        outgoing.end(content); return;
      } catch { /* Dynamic route: let the generated Vercel handler respond. */ }
    }
    const headers = new Headers();
    for (const [name,value] of Object.entries(incoming.headers)) if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    headers.set('x-forwarded-for',incoming.socket.remoteAddress || '127.0.0.1');
    const request = new Request(url,{ method:incoming.method,headers,...(!['GET','HEAD'].includes(incoming.method) ? {body:Readable.toWeb(incoming),duplex:'half'} : {}) });
    const response = await app.fetch(request);
    outgoing.statusCode = response.status;
    for (const [name,value] of response.headers) if (name !== 'set-cookie') outgoing.setHeader(name,value);
    if (response.headers.getSetCookie().length) outgoing.setHeader('Set-Cookie',response.headers.getSetCookie());
    if (response.body) Readable.fromWeb(response.body).pipe(outgoing); else outgoing.end();
  } catch (error) { console.error(error); outgoing.statusCode = 500; outgoing.end('Preview request failed'); }
}).listen(port,'127.0.0.1',() => console.log(`Vercel production bundle: http://localhost:${port}`));
