(function(){
  const THEME_KEY = 'feesight.ui.theme';
  const VIEW_KEY = 'feesight.ui.view';
  const THEMES = new Set(['default','dark']);
  const VIEWS = new Set(['current','command','story','simulator']);

  function pickTheme(raw){ return THEMES.has(raw) ? raw : 'default'; }
  function pickView(raw){ return VIEWS.has(raw) ? raw : 'current'; }

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

  function init(){
    applyTheme(localStorage.getItem(THEME_KEY) || document.body.dataset.theme || 'default');
    applyView(localStorage.getItem(VIEW_KEY) || document.body.dataset.view || 'current');
  }

  window.FeesightUIState = { init, applyTheme, applyView };
})();
