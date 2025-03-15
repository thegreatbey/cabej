// This script runs before any module loading
window.global = window;
window.process = { env: {} };
window.Buffer = { isBuffer: function() { return false; }, from: function() { return {}; } }; 