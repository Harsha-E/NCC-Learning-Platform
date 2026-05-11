export default class AbstractView {
  constructor(params = {}) {
    this.params = params;
  }

  async getHtml() {
    throw new Error('getHtml() must be implemented by subclass');
  }

  async mount() {
    return null;
  }

  async destroy() {
    return null;
  }
}
