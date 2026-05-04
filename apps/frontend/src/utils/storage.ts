export class Localstorage {
  static get<T>(key: string): T | null {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(key)
        if (raw === null) return null
        return JSON.parse(raw) as T
      }
    } catch {
      // localStorage 不可用或数据损坏
    }
    return null
  }

  static set<T>(key: string, value: T): void {
    if (!value) return
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(value))
      }
    } catch {
      // localStorage 不可用（如隐私模式、存储满）
    }
  }

  static remove(key: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key)
      }
    } catch {
      // ignore
    }
  }
}

export class SessionStorage {
  static get<T>(key: string): T | null {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const raw = sessionStorage.getItem(key)
        if (raw === null) return null
        return JSON.parse(raw) as T
      }
    } catch {
      // sessionStorage 不可用或数据损坏
    }
    return null
  }

  static set<T>(key: string, value: T): void {
    if (!value) return
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(key, JSON.stringify(value))
      }
    } catch {
      // sessionStorage 不可用
    }
  }

  static remove(key: string): void {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(key)
      }
    } catch {
      // ignore
    }
  }
}
