// Node-only SSR tests do not render fonts/styles. Next's real build still
// processes these imports; this hook prevents Node parsing CSS as JavaScript.
require.extensions['.css'] = function (module) { module.exports = {}; };
