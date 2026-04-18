'use strict';

(async () => {
  // Pre-fill from saved config
  const settings = await window.nexusIT.getSettings();
  if (settings.serverUrl)   document.getElementById('server-url').value   = settings.serverUrl;
  if (settings.agentSecret) document.getElementById('agent-secret').value = settings.agentSecret;

  // Also handle push-style population (in case window loaded before IPC reply)
  window.nexusIT.onSettings(d => {
    if (d.serverUrl)   document.getElementById('server-url').value   = d.serverUrl;
    if (d.agentSecret) document.getElementById('agent-secret').value = d.agentSecret;
  });

  const errEl   = document.getElementById('error-msg');
  const saveBtn = document.getElementById('btn-save');

  saveBtn.addEventListener('click', async () => {
    const serverUrl   = document.getElementById('server-url').value.trim();
    const agentSecret = document.getElementById('agent-secret').value.trim();

    errEl.style.display = 'none';
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    try {
      await window.nexusIT.saveSettings({ serverUrl, agentSecret });
      // Window will be closed by main process on success
    } catch (err) {
      errEl.textContent = err.message || 'Failed to save settings';
      errEl.style.display = 'block';
    } finally {
      saveBtn.textContent = 'Save & Connect';
      saveBtn.disabled = false;
    }
  });

  document.getElementById('btn-cancel').addEventListener('click', () => {
    window.close();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter')  saveBtn.click();
    if (e.key === 'Escape') document.getElementById('btn-cancel').click();
  });

  // Focus server-url if empty, else agent-secret
  const srv = document.getElementById('server-url');
  const sec = document.getElementById('agent-secret');
  if (!srv.value) srv.focus(); else sec.focus();
})();
