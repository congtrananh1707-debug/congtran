import { create } from 'zustand'

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline'

type SyncStore = {
  status: SyncStatus
  lastSyncAt: number       // epoch ms of last successful load/push
  errorMsg: string
  channelConnected: boolean

  setStatus: (s: SyncStatus) => void
  setLastSyncAt: (t: number) => void
  setError: (msg: string) => void
  setChannelConnected: (v: boolean) => void
  clearError: () => void
}

export const useSyncStore = create<SyncStore>((set) => ({
  status: 'idle',
  lastSyncAt: 0,
  errorMsg: '',
  channelConnected: false,

  setStatus: (status) => set({ status }),
  setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
  setError: (errorMsg) => set({ errorMsg, status: 'error' }),
  setChannelConnected: (channelConnected) => set({ channelConnected }),
  clearError: () => set({ errorMsg: '', status: 'idle' }),
}))
