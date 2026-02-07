import { useState } from 'react';
import { LayoutNode, BoxConfig } from '../types';
import { DotsSixVerticalIcon, TrashIcon } from '@phosphor-icons/react';

// --- Types ---
type DropZone = 'top' | 'bottom' | 'left' | 'right' | 'center' | null;

interface DragState {
    draggedNode: LayoutNode | null;
    targetId: string | null;
    dropZone: DropZone;
    sourceBoxId: string | null;
    widgetIdx: number | null;
    targetWidgetIdx: number | null;
}

// --- Utils ---
const generateId = () => Math.random().toString(36).substring(2, 9);

// Convert flat config to Tree (Migration Helper)
export const migrateToTree = (flatConfig: BoxConfig[]): LayoutNode => {
    if (!flatConfig || flatConfig.length === 0) {
        return {
            id: 'root-default',
            type: 'split',
            direction: 'col',
            children: [
                { id: generateId(), type: 'box', widgets: ['fuelLevel', 'lapsRemaining'], direction: 'row', weight: 1 },
                { id: generateId(), type: 'box', widgets: ['consumption'], direction: 'col', weight: 1 }
            ]
        };
    }

    const children: LayoutNode[] = flatConfig.map((box) => {
        // Create a Box Node for each legacy box configuration
        // Legacy boxes had 'widgets' array and 'flow' (horizontal/vertical)
        return {
            id: box.id || generateId(),
            type: 'box',
            widgets: box.widgets,
            direction: box.flow === 'horizontal' ? 'row' : 'col',
            weight: 1
        };
    }).filter(Boolean) as LayoutNode[];

    if (children.length === 1) return children[0];

    return {
        id: 'root-migrated',
        type: 'split',
        direction: 'col', // Default legacy stack was vertical
        children
    };
};

const calculateDropZone = (e: React.DragEvent, element: HTMLElement): DropZone => {
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const relX = x / rect.width;
    const relY = y / rect.height;

    // 25% edge zones
    if (relY < 0.25) return 'top';
    if (relY > 0.75) return 'bottom';
    if (relX < 0.25) return 'left';
    if (relX > 0.75) return 'right';

    return 'center';
};

// --- Recursive Renderer ---
const getUsedWidgetIds = (node: LayoutNode): string[] => {
    if (!node) return [];
    if (node.type === 'box') return node.widgets || [];
    return node.children?.flatMap(getUsedWidgetIds) || [];
};

const getWidgetLabel = (id: string, availableWidgets: { id: string; label: string }[]) =>
    availableWidgets.find(w => w.id === id)?.label || id;

const RecursiveRenderer = ({
    node,
    onDragStart,
    onDragOver,
    onDrop,
    onRemoveBox,
    onRemoveWidgetFromBox,
    dragState,
    availableWidgets
}: {
    node: LayoutNode;
    onDragStart: (e: React.DragEvent, node: LayoutNode, sourceBoxId?: string, widgetIdx?: number) => void;
    onDragOver: (e: React.DragEvent, node: LayoutNode, widgetIdx?: number, isAfter?: boolean) => void;
    onDrop: (e: React.DragEvent, targetNode: LayoutNode) => void;
    onRemoveBox: (nodeId: string) => void;
    onRemoveWidgetFromBox: (boxId: string, widgetIndex: number) => void;
    dragState: DragState;
    availableWidgets: { id: string; label: string }[];
}) => {
    const isTarget = dragState.targetId === node.id;
    const dropZone = isTarget ? dragState.dropZone : null;

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        // Only clear if we are leaving to something that isn't a child
        const rect = e.currentTarget.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX >= rect.right || e.clientY < rect.top || e.clientY >= rect.bottom) {
            onDragOver(e, { id: '' } as LayoutNode); // Use empty string for ID as a sentinel to clear
        }
    };

    if (!node || !node.type) {
        return (
            <div className="p-2 m-1 bg-red-900/50 border border-red-500 text-red-200 text-xs rounded">
                Invalid Node
            </div>
        );
    }

    if (node.type === 'box') {
        return (
            <div
                className="relative flex-1 min-w-0 min-h-0 bg-slate-800 border border-slate-600 rounded p-1 m-1 transition-all flex flex-col gap-1 hover:border-blue-400 group/box"
                onDragOver={(e) => onDragOver(e, node)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => onDrop(e, node)}
                style={{ flexGrow: node.weight || 1 }}
            >
                <div className="flex justify-between items-center px-1">
                    <div className="w-full flex gap-1 overflow-hidden" draggable onDragStart={(e) => onDragStart(e, node)}>
                        <DotsSixVerticalIcon className="text-slate-600 cursor-grab" />
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Box</span>
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); onRemoveBox(node.id); }}
                        className="text-slate-600 hover:text-red-400 p-0.5 opacity-0 group-hover/box:opacity-100 transition-opacity"
                    >
                        <TrashIcon size={12} />
                    </button>
                </div>

                {/* Content: List of Widgets in Box */}
                <div className={`rounded bg-slate-900/50 p-1 flex-1 flex gap-2 overflow-hidden ${node.direction === 'row' ? 'flex-row' : 'flex-col'}`}>
                    {node.widgets?.map((wId, idx) => {
                        const isTargetWidget = dragState.targetId === node.id && dragState.targetWidgetIdx === idx;
                        const isReordering = dragState.targetId === node.id && dragState.dropZone === 'center';

                        return (
                            <div
                                key={`${node.id}-${idx}`}
                                className="relative flex items-center group/widget-container"
                            >
                                {/* Insertion Ghost Indicator */}
                                {isTargetWidget && isReordering && (
                                    <div className={`absolute ${node.direction === 'row' ? '-left-1 top-0 bottom-0 w-0.5' : '-top-1 left-0 right-0 h-0.5'} bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)] z-20`} />
                                )}

                                <div
                                    draggable
                                    onDragStart={(e) => {
                                        e.stopPropagation();
                                        onDragStart(e, {
                                            id: generateId(),
                                            type: 'box',
                                            widgets: [wId],
                                            direction: 'col',
                                            weight: 1
                                        }, node.id, idx);
                                    }}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const isAfter = node.direction === 'row'
                                            ? (e.clientX - rect.left) > rect.width / 2
                                            : (e.clientY - rect.top) > rect.height / 2;

                                        onDragOver(e, node, idx, isAfter);
                                    }}
                                    className={`bg-slate-700 hover:bg-slate-600 border p-1.5 flex items-center gap-2 justify-between group/widget min-w-0 cursor-grab active:cursor-grabbing transition-all ${isTargetWidget && isReordering
                                            ? 'border-blue-400 scale-[1.02] shadow-lg z-10 bg-slate-600'
                                            : 'border-slate-600'
                                        }`}
                                >
                                    <span className="text-xs text-slate-200 truncate">{getWidgetLabel(wId, availableWidgets)}</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onRemoveWidgetFromBox(node.id, idx); }}
                                        className="text-slate-500 hover:text-red-400 opacity-0 group-hover/widget:opacity-100"
                                    >
                                        <TrashIcon size={10} />
                                    </button>
                                </div>

                                {/* End Indicator if we are dropping after the last widget */}
                                {isTargetWidget && isReordering && idx === node.widgets.length - 1 && dragState.targetWidgetIdx === node.widgets.length && (
                                    <div className={`absolute ${node.direction === 'row' ? '-right-1 top-0 bottom-0 w-0.5' : '-bottom-1 left-0 right-0 h-0.5'} bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)] z-20`} />
                                )}
                            </div>
                        );
                    })}
                    {(!node.widgets || node.widgets.length === 0) && <span className="text-xs text-slate-500 italic p-1">Empty</span>}
                </div>

                {/* Drop Indicators */}
                {dropZone === 'top' && <div className="absolute top-0 left-0 right-0 h-1/4 bg-blue-500/30 border-b-2 border-blue-500 animate-pulse pointer-events-none rounded-t" />}
                {dropZone === 'bottom' && <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-blue-500/30 border-t-2 border-blue-500 animate-pulse pointer-events-none rounded-b" />}
                {dropZone === 'left' && <div className="absolute top-0 left-0 bottom-0 w-1/4 bg-blue-500/30 border-r-2 border-blue-500 animate-pulse pointer-events-none rounded-l" />}
                {dropZone === 'right' && <div className="absolute top-0 right-0 bottom-0 w-1/4 bg-blue-500/30 border-l-2 border-blue-500 animate-pulse pointer-events-none rounded-r" />}
                {dropZone === 'center' && <div className="absolute inset-0 bg-blue-500/20 border-2 border-blue-500 animate-pulse pointer-events-none rounded flex items-center justify-center text-blue-200 font-bold text-xs">ADD TO GROUP</div>}
            </div>
        );
    }

    // Split Node
    return (
        <div
            className={`flex flex-1 min-w-0 min-h-0 p-1 ${node.direction === 'row' ? 'flex-row' : 'flex-col'}`}
            style={{ flexGrow: node.weight || 1 }}
            onDragOver={(e) => onDragOver(e, node)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => onDrop(e, node)}
        >
            {node.children?.map((child) => (
                <RecursiveRenderer
                    key={child.id}
                    node={child}
                    onDragStart={onDragStart}
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                    onRemoveBox={onRemoveBox}
                    onRemoveWidgetFromBox={onRemoveWidgetFromBox}
                    dragState={dragState}
                    availableWidgets={availableWidgets}
                />
            ))}
        </div>
    );
};

// Helper: Tree Updates
const updateTree = (root: LayoutNode | null, draggedNode: LayoutNode, targetNode: LayoutNode, zone: DropZone): LayoutNode | null => {
    if (!root) return draggedNode;

    // Reuse ID if it's already a box in the tree, otherwise it's a new sidebar item
    const boxToInsert = { ...draggedNode, weight: 1 };

    // 1. Remove dragged node ID from tree if it exists
    const removeNodeById = (node: LayoutNode, idToRemove: string): LayoutNode | null => {
        if (node.id === idToRemove) return null;
        if (node.type === 'split') {
            const newChildren = node.children.map(c => removeNodeById(c, idToRemove)).filter(Boolean) as LayoutNode[];
            if (newChildren.length === 0) return null;
            if (newChildren.length === 1) return { ...newChildren[0], weight: node.weight };
            return { ...node, children: newChildren };
        }
        return node;
    };

    const cleanTree = removeNodeById(root, draggedNode.id);

    // 2. Intelligent Insert
    const insertNode = (node: LayoutNode | null): LayoutNode => {
        if (!node) return boxToInsert;

        if (node.type === 'split') {
            // If we are dropping on a split node directly (rare but possible)
            if (node.id === targetNode.id) {
                const direction = (zone === 'top' || zone === 'bottom') ? 'col' : 'row';
                const isAfter = (zone === 'bottom' || zone === 'right');

                if (node.direction === direction) {
                    const children = [...node.children];
                    if (isAfter) children.push(boxToInsert);
                    else children.unshift(boxToInsert);
                    return { ...node, children };
                }
            }

            // Check children for target
            const targetIdx = node.children.findIndex(c => c.id === targetNode.id);
            if (targetIdx !== -1) {
                const direction = (zone === 'top' || zone === 'bottom') ? 'col' : 'row';
                const isAfter = (zone === 'bottom' || zone === 'right');

                // OPTIMIZATION: If we are splitting in the SAME direction as the parent split,
                // just insert into the parent's children instead of nesting!
                if (node.direction === direction) {
                    const newChildren = [...node.children];
                    newChildren.splice(isAfter ? targetIdx + 1 : targetIdx, 0, boxToInsert);
                    return { ...node, children: newChildren };
                }

                // Otherwise, we must split this child into a new sub-split
                const newChildren = [...node.children];
                const childToSplit = node.children[targetIdx];
                const splitNode: LayoutNode = {
                    id: generateId(),
                    type: 'split',
                    direction,
                    children: isAfter ? [childToSplit, boxToInsert] : [boxToInsert, childToSplit],
                    weight: childToSplit.weight || 1
                };
                newChildren[targetIdx] = splitNode;
                return { ...node, children: newChildren };
            }

            return { ...node, children: node.children.map(insertNode) };
        }

        if (node.id === targetNode.id) {
            // This only happens if we drop on a BOX that is currently the ROOT
            const direction = (zone === 'top' || zone === 'bottom') ? 'col' : 'row';
            const isAfter = (zone === 'bottom' || zone === 'right');

            if (zone === 'center' && node.type === 'box') {
                // Merge widgets
                const widgetsToAdd = draggedNode.type === 'box' ? draggedNode.widgets : [];
                const finalWidgets = [...node.widgets];
                widgetsToAdd.forEach(w => { if (!finalWidgets.includes(w)) finalWidgets.push(w); });
                return { ...node, widgets: finalWidgets };
            }

            return {
                id: generateId(),
                type: 'split',
                direction,
                children: isAfter ? [node, boxToInsert] : [boxToInsert, node],
                weight: 1
            };
        }

        return node;
    };

    // 3. Final Polish: Flatten redundant splits
    const flatten = (node: LayoutNode): LayoutNode => {
        if (node.type !== 'split') return node;

        const children = node.children.map(flatten);

        // If a child is a split node with the SAME direction, merge its children into this one
        const mergedChildren: LayoutNode[] = [];
        children.forEach(child => {
            if (child.type === 'split' && child.direction === node.direction) {
                mergedChildren.push(...child.children);
            } else {
                mergedChildren.push(child);
            }
        });

        return { ...node, children: mergedChildren };
    };

    const result = insertNode(cleanTree);
    return result ? flatten(result) : null;
};

export const LayoutVisualizer = ({
    tree,
    onChange,
    availableWidgets
}: {
    tree: LayoutNode;
    onChange: (newTree: LayoutNode) => void;
    availableWidgets: { id: string; label: string }[];
}) => {
    const [dragState, setDragState] = useState<DragState>({
        draggedNode: null,
        targetId: null,
        dropZone: null,
        sourceBoxId: null,
        widgetIdx: null,
        targetWidgetIdx: null,
    });

    const usedWidgetIds = getUsedWidgetIds(tree);
    const unusedWidgets = availableWidgets.filter(w => !usedWidgetIds.includes(w.id));

    const handleDragStart = (e: React.DragEvent, node: LayoutNode, sourceBoxId?: string, widgetIdx?: number) => {
        e.dataTransfer.effectAllowed = 'move';
        setDragState(prev => ({
            ...prev,
            draggedNode: node,
            sourceBoxId: sourceBoxId || null,
            widgetIdx: widgetIdx !== undefined ? widgetIdx : null
        }));
    };

    const handleDragOver = (e: React.DragEvent, node: LayoutNode, widgetIdx?: number, isAfter?: boolean) => {
        e.preventDefault();
        e.stopPropagation();
        if (!node.id) {
            setDragState(prev => ({ ...prev, targetId: null, dropZone: null, targetWidgetIdx: null }));
            return;
        }

        // If we are over a widget, we ONLY want to reorder (center)
        if (widgetIdx !== undefined) {
            setDragState(prev => ({
                ...prev,
                targetId: node.id,
                dropZone: 'center',
                targetWidgetIdx: isAfter ? widgetIdx + 1 : widgetIdx
            }));
            return;
        }

        // Only allow split zones if we are NOT over a widget
        if (!dragState.draggedNode || dragState.draggedNode.id === node.id) return;

        const zone = calculateDropZone(e, e.currentTarget as HTMLElement);
        setDragState(prev => ({
            ...prev,
            targetId: node.id,
            dropZone: zone,
            targetWidgetIdx: null
        }));
    };

    const handleDrop = (e: React.DragEvent, targetNode: LayoutNode) => {
        e.preventDefault();
        e.stopPropagation();
        const { draggedNode, dropZone, sourceBoxId, widgetIdx, targetWidgetIdx } = dragState;

        // Reset early
        setDragState({ draggedNode: null, targetId: null, dropZone: null, sourceBoxId: null, widgetIdx: null, targetWidgetIdx: null });

        if (!draggedNode || !dropZone) return;
        if (draggedNode.id === targetNode.id && sourceBoxId === null) return;

        let currentTree: LayoutNode | null = tree;

        // Special case: Merge widget into box with specific position (either move or new)
        if (dropZone === 'center' && targetNode.type === 'box' && (draggedNode as LayoutNode & { type: 'box' }).widgets?.length === 1) {
            const sourceWidgetId = (draggedNode as LayoutNode & { type: 'box' }).widgets[0];
            const updateTarget = (node: LayoutNode): LayoutNode => {
                if (node.id === targetNode.id && node.type === 'box') {
                    const nextWidgets = [...node.widgets];
                    let adjustedIdx = targetWidgetIdx ?? nextWidgets.length;

                    if (sourceBoxId !== null && sourceBoxId === targetNode.id) {
                        const currentIdx = nextWidgets.indexOf(sourceWidgetId);
                        if (currentIdx !== -1) {
                            nextWidgets.splice(currentIdx, 1);
                            if (adjustedIdx > currentIdx) adjustedIdx--;
                        }
                    }

                    if (!nextWidgets.includes(sourceWidgetId)) {
                        nextWidgets.splice(adjustedIdx, 0, sourceWidgetId);
                    }
                    return { ...node, widgets: nextWidgets };
                }
                if (node.type === 'split') return { ...node, children: node.children.map(updateTarget) };
                return node;
            };

            let workingTree = tree;
            if (sourceBoxId !== null && widgetIdx !== null && sourceBoxId !== targetNode.id) {
                const updateSource = (node: LayoutNode): LayoutNode | null => {
                    if (node.id === sourceBoxId && node.type === 'box') {
                        const nextWidgets = [...node.widgets];
                        nextWidgets.splice(widgetIdx, 1);
                        if (nextWidgets.length === 0) return null;
                        return { ...node, widgets: nextWidgets };
                    }
                    if (node.type === 'split') {
                        const children = node.children.map(updateSource).filter(Boolean) as LayoutNode[];
                        if (children.length === 0) return null;
                        if (children.length === 1) return children[0];
                        return { ...node, children };
                    }
                    return node;
                };
                workingTree = updateSource(tree) || tree;
            }

            onChange(updateTarget(workingTree));
            return;
        }

        // 1. If it's a widget move (not merge already handled), remove it from source
        if (sourceBoxId !== null && widgetIdx !== null) {
            const updateSource = (node: LayoutNode): LayoutNode | null => {
                if (node.id === sourceBoxId && node.type === 'box') {
                    const nextWidgets = [...node.widgets];
                    nextWidgets.splice(widgetIdx, 1);
                    if (nextWidgets.length === 0) return null;
                    return { ...node, widgets: nextWidgets };
                }
                if (node.type === 'split') {
                    const children = node.children.map(updateSource).filter(Boolean) as LayoutNode[];
                    if (children.length === 0) return null;
                    if (children.length === 1) return children[0];
                    return { ...node, children };
                }
                return node;
            };
            currentTree = updateSource(tree);
        }

        // Apply drop logic (Splits)
        const newTree = updateTree(currentTree, draggedNode, targetNode, dropZone);
        if (newTree) onChange(newTree);
    };

    // Actions
    const handleRemoveBox = (boxId: string) => {
        const removeNode = (node: LayoutNode): LayoutNode | null => {
            if (node.id === boxId) return null;
            if (node.type === 'split') {
                const newChildren = node.children.map(removeNode).filter(Boolean) as LayoutNode[];
                if (newChildren.length === 0) return null;
                if (newChildren.length === 1) return newChildren[0];
                return { ...node, children: newChildren };
            }
            return node;
        };
        const newTree = removeNode(tree);
        if (newTree) onChange(newTree);
    };

    const handleRemoveWidgetFromBox = (boxId: string, widgetIndex: number) => {
        const updateBox = (node: LayoutNode): LayoutNode | null => {
            if (node.type === 'box' && node.id === boxId) {
                const newWidgets = [...node.widgets];
                newWidgets.splice(widgetIndex, 1);
                if (newWidgets.length === 0) return null; // Remove Box if empty
                return { ...node, widgets: newWidgets };
            }
            if (node.type === 'split') {
                const newChildren = node.children.map(updateBox).filter(Boolean) as LayoutNode[];
                if (newChildren.length === 0) return null;
                if (newChildren.length === 1) return newChildren[0];
                return { ...node, children: newChildren };
            }
            return node;
        };
        const newTree = updateBox(tree);
        if (newTree) onChange(newTree);
    };

    return (
        <div className="flex gap-4 h-[450px]">
            {/* Visual Editor */}
            <div className="flex-1 bg-slate-900 border border-slate-700 rounded overflow-hidden flex flex-col">
                <div className="flex-1 flex p-2 overflow-hidden relative">
                    <RecursiveRenderer
                        node={tree}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onRemoveBox={handleRemoveBox}
                        onRemoveWidgetFromBox={handleRemoveWidgetFromBox}
                        dragState={dragState}
                        availableWidgets={availableWidgets}
                    />
                </div>
                <div className="p-2 bg-slate-800 text-xs text-slate-400 border-t border-slate-700 flex justify-between items-center">
                    <span>Drag items to split. Drop in CENTER to join group.</span>
                </div>
            </div>

            {/* Sidebar Pool */}
            <div
                className={`w-48 bg-slate-800 border box-border rounded p-3 flex flex-col gap-3 overflow-y-auto transition-colors ${dragState.draggedNode ? 'border-red-500/50 bg-red-900/20' : 'border-slate-700'
                    }`}
                onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                    e.preventDefault();
                    // 1. Dragging a specific widget from a box
                    if (dragState.sourceBoxId !== null && dragState.widgetIdx !== null) {
                        handleRemoveWidgetFromBox(dragState.sourceBoxId, dragState.widgetIdx);
                    }
                    // 2. Dragging an entire box from the layout (sourceBoxId is null for box drags)
                    // We check if it is in the tree by trying to remove it
                    else if (dragState.draggedNode && dragState.draggedNode.id && dragState.sourceBoxId === null) {
                        // Only remove if it's not a temporary new node from the sidebar itself
                        // Sidebar drags create new IDs, so removing them won't affect the tree, which is fine.
                        // But we want to ensure we don't error out.
                        handleRemoveBox(dragState.draggedNode.id);
                    }

                    // Reset drag state
                    setDragState({ draggedNode: null, targetId: null, dropZone: null, sourceBoxId: null, widgetIdx: null, targetWidgetIdx: null });
                }}
            >
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-slate-300">Available Widgets</h4>
                    {dragState.draggedNode && <TrashIcon className="text-red-400 animate-pulse" weight="fill" />}
                </div>
                <div className="flex flex-col gap-2">
                    {unusedWidgets.map(widget => (
                        <div
                            key={widget.id}
                            draggable
                            onDragStart={(e) => {
                                handleDragStart(e, {
                                    id: generateId(),
                                    type: 'box',
                                    widgets: [widget.id],
                                    direction: 'col',
                                    weight: 1
                                });
                            }}
                            className="bg-slate-700 hover:bg-slate-600 border border-slate-600 p-2 rounded text-xs text-slate-200 cursor-grab active:cursor-grabbing flex items-center gap-2"
                        >
                            <DotsSixVerticalIcon className="text-slate-400" />
                            {widget.label}
                        </div>
                    ))}
                    {unusedWidgets.length === 0 && <span className="text-xs text-slate-500 italic">All widgets used</span>}
                </div>

                {dragState.draggedNode && (
                    <div className="mt-auto p-4 border-2 border-dashed border-red-500/30 rounded-lg flex flex-col items-center justify-center text-red-300 gap-2 bg-slate-900/50">
                        <TrashIcon size={24} />
                        <span className="text-xs font-medium">Drop to Remove</span>
                    </div>
                )}
            </div>
        </div>
    );
};
