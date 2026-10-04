import { mkdir, writeFile } from 'node:fs/promises';
import { readCourseModule } from './course-loader.mjs';

const { chapters } = await readCourseModule('src/course/index.js');
const { buildTopicCatalog } = await readCourseModule('src/course/topicCatalog.js');
const directory = new URL('../public/course/', import.meta.url);
await mkdir(directory, { recursive: true });
const catalog = buildTopicCatalog(chapters);
await writeFile(new URL('topic-catalog.json', directory), JSON.stringify(catalog));
console.log(`Generated search index for ${catalog.length} lessons and topics.`);
