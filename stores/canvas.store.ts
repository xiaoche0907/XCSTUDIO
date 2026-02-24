import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { CanvasElement, Marker } from '../types';

interface CanvasState {
  // 视图状态
  zoom: number;
  pan: { x: number; y: number };
  
  // 元素状态
  elements: CanvasElement[];
  selectedElementId: string | null;
  editingTextId: string | null;
  
  // 标记系统
  markers: Marker[];
  
  // 历史记录
  history: Array<{ elements: CanvasElement[]; markers: Marker[] }>;
  historyStep: number;
  
  // 操作状态
  isDraggingElement: boolean;
  isPanning: boolean;
  isResizing: boolean;
  resizeHandle: string | null;
  
  // Actions
  actions: {
    // 视图操作
    setZoom: (zoom: number) => void;
    setPan: (pan: { x: number; y: number }) => void;
    
    // 元素操作
    addElement: (element: CanvasElement) => void;
    updateElement: (id: string, updates: Partial<CanvasElement>) => void;
    deleteElement: (id: string) => void;
    setElements: (elements: CanvasElement[]) => void;
    
    // 选择操作
    setSelectedElementId: (id: string | null) => void;
    setEditingTextId: (id: string | null) => void;
    
    // 标记操作
    addMarker: (marker: Marker) => void;
    removeMarker: (id: number) => void;
    setMarkers: (markers: Marker[]) => void;
    
    // 历史操作
    saveToHistory: () => void;
    undo: () => void;
    redo: () => void;
    
    // 编组操作
    groupElements: (ids: string[]) => string;
    mergeElements: (ids: string[]) => string;
    ungroupElement: (groupId: string) => void;

    // 拖拽和缩放状态
    setIsDragging: (isDragging: boolean) => void;
    setIsPanning: (isPanning: boolean) => void;
    setIsResizing: (isResizing: boolean, handle?: string | null) => void;

    // 批量重置
    reset: () => void;
  };
}

const initialState = {
  zoom: 50,
  pan: { x: 0, y: 0 },
  elements: [],
  selectedElementId: null,
  editingTextId: null,
  markers: [],
  history: [{ elements: [], markers: [] }],
  historyStep: 0,
  isDraggingElement: false,
  isPanning: false,
  isResizing: false,
  resizeHandle: null,
};

export const useCanvasStore = create<CanvasState>()(
  immer((set, get) => ({
    ...initialState,
    
    actions: {
      setZoom: (zoom) => set({ zoom: Math.max(10, Math.min(500, zoom)) }),
      
      setPan: (pan) => set({ pan }),
      
      addElement: (element) => set((state) => {
        state.elements.push(element);
      }),
      
      updateElement: (id, updates) => set((state) => {
        const index = state.elements.findIndex(el => el.id === id);
        if (index !== -1) {
          state.elements[index] = { ...state.elements[index], ...updates };
        }
      }),
      
      deleteElement: (id) => set((state) => {
        const el = state.elements.find(e => e.id === id);
        if (el?.type === 'group' && el.children) {
          // Deleting a group: clear groupId on all children
          for (const childId of el.children) {
            const child = state.elements.find(c => c.id === childId);
            if (child) child.groupId = undefined;
          }
        } else if (el?.groupId) {
          // Deleting a child: remove from parent group's children
          const parent = state.elements.find(e => e.id === el.groupId);
          if (parent?.children) {
            parent.children = parent.children.filter(cid => cid !== id);
            if (parent.children.length === 0) {
              state.elements = state.elements.filter(e => e.id !== parent.id);
            }
          }
        }
        state.elements = state.elements.filter(e => e.id !== id);
        state.markers = state.markers.filter(m => m.elementId !== id);
        if (state.selectedElementId === id) {
          state.selectedElementId = null;
        }
      }),
      
      setElements: (elements) => set({ elements }),
      
      setSelectedElementId: (id) => set({ selectedElementId: id }),
      
      setEditingTextId: (id) => set({ editingTextId: id }),
      
      addMarker: (marker) => set((state) => {
        state.markers.push(marker);
      }),
      
      removeMarker: (id) => set((state) => {
        state.markers = state.markers
          .filter(m => m.id !== id)
          .map((m, i) => ({ ...m, id: i + 1 }));
      }),
      
      setMarkers: (markers) => set({ markers }),
      
      saveToHistory: () => set((state) => {
        const newHistory = state.history.slice(0, state.historyStep + 1);
        newHistory.push({ 
          elements: JSON.parse(JSON.stringify(state.elements)),
          markers: JSON.parse(JSON.stringify(state.markers))
        });
        state.history = newHistory;
        state.historyStep = newHistory.length - 1;
      }),
      
      undo: () => set((state) => {
        if (state.historyStep > 0) {
          const prevStep = state.historyStep - 1;
          state.historyStep = prevStep;
          state.elements = state.history[prevStep].elements;
          state.markers = state.history[prevStep].markers;
        }
      }),
      
      redo: () => set((state) => {
        if (state.historyStep < state.history.length - 1) {
          const nextStep = state.historyStep + 1;
          state.historyStep = nextStep;
          state.elements = state.history[nextStep].elements;
          state.markers = state.history[nextStep].markers;
        }
      }),
      
      groupElements: (ids) => {
        let newGroupId = '';
        set((state) => {
          const targets = state.elements.filter(el => ids.includes(el.id));
          if (targets.length < 2) return;
          const minX = Math.min(...targets.map(el => el.x));
          const minY = Math.min(...targets.map(el => el.y));
          const maxX = Math.max(...targets.map(el => el.x + el.width));
          const maxY = Math.max(...targets.map(el => el.y + el.height));
          const maxZ = Math.max(...targets.map(el => el.zIndex));
          newGroupId = `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const originalChildData: Record<string, { x: number; y: number; width: number; height: number; zIndex: number }> = {};
          for (const t of targets) {
            originalChildData[t.id] = { x: t.x, y: t.y, width: t.width, height: t.height, zIndex: t.zIndex };
            const el = state.elements.find(e => e.id === t.id);
            if (el) el.groupId = newGroupId;
          }
          state.elements.push({
            id: newGroupId,
            type: 'group',
            x: minX, y: minY,
            width: maxX - minX, height: maxY - minY,
            zIndex: maxZ + 1,
            children: ids,
            isCollapsed: false,
            originalChildData,
          });
        });
        return newGroupId;
      },

      mergeElements: (ids) => {
        let newGroupId = '';
        set((state) => {
          const targets = state.elements.filter(el => ids.includes(el.id));
          if (targets.length < 2) return;
          const minX = Math.min(...targets.map(el => el.x));
          const minY = Math.min(...targets.map(el => el.y));
          const maxX = Math.max(...targets.map(el => el.x + el.width));
          const maxY = Math.max(...targets.map(el => el.y + el.height));
          const maxZ = Math.max(...targets.map(el => el.zIndex));
          newGroupId = `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const originalChildData: Record<string, { x: number; y: number; width: number; height: number; zIndex: number }> = {};
          for (const t of targets) {
            originalChildData[t.id] = { x: t.x, y: t.y, width: t.width, height: t.height, zIndex: t.zIndex };
            const el = state.elements.find(e => e.id === t.id);
            if (el) el.groupId = newGroupId;
          }
          state.elements.push({
            id: newGroupId,
            type: 'group',
            x: minX, y: minY,
            width: maxX - minX, height: maxY - minY,
            zIndex: maxZ + 1,
            children: ids,
            isCollapsed: true,
            originalChildData,
          });
        });
        return newGroupId;
      },

      ungroupElement: (groupId) => set((state) => {
        const group = state.elements.find(el => el.id === groupId);
        if (!group || group.type !== 'group') return;
        const childIds = group.children || [];
        const originalData = group.originalChildData || {};
        for (const childId of childIds) {
          const child = state.elements.find(el => el.id === childId);
          if (child) {
            child.groupId = undefined;
            const orig = originalData[childId];
            if (orig) {
              child.x = orig.x;
              child.y = orig.y;
              child.width = orig.width;
              child.height = orig.height;
              child.zIndex = orig.zIndex;
            }
          }
        }
        state.elements = state.elements.filter(el => el.id !== groupId);
        if (state.selectedElementId === groupId) {
          state.selectedElementId = null;
        }
      }),

      setIsDragging: (isDragging) => set({ isDraggingElement: isDragging }),
      
      setIsPanning: (isPanning) => set({ isPanning }),
      
      setIsResizing: (isResizing, handle = null) => set({ 
        isResizing, 
        resizeHandle: handle 
      }),
      
      reset: () => set(initialState),
    }
  }))
);
