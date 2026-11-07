import {standalone} from './install.mjs?v=20261025-1';

const reported = new Set();

async function recordInstalledLaunch(slug) {
  if (!slug || reported.has(slug) || !standalone(window)) return;
  reported.add(slug);
  try {
    const response = await fetch('/api/player-install', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({slug})
    });
    if (!response.ok) reported.delete(slug);
  } catch {
    reported.delete(slug);
  }
}

document.addEventListener('tlpt-player-change', ({detail}) => {
  if (!detail.commishEntry && !detail.preview) recordInstalledLaunch(detail.slug);
});
recordInstalledLaunch(document.querySelector('#shared-player')?.value);

const loadingPanels = new WeakSet();

async function loadAdoption(panel) {
  if (!panel?.open || loadingPanels.has(panel)) return;
  loadingPanels.add(panel);
  const status = panel.querySelector('[role="status"]');
  const table = panel.querySelector('table');
  if (table.hidden) status.textContent = 'Checking player installs and alerts…';
  try {
    const response = await fetch('/api/player-adoption', {cache: 'no-store'});
    if (!response.ok) throw new Error('Could not load player adoption');
    const {players} = await response.json();
    const rows = players.map(player => {
      const row = document.createElement('tr');
      const name = document.createElement('th');
      name.scope = 'row';
      name.textContent = player.name;
      row.append(name);
      row.insertCell().textContent = player.installed ? 'Seen' : 'Not seen yet';
      row.insertCell().textContent = player.alertDevices
        ? `On · ${player.alertDevices} ${player.alertDevices === 1 ? 'device' : 'devices'}`
        : 'Off';
      return row;
    });
    table.tBodies[0].replaceChildren(...rows);
    table.hidden = !rows.length;
    const installed = players.filter(player => player.installed).length;
    const alerts = players.filter(player => player.alertDevices > 0).length;
    status.textContent = `${installed} of ${players.length} players seen in the installed app · ${alerts} with alerts on`;
  } catch {
    status.textContent = 'Could not check player installs and alerts. Reopen this section to retry.';
    table.hidden = true;
  } finally {
    loadingPanels.delete(panel);
  }
}

document.addEventListener('toggle', event => {
  if (event.target.id === 'player-adoption') loadAdoption(event.target);
}, true);
document.addEventListener('tlpt-activity-change', ({detail}) => {
  if (detail.commish && detail.activity === 'settings') {
    loadAdoption(document.querySelector('#player-adoption'));
  }
});
