class Store {

  constructor() {
    this._state = {
      user: null,
      profile: null,
      theme: 'light'
    };
    this._subscribers = new Map();
  }

  reset() {
    this._state = {
      user: null,
      profile: null,
      theme: 'light'
    };
    // Notify all subscribers that the state is cleared
    this._subscribers.forEach((callbacks, path) => {
      const newValue = this._resolvePath(path);
      callbacks.forEach(callback => callback(newValue));
    });
  }

  _resolvePath(path) {
    return path.split('.').reduce((current, key) => {
      if (current && Object.prototype.hasOwnProperty.call(current, key)) {
        return current[key];
      }
      return undefined;
    }, this._state);
  }

  subscribe(path, callback) {
    if (!this._subscribers.has(path)) {
      this._subscribers.set(path, new Set());
    }
    this._subscribers.get(path).add(callback);

    return () => {
      const subscriptions = this._subscribers.get(path);
      if (subscriptions) {
        subscriptions.delete(callback);
      }
    };
  }

  set(path, value) {
    const segments = path.split('.');
    let target = this._state;

    for (let i = 0; i < segments.length - 1; i += 1) {
      const key = segments[i];
      if (!Object.prototype.hasOwnProperty.call(target, key) || typeof target[key] !== 'object' || target[key] === null) {
        target[key] = {};
      }
      target = target[key];
    }

    target[segments[segments.length - 1]] = value;

    const subscribers = this._subscribers.get(path);
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback(value);
        } catch (error) {
          console.error('[Store] Subscriber error:', error);
        }
      });
    }
  }

  get(path) {
    return this._resolvePath(path);
  }
}

const store = new Store();
export default store;
