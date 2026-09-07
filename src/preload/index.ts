import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'

const api = {
  getData: () => ipcRenderer.invoke('data:get'),

  createEvent: (e: unknown) => ipcRenderer.invoke('event:create', e),
  updateEvent: (e: unknown) => ipcRenderer.invoke('event:update', e),
  deleteEvent: (id: string) => ipcRenderer.invoke('event:delete', id),

  createTodo: (t: unknown) => ipcRenderer.invoke('todo:create', t),
  updateTodo: (t: unknown) => ipcRenderer.invoke('todo:update', t),
  deleteTodo: (id: string) => ipcRenderer.invoke('todo:delete', id),

  setWorkHours: (date: string, hours: unknown) =>
    ipcRenderer.invoke('workhours:set', date, hours),

  createNote: (text: string) => ipcRenderer.invoke('note:create', text),
  updateNote: (id: string, text: string) => ipcRenderer.invoke('note:update', id, text),
  recolorNote: (id: string, color: string) => ipcRenderer.invoke('note:recolor', id, color),
  deleteNote: (id: string) => ipcRenderer.invoke('note:delete', id),
  setNotesWindow: (open: boolean, panelWidth?: number) =>
    ipcRenderer.invoke('window:notes', open, panelWidth),

  updateSettings: (s: unknown) => ipcRenderer.invoke('settings:update', s),
  hideWindow: () => ipcRenderer.invoke('window:hide'),

  onDataChanged: (cb: (data: unknown) => void) => {
    const handler = (_e: IpcRendererEvent, data: unknown): void => cb(data)
    ipcRenderer.on('data:changed', handler)
    return () => ipcRenderer.off('data:changed', handler)
  },
  onBackdropChanged: (cb: (v: 'light' | 'dark') => void) => {
    const handler = (_e: IpcRendererEvent, v: 'light' | 'dark'): void => cb(v)
    ipcRenderer.on('backdrop:changed', handler)
    return () => ipcRenderer.off('backdrop:changed', handler)
  },
  onOpenSettings: (cb: () => void) => {
    const handler = (): void => cb()
    ipcRenderer.on('ui:open-settings', handler)
    return () => ipcRenderer.off('ui:open-settings', handler)
  }
}

contextBridge.exposeInMainWorld('widget', api)

export type WidgetApi = typeof api
