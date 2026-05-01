'use strict';

(async () => {
  // Load initial state
  const init = await window.nexusIT.getStatus();
  render(init);

  // Live updates pushed from main process on every heartbeat
  window.nexusIT.onStatus(render);

  document.getElementById('btn-dashboard').addEventListener('click', () => {
    window.nexusIT.openDashboard();
  });

  // ΓöÇΓöÇ Render function ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  function render(d) {
    if (!d) return;

    // Badge
    const badge = document.getElementById('badge');
    badge.className = 'badge';
    if (d.status === 'connected') {
      badge.classList.add('badge--connected');
      badge.textContent = 'ΓùÅ Connected';
    } else if (d.status === 'connecting') {
      badge.classList.add('badge--connecting');
      badge.textContent = 'Γùî Connecting...';
    } else {
      badge.classList.add('badge--disconnected');
      badge.textContent = 'Γùï Disconnected';
    }

    // Info rows
    setText('hostname',   d.hostname  || 'ΓÇö');
    setText('os-version', d.osVersion || 'ΓÇö');
    setText('local-ip',   d.localIp   || 'ΓÇö');
    setText('server-url', d.serverUrl || 'Not configured');

    // Stats bars
    if (d.stats) {
      setBar('cpu-bar',  'cpu-pct',  d.stats.cpu);
      setBar('mem-bar',  'mem-pct',  d.stats.memory);
      setBar('disk-bar', 'disk-pct', d.stats.disk);
    }

    // Footer
    if (d.lastHeartbeat) {
      document.getElementById('last-beat').textContent = `Last update: ${d.lastHeartbeat}`;
    } else {
      document.getElementById('last-beat').textContent = 'Not connected';
    }
    document.getElementById('agent-ver').textContent = `v${d.version || '1.0.0'}`;
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function setBar(barId, pctId, pct) {
    const bar = document.getElementById(barId);
    const pctEl = document.getElementById(pctId);
    const p = (pct != null && !isNaN(pct)) ? Math.min(100, Math.max(0, pct)) : null;
    if (pctEl) pctEl.textContent = p != null ? `${p}%` : 'ΓÇö';
    if (bar) {
      bar.style.width = p != null ? `${p}%` : '0%';
      // Color threshold: >90% red, >70% amber, else indigo
      bar.style.background = p > 90 ? '#ef4444' : p > 70 ? '#f59e0b' : '#6366f1';
    }
  }
})();
