/* Template preview runtime guards (docs-local)
 * Prevent full framework defaults from leaking into shared docs preferences.
 */
(function () {
  'use strict';

  function disableGlobalPreferenceWriters() {
    if (!window.Vanduo || !window.Vanduo.components) {
      return;
    }

    delete window.Vanduo.components.themeCustomizer;
    delete window.Vanduo.components.fontSwitcher;
  }

  disableGlobalPreferenceWriters();
})();
