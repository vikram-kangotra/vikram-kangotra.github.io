export const articleTopics = {
  'wraping-up-gsoc-2024-with-videolan': ['Rust', 'WebAssembly', 'VideoLAN'],
  'a-summer-of-code-my-gsoc-2023-conclusion': ['Rust', 'VideoLAN', 'GSoC'],
  'quest-for-the-right-project': ['GSoC', 'Open source'],
  'a-twist-of-fate': ['GNOME', 'Open source'],
  'crafting-a-distinctive-path': ['Rust', 'GTK', 'GSoC'],
  'embarking-on-a-code-odyssey': ['GSoC', 'Open source'],
};
export function topicsFor(slug) {
  return articleTopics[slug] || ['Open source'];
}
