(function(){
  const THEME_KEY = 'feesight.ui.theme';
  const VIEW_KEY = 'feesight.ui.view';
  const DISPLAY_MODE_KEY = 'feesight.ui.displayMode';
  const THEMES = new Set(['default','dark']);
  const VIEWS = new Set(['current','command','story','simulator']);
  const DISPLAY_MODES = new Set(['table','cards','bars']);

  function pickTheme(raw){ return THEMES.has(raw) ? raw : 'default'; }
  function pickView(raw){ return VIEWS.has(raw) ? raw : 'current'; }
  function pickDisplayMode(raw){ return DISPLAY_MODES.has(raw) ? raw : 'table'; }

  function applyTheme(theme){
    const value = pickTheme(theme);
    localStorage.setItem(THEME_KEY, value);
    const sel = document.getElementById('themeSelect');
    if(sel && sel.value !== value) sel.value = value;
    return value;
  }

  function applyView(view){
    const value = pickView(view);
    localStorage.setItem(VIEW_KEY, value);
    const sel = document.getElementById('viewSelect');
    if(sel && sel.value !== value) sel.value = value;
    return value;
  }

  function applyDisplayMode(mode){
    const value = pickDisplayMode(mode);
    localStorage.setItem(DISPLAY_MODE_KEY, value);
    const sel = document.getElementById('displayModeSelect');
    if(sel && sel.value !== value) sel.value = value;
    return value;
  }

  function init(){
    applyTheme(localStorage.getItem(THEME_KEY) || document.body.dataset.theme || 'default');
    applyView(localStorage.getItem(VIEW_KEY) || document.body.dataset.view || 'current');
    applyDisplayMode(localStorage.getItem(DISPLAY_MODE_KEY) || document.body.dataset.displayMode || 'table');
  }

  window.FeesightUIState = { init, applyTheme, applyView, applyDisplayMode };
})();
