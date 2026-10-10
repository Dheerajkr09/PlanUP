const { JSDOM } = require('jsdom');
JSDOM.fromFile('popup/popup.html', { runScripts: 'dangerously', resources: 'usable' }).then(dom => {
  dom.window.addEventListener('error', e => console.error('JS Error:', e.error));
  setTimeout(() => {
    const btn = dom.window.document.getElementById('addPlanBtn');
    if(btn) {
      btn.click();
      console.log('Clicked! Check for errors.');
    } else {
      console.log('Btn not found!');
    }
  }, 2000);
}).catch(console.error);
