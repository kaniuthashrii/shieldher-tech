// Load alerts on page load
let currentAlerts = [];
let isPolling = false;

const loadAlerts = async (silent = false) => {
  if (!silent) requireAuth();
  
  try {
      const data = await apiCall("/alerts");
      currentAlerts = data.data.alerts;
      renderAlerts(currentAlerts);
      
      if (!isPolling) {
          isPolling = true;
          startPolling();
      }
  } catch (err) {
      console.error("Failed to load alerts", err);
  }
}

// Format Date helper
const formatDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

// Render alert cards
window.renderAlerts = (alerts) => {
  const container = document.getElementById("alerts-grid"); // changed from alerts-container
  if (!container) return;
  
  const countEl = document.getElementById('alert-count');
  if (countEl) countEl.textContent = `${alerts.length} alert${alerts.length !== 1 ? 's' : ''}`;

  if (alerts.length === 0) {
    container.innerHTML = `
        <div class="empty-state glass-card">
          <div class="empty-icon">✅</div>
          <h3>No Threats Detected</h3>
          <p>Your digital identity is secure. We haven't found any misuse of your images.</p>
        </div>
    `;
    return;
  }
  
  // Create UI elements safely
  container.innerHTML = alerts.map((alert, i) => {
    let badgeClass = "badge-high";
    let severityClass = "severity-high";
    let emoji = "🚨";
    let thumbBg = "rgba(255,23,68,0.15)";
    
    if (alert.severity === "MEDIUM") {
        badgeClass = "badge-medium";
        severityClass = "severity-medium";
        emoji = "⚠️";
        thumbBg = "rgba(255,145,0,0.15)";
    } else if (alert.severity === "LOW") {
        badgeClass = "badge-low";
        severityClass = "severity-low";
        emoji = "✅";
        thumbBg = "rgba(0,230,118,0.15)";
    }

    return `
    <article class="alert-full-card ${severityClass}" style="animation-delay: ${i * 0.1}s; ${alert.is_read ? 'opacity: 0.6;' : ''}" role="alert">
      <div class="alert-thumb-wrapper" style="background:${thumbBg}">
        ${emoji}
      </div>
      <div class="alert-content">
        <h3>
          ${!alert.is_read ? '<span style="color:var(--color-primary); font-size:1.5rem; line-height:0">• </span> ' : ''}${alert.message}
          <span class="badge ${badgeClass}">${alert.severity}</span>
        </h3>
        <p class="alert-description">We detected potential misuse of your image on ${alert.platform}. Please review and take appropriate action.</p>
        <div class="alert-meta-row">
          <span class="meta-item">📁 Image #${alert.image_id.substring(0,6)}</span>
          <span class="meta-item">🌐 ${alert.platform}</span>
          <span class="meta-item">📅 ${formatDate(alert.created_at)}</span>
        </div>
        <div class="alert-actions-row">
          ${alert.severity !== 'LOW' ? `<button class="btn btn-danger btn-sm" onclick="handleReport('${alert.id}')" aria-label="Report issue">🚩 Report &amp; Take Action</button>` : ''}
          ${!alert.is_read ? `<button class="btn btn-secondary btn-sm" onclick="window.markRead('${alert.id}')" aria-label="Dismiss alert">Dismiss</button>` : `<span style="color:var(--color-success); font-size:0.85rem; padding-top: 5px;">✓ Dismissed</span>`}
        </div>
      </div>
    </article>
  `}).join("")
}

// Mark alert as read
window.markRead = async (alertId) => {
  try {
      await apiCall(`/alerts/${alertId}/read`, "PATCH")
      loadAlerts(true)  // Refresh silently
      if (typeof showToast === 'function') window.showToast("Alert dismissed", "success");
  } catch (err) {
      if (typeof showToast === 'function') window.showToast("Failed to dismiss alert", "error");
  }
}

// Poll for new alerts every 10 seconds
const startPolling = () => {
  setInterval(async () => {
    try {
        const data = await apiCall("/alerts");
        const newAlerts = data.data.alerts;
        
        // Count unread difference to trigger toast
        const oldUnread = currentAlerts.filter(a => !a.is_read).length;
        const newUnread = newAlerts.filter(a => !a.is_read).length;
        
        if (newUnread > oldUnread) {
            const diff = newUnread - oldUnread;
            if (typeof showToast === 'function') showToast(`🚨 You have ${diff} new security alert(s)!`, "error");
        }
        
        currentAlerts = newAlerts;
        renderAlerts(currentAlerts);
    } catch (err) {
        // Ignore polling errors to prevent console spam
    }
  }, 10000)
}

document.addEventListener("DOMContentLoaded", loadAlerts)
