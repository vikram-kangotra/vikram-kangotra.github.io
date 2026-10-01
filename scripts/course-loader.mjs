import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const urls = new Map();
async function moduleUrl(url) {
  if (urls.has(url.href)) return urls.get(url.href);
  let source = await readFile(url, 'utf8');
  for (const match of [...source.matchAll(/from\s+(['"])(\.\/[^'"]+)\1/g)]) {
    const child = new URL(match[2].endsWith('.js') ? match[2] : `${match[2]}.js`, url);
    source = source.replace(match[0], `from ${JSON.stringify(await moduleUrl(child))}`);
  }
  const result = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  urls.set(url.href, result);
  return result;
}
export async function readCourseModule(path) { return import(await moduleUrl(new URL(path, root))); }
