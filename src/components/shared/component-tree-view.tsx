import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Component,
  FileCode2,
  FileJson,
  FolderTree,
  Layers,
  Palette,
} from 'lucide-react';
import {
  buildComponentTree,
  type ComponentTreeNode,
} from '../../features/projects/project-inspector';
import type { ProjectFile } from '../../features/projects/types';
import { cn } from '../../lib/utils';

export interface ComponentTreeViewProps {
  files: ProjectFile[];
  selectedFilePath: string;
  onSelectFile: (filePath: string) => void;
  className?: string;
}

interface TreeRowProps {
  node: ComponentTreeNode;
  depth: number;
  selectedFilePath: string;
  expandedIds: Set<string>;
  onToggleExpand: (nodeId: string) => void;
  onSelectFile: (filePath: string) => void;
}

function renderNodeIcon(node: ComponentTreeNode, isSelected: boolean) {
  if (node.kind === 'entry') {
    return (
      <Layers
        className={cn('h-3.5 w-3.5 shrink-0', isSelected ? 'text-emerald-400' : 'text-emerald-500')}
        strokeWidth={1.6}
      />
    );
  }
  if (node.kind === 'local-component') {
    return (
      <Component
        className={cn('h-3.5 w-3.5 shrink-0', isSelected ? 'text-emerald-400' : 'text-zinc-500')}
        strokeWidth={1.5}
      />
    );
  }
  if (node.kind === 'config') {
    return (
      <FileJson
        className={cn('h-3.5 w-3.5 shrink-0', isSelected ? 'text-emerald-400' : 'text-zinc-400')}
        strokeWidth={1.5}
      />
    );
  }
  if (node.kind === 'style') {
    return (
      <Palette
        className={cn('h-3.5 w-3.5 shrink-0', isSelected ? 'text-emerald-400' : 'text-zinc-400')}
        strokeWidth={1.5}
      />
    );
  }
  return (
    <FileCode2
      className={cn('h-3.5 w-3.5 shrink-0', isSelected ? 'text-emerald-400' : 'text-zinc-400')}
      strokeWidth={1.5}
    />
  );
}

function TreeRow({
  node,
  depth,
  selectedFilePath,
  expandedIds,
  onToggleExpand,
  onSelectFile,
}: TreeRowProps) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedFilePath === node.filePath && node.kind !== 'local-component';

  return (
    <li
      role="treeitem"
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={isSelected}
      className="select-none"
    >
      <div
        className={cn(
          'flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs transition-colors',
          isSelected
            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
            : 'border border-transparent text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100'
        )}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-label={isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" strokeWidth={1.75} />
            ) : (
              <ChevronRight className="h-3 w-3" strokeWidth={1.75} />
            )}
          </button>
        ) : (
          <span aria-hidden="true" className="inline-block h-5 w-4 shrink-0" />
        )}

        <button
          type="button"
          onClick={() => onSelectFile(node.filePath)}
          title={`${node.name} (${node.filePath})`}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          {renderNodeIcon(node, isSelected)}
          <span className="truncate font-mono text-[11px] font-medium">
            {node.kind === 'config' || node.kind === 'style' ? node.name : `<${node.name} />`}
          </span>

          {node.kind === 'entry' ? (
            <span className="ml-auto shrink-0 rounded bg-emerald-500/15 px-1 py-0.5 font-mono text-[9px] uppercase tracking-wider text-emerald-400">
              root
            </span>
          ) : node.kind === 'local-component' ? (
            <span className="ml-auto shrink-0 font-mono text-[9px] text-zinc-500">local</span>
          ) : node.hooks.length > 0 ? (
            <span className="ml-auto shrink-0 font-mono text-[9px] text-zinc-500">
              {node.hooks.length}h
            </span>
          ) : null}
        </button>
      </div>

      {hasChildren && isExpanded ? (
        <ul role="group" className="mt-0.5 space-y-0.5">
          {node.children.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedFilePath={selectedFilePath}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onSelectFile={onSelectFile}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function ComponentTreeView({
  files,
  selectedFilePath,
  onSelectFile,
  className,
}: ComponentTreeViewProps) {
  const tree = useMemo(() => buildComponentTree(files), [files]);

  const defaultExpanded = useMemo(() => {
    const ids = new Set<string>();
    const collect = (nodes: ComponentTreeNode[]) => {
      for (const n of nodes) {
        if (n.children.length > 0) {
          ids.add(n.id);
          collect(n.children);
        }
      }
    };
    collect(tree.rootNodes);
    return ids;
  }, [tree]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(defaultExpanded);

  useEffect(() => {
    setExpandedIds((prev) => {
      const merged = new Set(prev);
      for (const id of defaultExpanded) merged.add(id);
      return merged;
    });
  }, [defaultExpanded]);

  const toggleExpand = (nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  if (files.length === 0) {
    return (
      <div className={cn('p-4 text-center text-xs text-zinc-500', className)}>
        No React components in workspace yet.
      </div>
    );
  }

  return (
    <div
      data-testid="component-tree-view"
      className={cn('flex flex-col bg-zinc-950 text-zinc-200', className)}
    >
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          <FolderTree className="h-3.5 w-3.5 text-emerald-400" strokeWidth={1.5} />
          <span>Component Tree</span>
        </div>
        <span className="font-mono text-[10px] text-zinc-500 tabular-nums">
          {tree.totalComponents} nodes
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {tree.rootNodes.length > 0 ? (
          <ul role="tree" aria-label="React component hierarchy" className="space-y-0.5">
            {tree.rootNodes.map((node) => (
              <TreeRow
                key={node.id}
                node={node}
                depth={0}
                selectedFilePath={selectedFilePath}
                expandedIds={expandedIds}
                onToggleExpand={toggleExpand}
                onSelectFile={onSelectFile}
              />
            ))}
          </ul>
        ) : null}

        {tree.supportFiles.length > 0 ? (
          <div>
            <div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Config &amp; Assets
            </div>
            <ul role="list" className="space-y-0.5">
              {tree.supportFiles.map((fileNode) => {
                const isSelected = selectedFilePath === fileNode.filePath;
                return (
                  <li key={fileNode.id}>
                    <button
                      type="button"
                      onClick={() => onSelectFile(fileNode.filePath)}
                      className={cn(
                        'flex w-full items-center gap-1.5 rounded-lg border px-2 py-1 text-left font-mono text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                        isSelected
                          ? 'border-emerald-500/30 bg-emerald-950/60 text-emerald-300'
                          : 'border-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                      )}
                    >
                      {renderNodeIcon(fileNode, isSelected)}
                      <span className="truncate">{fileNode.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
