import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { FiChevronDown, FiChevronRight, FiCode, FiEdit2, FiFile, FiFilePlus, FiFolder, FiFolderMinus, FiSidebar, FiTrash2, FiX } from 'react-icons/fi';
import CodeEditor from './CodeEditor';
import styles from './project-editor.module.css';

function sourceLanguage(path) {
  if (/\.(c|h|cc|cpp|hpp)$/i.test(path)) return 'c';
  if (/\.(asm|inc|s)$/i.test(path)) return 'asm';
  return 'text';
}
function sourceLabel(path) {
  const language = sourceLanguage(path);
  return language === 'c' ? (/\.(cc|cpp|hpp)$/i.test(path) ? 'C++' : 'C') : language === 'asm' ? 'Assembly' : 'Plain text';
}
function baseName(path) { return path.split('/').pop(); }
function parentDirectory(path) {
  const index = path.lastIndexOf('/');
  return index < 0 ? '' : path.slice(0, index + 1);
}
function directoryTree(paths) {
  const root = { children: [] };
  paths.forEach((path) => {
    const segments = path.split('/');
    let parent = root;
    segments.forEach((name, index) => {
      const currentPath = segments.slice(0, index + 1).join('/');
      const isFolder = index < segments.length - 1;
      let node = parent.children.find((child) => child.path === currentPath);
      if (!node) {
        node = { name, path: currentPath, folder: isFolder, children: [] };
        parent.children.push(node);
      }
      parent = node;
    });
  });
  function sort(nodes) {
    nodes.sort((a, b) => Number(b.folder) - Number(a.folder) || a.name.localeCompare(b.name));
    nodes.forEach((node) => sort(node.children));
  }
  sort(root.children);
  return root.children;
}
function expandParents(path, previous) {
  const next = { ...previous };
  const parts = path.split('/');
  for (let index = 1; index < parts.length; index += 1) next[parts.slice(0, index).join('/')] = true;
  return next;
}
function validatePath(raw, paths, original) {
  const path = raw.trim();
  if (!path) return 'Enter a file path, such as kernel.c or include/console.h.';
  if (path.length > 160) return 'Keep the file path to 160 characters or fewer.';
  if (path.startsWith('/') || path.endsWith('/') || path.includes('\\')) return 'Use a relative file path with / between folders, such as src/kernel.c.';
  const parts = path.split('/');
  if (parts.length > 8) return 'Use no more than eight folder and file names in a path.';
  if (parts.some((part) => !part || part === '.' || part === '..' || !/^[a-zA-Z0-9_.-]+$/.test(part))) return 'Use letters, numbers, dots, underscores, and hyphens in each name. Empty, . and .. folders are not allowed.';
  const others = paths.filter((candidate) => candidate !== original);
  if (others.includes(path)) return 'A file already exists at this path. Choose another name.';
  if (others.some((candidate) => candidate.startsWith(`${path}/`) || path.startsWith(`${candidate}/`))) return 'A file and a folder cannot share the same path. Choose another name.';
  return '';
}
function editorId(path) { return `project-source-${encodeURIComponent(path)}`; }
function tabId(path) { return `${editorId(path)}-tab`; }
function panelId(path) { return `${editorId(path)}-panel`; }

function FileIcon({ path }) {
  const language = sourceLanguage(path);
  if (language === 'c') return <span className={styles.cIcon} aria-hidden="true">C</span>;
  if (language === 'asm') return <FiCode aria-hidden="true" />;
  return <FiFile aria-hidden="true" />;
}

/**
 * Files and their persisted contents belong to the parent. This component owns
 * only open tabs, the explorer state, and the file-operation dialog.
 * `disabled` pauses file mutations and Run; editing stays available to the
 * parent's source-revision checks while a build is in progress.
 */
export default function ProjectEditor({ files = {}, activeFile, onSelectFile, onEditFile, onCreateFile, onRenameFile, onDeleteFile, onRun, startAt, entryPath = 'boot.asm', projectMode, disabled = false, revealLocation }) {
  const paths = Object.keys(files).sort();
  const totalSourceLength = Object.values(files).reduce((total, source) => total + source.length, 0);
  const pathsKey = JSON.stringify(paths);
  const selectedInitially = activeFile && Object.prototype.hasOwnProperty.call(files, activeFile) ? activeFile : Object.prototype.hasOwnProperty.call(files, entryPath) ? entryPath : paths[0];
  const [openFiles, setOpenFiles] = useState(() => selectedInitially ? [selectedInitially] : []);
  const [expanded, setExpanded] = useState(() => expandParents(selectedInitially || '', {}));
  // A learner's desktop choice takes precedence over the project-size default.
  // Keep the narrow-screen drawer separate so resizing never loses that choice.
  const [explorerPreference, setExplorerPreference] = useState(null);
  const [mobileExplorerOpen, setMobileExplorerOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [operation, setOperation] = useState(null);
  const [pathInput, setPathInput] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const workspace = useRef(null);
  const explorerToggle = useRef(null);
  const tabs = useRef({});
  const dialog = useRef(null);
  const pathField = useRef(null);
  const dialogId = useId();
  const tree = useMemo(() => directoryTree(JSON.parse(pathsKey)), [pathsKey]);
  const existingOpenFiles = openFiles.filter((path) => Object.prototype.hasOwnProperty.call(files, path));
  const displayedFile = existingOpenFiles.includes(activeFile) ? activeFile : existingOpenFiles[0] || '';
  const defaultExplorerOpen = projectMode === 'kernel' || paths.filter((path) => sourceLanguage(path) !== 'text').length > 2;
  const showExplorer = compact ? mobileExplorerOpen : explorerPreference ?? defaultExplorerOpen;
  const showTabs = paths.length > 1;

  // A change requested by the parent (for example, a compiler diagnostic) opens
  // that file. Closing a tab does not itself change activeFile, so it stays shut.
  useEffect(() => {
    const currentPaths = JSON.parse(pathsKey);
    setOpenFiles((previous) => {
      const remaining = previous.filter((path) => currentPaths.includes(path));
      if (activeFile && currentPaths.includes(activeFile) && !remaining.includes(activeFile)) remaining.push(activeFile);
      return remaining.length === previous.length && remaining.every((path, index) => path === previous[index]) ? previous : remaining;
    });
    if (activeFile) setExpanded((previous) => expandParents(activeFile, previous));
  }, [activeFile, pathsKey]);

  useEffect(() => {
    const element = workspace.current;
    if (!element || typeof window.ResizeObserver !== 'function') return undefined;
    const observer = new window.ResizeObserver(([entry]) => {
      const nextCompact = entry.contentRect.width < 600;
      setCompact(nextCompact);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (displayedFile) tabs.current[displayedFile]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [displayedFile]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (operation && !element.open) {
      element.showModal();
      if (operation.kind !== 'delete') {
        pathField.current?.focus();
        if (operation.kind === 'rename') pathField.current?.select();
      }
    } else if (!operation && element.open) element.close();
  }, [operation]);

  function setExplorerOpen(open) {
    if (compact) setMobileExplorerOpen(open);
    else setExplorerPreference(open);
  }
  function openFile(path, focusTab = false) {
    setOpenFiles((previous) => previous.includes(path) ? previous : [...previous, path]);
    setExpanded((previous) => expandParents(path, previous));
    onSelectFile?.(path);
    if (compact) setMobileExplorerOpen(false);
    if (focusTab) tabs.current[path]?.focus();
  }
  function closeTab(path) {
    const index = existingOpenFiles.indexOf(path);
    const remaining = existingOpenFiles.filter((candidate) => candidate !== path);
    setOpenFiles(remaining);
    if (path === displayedFile && remaining.length) {
      const next = remaining[Math.min(index, remaining.length - 1)];
      onSelectFile?.(next);
      tabs.current[next]?.focus();
    } else if (!remaining.length) explorerToggle.current?.focus();
    setAnnouncement(`Closed ${path}. The file remains in your project.`);
  }
  function navigateTabs(event, path) {
    const index = existingOpenFiles.indexOf(path);
    let target = -1;
    if (event.key === 'ArrowRight') target = (index + 1) % existingOpenFiles.length;
    if (event.key === 'ArrowLeft') target = (index - 1 + existingOpenFiles.length) % existingOpenFiles.length;
    if (event.key === 'Home') target = 0;
    if (event.key === 'End') target = existingOpenFiles.length - 1;
    if (target >= 0) {
      event.preventDefault();
      openFile(existingOpenFiles[target], true);
    } else if (event.key === 'Delete') {
      event.preventDefault();
      closeTab(path);
    }
  }
  function beginOperation(kind, path = displayedFile) {
    setFormError('');
    setPathInput(kind === 'create' ? parentDirectory(displayedFile) : path);
    setOperation({ kind, path });
  }
  function closeDialog() {
    if (!submitting) setOperation(null);
  }
  async function submitOperation(event) {
    event.preventDefault();
    if (!operation || submitting || disabled) return;
    const nextPath = pathInput.trim();
    if (operation.kind !== 'delete') {
      const error = validatePath(pathInput, paths, operation.kind === 'rename' ? operation.path : undefined);
      if (error) { setFormError(error); pathField.current?.focus(); return; }
    }
    setSubmitting(true);
    setFormError('');
    try {
      let result;
      if (operation.kind === 'create') result = await onCreateFile?.(nextPath);
      else if (operation.kind === 'rename') result = await onRenameFile?.(operation.path, nextPath);
      else result = await onDeleteFile?.(operation.path);
      if (result === false) throw new Error('The project could not apply this change. Please try another file name.');
      if (operation.kind === 'create') {
        openFile(nextPath);
        setAnnouncement(`Created ${nextPath}.`);
      } else if (operation.kind === 'rename') {
        setOpenFiles((previous) => previous.map((path) => path === operation.path ? nextPath : path));
        openFile(nextPath);
        setAnnouncement(`Renamed ${operation.path} to ${nextPath}.`);
      } else {
        const remaining = existingOpenFiles.filter((path) => path !== operation.path);
        setOpenFiles(remaining);
        if (operation.path === displayedFile) {
          const next = remaining[0] || paths.find((path) => path !== operation.path);
          if (next) openFile(next);
        }
        setAnnouncement(`Deleted ${operation.path}.`);
      }
      setOperation(null);
    } catch (error) {
      setFormError(error?.message || 'The project could not apply this change. Try again.');
    } finally {
      setSubmitting(false);
    }
  }
  function renderDirectory(nodes, depth = 0) {
    return <ul className={styles.fileList}>
      {nodes.map((node) => <li key={node.path}>
        {node.folder ? <>
          <button type="button" className={styles.folderButton} style={{ '--file-depth': depth }} aria-label={`Folder ${node.path}`} aria-expanded={Boolean(expanded[node.path])} onClick={() => setExpanded((previous) => ({ ...previous, [node.path]: !previous[node.path] }))} title={node.path}>
            {expanded[node.path] ? <FiChevronDown aria-hidden="true" /> : <FiChevronRight aria-hidden="true" />}<FiFolder aria-hidden="true" /><span>{node.name}</span>
          </button>
          {expanded[node.path] && renderDirectory(node.children, depth + 1)}
        </> : <button type="button" className={`${styles.fileButton} ${node.path === displayedFile ? styles.selectedFile : ''}`} style={{ '--file-depth': depth }} aria-label={`Open ${node.path}`} aria-current={node.path === displayedFile ? 'true' : undefined} onClick={() => openFile(node.path)} title={node.path}>
          <span className={styles.treeIndent} aria-hidden="true" /><FileIcon path={node.path} /><span>{node.name}</span>{node.path === entryPath && <span className={styles.entryDot} aria-hidden="true" />}
        </button>}
      </li>)}
    </ul>;
  }

  return <div ref={workspace} className={`${styles.workspace} ${compact ? styles.compact : ''}`}>
    <div className={styles.workspaceBar}>
      <button ref={explorerToggle} type="button" className={`${styles.filesToggle} ${showExplorer ? styles.pressed : ''}`} aria-label={showExplorer ? 'Hide files' : 'Show files'} aria-expanded={showExplorer} aria-controls={`${dialogId}-explorer`} onClick={() => setExplorerOpen(!showExplorer)} title={showExplorer ? 'Hide file explorer' : 'Show file explorer'}><FiSidebar aria-hidden="true" /><span>Files</span>{paths.length > 1 && <span className={styles.fileCount} aria-hidden="true">{paths.length}</span>}</button>
      <button type="button" className={styles.newFileButton} disabled={disabled || !onCreateFile} onClick={() => beginOperation('create')} title="Create a file"><FiFilePlus aria-hidden="true" /><span>New file</span></button>
    </div>
    <div className={styles.body}>
      {compact && showExplorer && <button type="button" className={styles.explorerScrim} aria-label="Close file explorer" onClick={() => { setMobileExplorerOpen(false); explorerToggle.current?.focus(); }} />}
      <aside id={`${dialogId}-explorer`} className={styles.explorer} aria-label="Project file explorer" hidden={!showExplorer} onKeyDown={(event) => { if (event.key === 'Escape' && compact) { event.preventDefault(); setMobileExplorerOpen(false); explorerToggle.current?.focus(); } }}>
        <div className={styles.explorerHeading}><FiFolder aria-hidden="true" /><span>workspace</span><button type="button" className={styles.iconButton} aria-label="Collapse all folders" title="Collapse all folders" onClick={() => setExpanded({})}><FiFolderMinus aria-hidden="true" /></button></div>
        <div className={styles.directoryScroll}>{paths.length ? renderDirectory(tree) : <p className={styles.noFiles}>Your project has no files yet.</p>}</div>
      </aside>
      <div className={styles.editorColumn}>
        {existingOpenFiles.length ? <>
          {showTabs && <div className={styles.tabs} role="tablist" aria-label="Open project files">
            {existingOpenFiles.map((path) => <button key={path} ref={(element) => { if (element) tabs.current[path] = element; else delete tabs.current[path]; }} id={tabId(path)} type="button" role="tab" aria-controls={panelId(path)} aria-selected={path === displayedFile} tabIndex={path === displayedFile ? 0 : -1} className={`${styles.tabButton} ${path === displayedFile ? styles.activeTab : ''}`} onClick={() => openFile(path)} onKeyDown={(event) => navigateTabs(event, path)} title={path}>
              <FileIcon path={path} /><span>{baseName(path)}</span>
            </button>)}
          </div>}
          <div className={styles.fileToolbar}>
            <div className={styles.breadcrumb} aria-label={`Current file: ${displayedFile}`} title={displayedFile}>
              {displayedFile.split('/').map((part, index) => <span key={`${index}-${part}`}>{index > 0 && <FiChevronRight aria-hidden="true" />}<span>{part}</span></span>)}
            </div>
            <span className={styles.language}>{sourceLabel(displayedFile)}</span>
            {displayedFile === entryPath && <span className={styles.entryBadge} title="Build entry file">entry</span>}
            <button type="button" className={styles.iconButton} aria-label={`Rename ${displayedFile}`} title="Rename or move this file" disabled={disabled || !onRenameFile} onClick={() => beginOperation('rename')}><FiEdit2 aria-hidden="true" /></button>
            <button type="button" className={styles.iconButton} aria-label={`Delete ${displayedFile}`} title="Delete this file" disabled={disabled || !onDeleteFile} onClick={() => beginOperation('delete')}><FiTrash2 aria-hidden="true" /></button>
            {showTabs && <button type="button" className={styles.iconButton} aria-label={`Close tab ${displayedFile}`} title="Close this tab (file stays in project)" onClick={() => closeTab(displayedFile)}><FiX aria-hidden="true" /></button>}
          </div>
          <div className={styles.editors}>
            {existingOpenFiles.map((path) => <div key={path} id={panelId(path)} className={styles.editorPanel} role={showTabs ? 'tabpanel' : 'region'} aria-labelledby={showTabs ? tabId(path) : undefined} aria-label={showTabs ? undefined : `File editor: ${path}`} hidden={path !== displayedFile}>
              <CodeEditor id={editorId(path)} label={`Source: ${path}`} value={files[path]} onChange={(text) => onEditFile?.(path, text)} language={sourceLanguage(path)} onRun={disabled ? undefined : onRun} startAt={path === entryPath && sourceLanguage(path) === 'asm' ? startAt : undefined} revealLocation={revealLocation?.path === path ? revealLocation : undefined} maxLength={Math.min(262144, Math.max(0, 1048576 - totalSourceLength + files[path].length))} fill />
            </div>)}
          </div>
        </> : <div className={styles.emptyEditor}>
          <FiCode aria-hidden="true" /><h3>{paths.length ? 'Choose a file to edit' : 'Start your project'}</h3><p>{paths.length ? 'Open a file from the explorer, or add a new one.' : 'Create a source file to begin writing your program.'}</p>
          <div>{paths.length > 0 && <button type="button" onClick={() => setExplorerOpen(true)}><FiFolder aria-hidden="true" /> Browse files</button>}<button type="button" disabled={disabled || !onCreateFile} onClick={() => beginOperation('create')}><FiFilePlus aria-hidden="true" /> New file</button></div>
        </div>}
      </div>
    </div>
    <span className={styles.srOnly} role="status" aria-live="polite">{announcement}</span>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${dialogId}-title`} aria-describedby={`${dialogId}-description`} onCancel={(event) => { event.preventDefault(); closeDialog(); }} onClose={() => { if (!submitting) setOperation(null); }}>
      <form onSubmit={submitOperation}>
        <div className={styles.dialogHeading}><h3 id={`${dialogId}-title`}>{operation?.kind === 'delete' ? 'Delete file' : operation?.kind === 'rename' ? 'Rename file' : 'New file'}</h3><button type="button" className={styles.iconButton} aria-label="Close file dialog" disabled={submitting} onClick={closeDialog}><FiX aria-hidden="true" /></button></div>
        {operation?.kind === 'delete' ? <p id={`${dialogId}-description`} className={styles.dialogDescription}>Remove <strong>{operation.path}</strong> and its contents from this project?</p> : <>
          <p id={`${dialogId}-description`} className={styles.dialogDescription}>{operation?.kind === 'rename' ? 'Change the file name or move it into a folder. Update any includes or build references that use its old path.' : 'Use / to create folders, for example src/kernel.c or include/console.h.'}</p>
          <label htmlFor={`${dialogId}-path`}>File path</label>
          <input ref={pathField} id={`${dialogId}-path`} value={pathInput} onChange={(event) => { setPathInput(event.target.value); setFormError(''); }} placeholder="src/kernel.c" autoComplete="off" spellCheck={false} maxLength={180} disabled={submitting} aria-invalid={Boolean(formError)} aria-describedby={formError ? `${dialogId}-error` : `${dialogId}-description`} />
        </>}
        {formError && <p id={`${dialogId}-error`} className={styles.formError} role="alert">{formError}</p>}
        <div className={styles.dialogActions}><button type="button" disabled={submitting} onClick={closeDialog}>Cancel</button><button type="submit" className={operation?.kind === 'delete' ? styles.deleteAction : styles.confirmAction} disabled={submitting || disabled}>{submitting ? 'Saving…' : operation?.kind === 'delete' ? 'Delete file' : operation?.kind === 'rename' ? 'Rename file' : 'Create file'}</button></div>
      </form>
    </dialog>
  </div>;
}
