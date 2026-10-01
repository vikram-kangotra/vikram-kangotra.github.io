import { useEffect, useRef, useState } from 'react';
import { EditorState, Transaction, Prec } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { StreamLanguage, HighlightStyle, syntaxHighlighting, indentOnInput, bracketMatching, foldGutter, foldKeymap } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { cpp } from '@codemirror/lang-cpp';
import { tags } from '@lezer/highlight';
import styles from './editor.module.css';

const assembly = StreamLanguage.define({
  name: 'NASM',
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match(/;.*/)) return 'comment';
    if (stream.match(/(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/)) return 'string';
    if (stream.match(/(?:0x[\da-f]+|0b[01]+|[0-9][\da-f]*h\b|\d[\d_]*(?:\.[\d_]+)?)/i)) return 'number';
    if (stream.match(/%[\w]+/)) return 'meta';
    if (stream.match(/[.$?\w]+(?=\s*:)/)) return 'labelName';
    if (stream.match(/(?:bits|org|section|segment|global|extern|align|equ|times|db|dw|dd|dq|dt|resb|resw|resd|resq|byte|word|dword|qword|short|near|far|strict)\b/i)) return 'keyword';
    if (stream.match(/(?:[re]?(?:ax|bx|cx|dx|si|di|sp|bp)|[abcd][lh]|[cdefgs]s|[re]?ip|[re]?flags|cr[0-8]|dr[0-7]|[xyz]mm\d+|r(?:[89]|1[0-5])(?:[dwb])?)\b/i)) return 'variableName.special';
    if (stream.match(/(?:mov\w*|lea|push\w*|pop\w*|add|adc|sub|sbb|inc|dec|mul|imul|div|idiv|cmp|test|and|or|xor|not|neg|shl|shr|sal|sar|rol|ror|rcl|rcr|int|iret\w*|syscall|sysret|call|ret\w*|jmp|j\w+|loop\w*|cli|sti|cld|std|hlt|nop|lods\w*|stos\w*|scas\w*|cmps\w*|rep\w*|in|out|lgdt|lidt|ltr|lldt|cpuid|rdmsr|wrmsr|invlpg|xchg|cmpxchg|lock|clc|stc|cmc|cbw|cwd|cdq|cqo|leave|enter|wait|fwait)\b/i)) return 'operatorKeyword';
    if (stream.match(/[+\-*/%&|^~<>!=]+/)) return 'operator';
    if (stream.match(/[[\]()]/)) return 'bracket';
    stream.match(/[\w.$?]+/) || stream.next();
    return null;
  },
  languageData: { commentTokens: { line: ';' } },
});
const colors = HighlightStyle.define([
  { tag: tags.comment, color: 'var(--editor-comment, #838a99)', fontStyle: 'italic' },
  { tag: [tags.keyword, tags.operatorKeyword], color: 'var(--editor-keyword, #c4a9ed)' },
  { tag: [tags.string, tags.character], color: 'var(--editor-string, #a6d88b)' },
  { tag: [tags.number, tags.bool], color: 'var(--editor-number, #e8b17b)' },
  { tag: [tags.special(tags.variableName), tags.typeName], color: 'var(--editor-register, #8fcbd8)' },
  { tag: [tags.labelName, tags.function(tags.variableName)], color: 'var(--editor-label, #e7ce88)' },
  { tag: [tags.meta, tags.operator], color: 'var(--editor-meta, #c2c8d5)' },
]);
const appearance = EditorView.theme({
  '&': { height: '100%', fontSize: '13px', backgroundColor: 'var(--code-bg)', color: 'var(--code-ink)' },
  '.cm-scroller': { fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace', lineHeight: '1.75', overflow: 'auto' },
  '.cm-content': { padding: '13px 0', caretColor: 'var(--accent)' },
  '.cm-line': { padding: '0 17px 0 10px' },
  '.cm-gutters': { backgroundColor: 'var(--code-bg)', color: 'var(--muted)', border: '0', padding: '0 4px 0 10px', minWidth: '42px' },
  '.cm-gutterElement': { opacity: '1' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--ink)', opacity: '1' },
  '.cm-activeLine': { backgroundColor: 'var(--editor-active-line, #ffffff05)' },
  '.cm-cursor': { borderLeftColor: 'var(--accent)' },
  '&.cm-focused': { outline: 'none' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'var(--editor-selection, #4f654f66)' },
  '.cm-matchingBracket': { color: 'var(--accent)', backgroundColor: 'var(--soft)', outline: '1px solid var(--line)' },
  '.cm-selectionMatch': { backgroundColor: 'var(--soft)' },
  '.cm-panels': { backgroundColor: 'var(--surface)', color: 'var(--ink)', borderColor: 'var(--line)' },
  '.cm-textfield, .cm-button': { color: 'var(--ink)', background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: '3px', fontSize: '11px' },
  '.cm-foldPlaceholder': { backgroundColor: 'var(--surface)', color: 'var(--muted)', borderColor: 'var(--line)' },
});

export default function CodeEditor({ id, value, onChange, language = 'asm', label = 'Source code', onRun, fill = false, startAt, revealLocation, maxLength = Infinity }) {
  const parent = useRef(null);
  const view = useRef(null);
  const externalUpdate = useRef(false);
  const latest = useRef({ value, onChange, onRun, maxLength });
  latest.current = { value, onChange, onRun, maxLength };
  const [limitNotice, setLimitNotice] = useState('');
  const [position, setPosition] = useState({ line: 1, column: 1 });
  useEffect(() => {
    const languageSupport = /^(c|cpp|c\+\+|h)$/i.test(language) ? cpp() : /^(asm|assembly|nasm|x86)$/i.test(language) ? assembly : [];
    const instance = new EditorView({
      parent: parent.current,
      state: EditorState.create({
        doc: latest.current.value || '',
        extensions: [
          EditorState.transactionFilter.of((transaction) => {
            if (!externalUpdate.current && transaction.docChanged && transaction.newDoc.length > latest.current.maxLength && transaction.newDoc.length >= transaction.startState.doc.length) {
              setLimitNotice('Edit exceeds the project size limit. Shorten this paste or remove unused source first.');
              return [];
            }
            if (transaction.docChanged) setLimitNotice('');
            return transaction;
          }),
          lineNumbers(), highlightActiveLineGutter(), highlightSpecialChars(), history(), drawSelection(), dropCursor(),
          EditorState.allowMultipleSelections.of(true), EditorState.tabSize.of(4), indentOnInput(), bracketMatching(), closeBrackets(),
          rectangularSelection(), highlightActiveLine(), highlightSelectionMatches(), foldGutter(), languageSupport,
          syntaxHighlighting(colors), appearance,
          EditorView.contentAttributes.of({ id, role: 'textbox', tabindex: '0', 'aria-label': label, 'aria-multiline': 'true', 'aria-describedby': `${id}-keyboard-help`, spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off' }),
          Prec.high(keymap.of([{ key: 'Mod-Enter', run: () => { if (!latest.current.onRun) return false; latest.current.onRun(); return true; } }])),
          keymap.of([
            ...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, indentWithTab,
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !externalUpdate.current) latest.current.onChange?.(update.state.doc.toString());
            if (update.docChanged || update.selectionSet) {
              const head = update.state.selection.main.head;
              const line = update.state.doc.lineAt(head);
              setPosition({ line: line.number, column: head - line.from + 1 });
            }
          }),
        ],
      }),
    });
    view.current = instance;
    if (startAt) { const index = instance.state.doc.toString().indexOf(startAt); if (index >= 0) instance.dispatch({ selection: { anchor: index + startAt.length }, effects: EditorView.scrollIntoView(index, { y: 'start' }) }); }
    return () => { view.current = null; instance.destroy(); };
  }, [id, label, language, startAt]);
  useEffect(() => {
    const instance = view.current;
    const next = value || '';
    if (!instance || instance.state.doc.toString() === next) return;
    externalUpdate.current = true;
    const marker = startAt ? next.indexOf(startAt) : -1;
    const position = marker >= 0 ? marker + startAt.length : 0;
    instance.dispatch({ changes: { from: 0, to: instance.state.doc.length, insert: next }, selection: { anchor: position }, effects: EditorView.scrollIntoView(position, { y: 'start' }), annotations: Transaction.addToHistory.of(false) });
    externalUpdate.current = false;
  }, [value, startAt]);
  useEffect(() => {
    const instance = view.current;
    if (!instance || !revealLocation) return;
    const line = instance.state.doc.line(Math.max(1, Math.min(instance.state.doc.lines, revealLocation.line || 1)));
    const position = Math.min(line.to, line.from + Math.max(0, (revealLocation.column || 1) - 1));
    instance.dispatch({ selection: { anchor: position }, effects: EditorView.scrollIntoView(position, { y: 'center' }) });
    instance.focus();
  }, [revealLocation]);
  return <div className={`${styles.frame} ${fill ? styles.fill : ''}`}>
    {limitNotice && <p role="status" style={{ margin: 0, padding: '5px 10px', fontSize: 11, color: 'var(--ink)' }}>{limitNotice}</p>}
    <div ref={parent} className={styles.host} />
    <div className={styles.footer}><span>Ln {position.line}, Col {position.column}</span><span id={`${id}-keyboard-help`}>Tab indents · Esc, Tab to leave</span><span>UTF-8</span></div>
  </div>;
}
