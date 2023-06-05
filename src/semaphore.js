export class Semaphore {
  constructor(count) {
    this.count = count; // The initial count of the semaphore
    this.tasks = []; // An array to store pending tasks
  }

  signal() {
    // This method is called to signal that a resource is available.
    // It checks if there are pending tasks and if the count is greater than zero.
    // If so, it decreases the count, removes the first task from the array,
    // and executes the task asynchronously.
    if (this.tasks.length > 0 && this.count > 0) {
      this.count--;
      let task = this.tasks.shift();
      task();
    }
  }

  async wait() {
    // This method is called to wait for a resource.
    // If the count is greater than zero, it decreases the count and resolves immediately.
    // Otherwise, it returns a promise that will be resolved when a resource becomes available.
    if (this.count > 0) {
      this.count--;
      return Promise.resolve();
    } else {
      return new Promise((resolve) => this.tasks.push(resolve));
    }
  }

  availableSlots() {
    // This method will return the number of available slots.
    return this.count;
  }
}
