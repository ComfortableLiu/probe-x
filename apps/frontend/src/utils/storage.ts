export class Localstorage {
  static get<T>(key: string): T | null {
    if (localStorage) {
      return JSON.parse(localStorage.getItem(key) as string);
    }
    return null
  }

  static set<T>(key: string, value: T): void {
    if (localStorage) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }
}

export class SessionStorage {
  static get<T>(key: string): T | null {
    if (sessionStorage) {
      return JSON.parse(sessionStorage.getItem(key) as string);
    }
    return null
  }

  static set<T>(key: string, value: T): void {
    if (sessionStorage) {
      sessionStorage.setItem(key, JSON.stringify(value));
    }
  }
}
