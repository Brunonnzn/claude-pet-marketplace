export type Tick = number

declare module 'claude-code' {
  interface PluginState {
    'claude-pet': { frame: Tick; word: Tick; isHidden: boolean }
  }
}
