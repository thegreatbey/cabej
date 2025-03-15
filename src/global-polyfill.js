// Polyfills for Node.js globals in browser environment
if (typeof window !== 'undefined') {
  // global is used by many Node.js modules
  window.global = window;
  
  // Some modules expect a process.env object
  window.process = window.process || { env: {} };
  
  // Buffer is used by many Node.js modules
  window.Buffer = window.Buffer || { 
    isBuffer: () => false,
    from: () => ({})
  };
  
  // setImmediate is used by some Node.js modules
  window.setImmediate = window.setImmediate || ((fn, ...args) => setTimeout(fn, 0, ...args));
  
  // Other potential Node.js globals
  window.clearImmediate = window.clearImmediate || window.clearTimeout;
  
  // Console compatibility
  window.global.console = window.console;
}

export {}; // This makes TypeScript treat this as a module 