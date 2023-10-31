export var styling = (function () {
  var documentStyle = getComputedStyle(document.documentElement);
  return {
    padding: parseFloat(documentStyle.getPropertyValue('--gallery-padding')),
    borderWidth: parseFloat(documentStyle.getPropertyValue('--gallery-image-border-width')),
  };
})();

export function showApp() {
  document.querySelector('#app').classList.remove('blurred');
}

export function showAppImmediately() {
  var appElement: HTMLElement = document.querySelector('#app');
  var mainElement: HTMLElement = appElement.querySelector('#main');
  mainElement.style.transition = 'filter 0s';
  appElement.classList.remove('blurred');
}

// make sure the gallery looks the same on every screen,
// otherwise the individual photos would be much smaller
// on 1440p or 4K monitors.
export function normalizedWidthPixels(pixels: number) {
  var baselineWidth = 1920
  if (window.screen.width > window.screen.height) {
    return pixels * window.screen.width / baselineWidth
  }
  return pixels;
}
