export {}

declare global {
  interface Window {
    bladevaultDesktop?: {
      selectDirectory: () => Promise<string | null>
    }
  }
}
