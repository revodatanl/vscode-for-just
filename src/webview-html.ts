/**
 * Returns the full HTML shell with a fixed title and three independently
 * updatable stage containers. Content is injected per-stage via postMessage.
 */
export const getShellContent = (): string => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 0;
    }

    /* --- Title (always visible) --- */

    .title {
      padding: 12px 16px 8px;
      font-size: 1.2em;
      font-weight: 600;
      color: var(--vscode-foreground);
    }

    /* --- Stage containers --- */

    #stage-cli, #stage-justfile {
      padding: 2px 16px;
    }

    #stage-recipes {
      padding: 8px 4px;
    }

    /* --- Stage row (inline content + action button) --- */

    .stage-row {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .stage-action-btn {
      background: none;
      color: var(--vscode-descriptionForeground);
      border: none;
      padding: 0 2px;
      cursor: pointer;
      font-size: 0.85em;
      opacity: 0.6;
    }

    .stage-action-btn:hover {
      opacity: 1;
      color: var(--vscode-foreground);
    }

    /* --- Inline loading --- */

    .stage-loading {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      color: var(--vscode-descriptionForeground);
      font-size: 0.9em;
    }

    .spinner-inline {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid var(--vscode-widget-border, var(--vscode-panel-border));
      border-top-color: var(--vscode-progressBar-background, var(--vscode-textLink-foreground));
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* --- Stage error --- */

    .stage-error {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      font-size: 0.9em;
      color: var(--vscode-editorWarning-foreground, #cca700);
    }

    .error-icon-inline {
      font-size: 1.1em;
    }

    /* --- CLI stage --- */

    .version-info {
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
      padding: 2px 0;
    }

    .version-warning {
      color: var(--vscode-editorWarning-foreground, #cca700);
    }

    .version-link {
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      text-decoration: underline;
    }

    /* --- Justfile stage --- */

    .justfile-path {
      color: var(--vscode-descriptionForeground);
      font-size: 0.9em;
    }

    .open-file-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 14px;
      background: none;
      color: var(--vscode-descriptionForeground);
      border: 1px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.2));
      border-radius: 2px;
      padding: 0;
      cursor: pointer;
      opacity: 0.5;
      vertical-align: middle;
      flex-shrink: 0;
    }

    .open-file-btn svg {
      display: block;
      width: 12px;
      height: 10px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .open-file-btn:hover {
      opacity: 1;
      color: var(--vscode-textLink-foreground);
      border-color: var(--vscode-textLink-foreground);
    }

    .imports-toggle-btn {
      background: none;
      color: var(--vscode-descriptionForeground);
      border: none;
      padding: 0 2px;
      cursor: pointer;
      font-size: 0.85em;
      opacity: 0.6;
      transition: transform 0.15s;
    }

    .imports-toggle-btn:hover {
      opacity: 1;
      color: var(--vscode-foreground);
    }

    .imports-toggle-btn.expanded {
      transform: rotate(180deg);
    }

    .imports-list {
      width: 100%;
      padding: 2px 0 2px 12px;
    }

    .imports-list.collapsed {
      display: none;
    }

    .import-path {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.82em;
      color: var(--vscode-descriptionForeground);
      padding: 1px 0;
      font-family: var(--vscode-editor-font-family);
    }

    /* --- Recipes stage --- */

    .recipe-stats-row {
      padding: 0 4px 4px;
    }

    .recipe-stats {
      color: var(--vscode-descriptionForeground);
      font-size: 0.85em;
    }

    .group {
      margin-bottom: 2px;
    }

    .group-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 2px 4px;
      cursor: pointer;
      user-select: none;
      border-radius: 3px;
    }

    .group-header:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .group-toggle {
      font-size: 0.7em;
      transition: transform 0.15s;
      width: 12px;
      display: inline-block;
    }

    .group-toggle.collapsed {
      transform: rotate(-90deg);
    }

    .group-name {
      font-weight: 600;
      font-size: 1.05em;
    }

    .group-count {
      color: var(--vscode-descriptionForeground);
      font-size: 0.85em;
    }

    .group-body {
      padding-left: 0;
      overflow: hidden;
    }

    .group-body.collapsed {
      display: none;
    }

    .recipe-card {
      border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
      border-radius: 4px;
      padding: 4px 8px;
      margin: 2px 0;
      background: var(--vscode-editor-background);
    }

    .recipe-card:hover {
      border-color: var(--vscode-focusBorder);
    }

    .recipe-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 2px;
    }

    .recipe-name {
      font-weight: 600;
      font-size: 1em;
      color: var(--vscode-textLink-foreground);
    }

    .recipe-doc {
      color: var(--vscode-descriptionForeground);
      font-size: 0.9em;
      margin-bottom: 4px;
    }

    .params {
      margin: 4px 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .param-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .param-row label {
      min-width: 80px;
      font-family: var(--vscode-editor-font-family);
      font-size: 0.9em;
      color: var(--vscode-foreground);
    }

    .param-row input {
      flex: 1;
      min-width: 100px;
      max-width: 300px;
      padding: 3px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, var(--vscode-widget-border));
      border-radius: 2px;
      font-family: var(--vscode-editor-font-family);
      font-size: 0.9em;
    }

    .param-row input:focus {
      outline: 1px solid var(--vscode-focusBorder);
      border-color: var(--vscode-focusBorder);
    }

    .run-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 4px 16px;
      border-radius: 2px;
      cursor: pointer;
      font-size: 0.85em;
    }

    .run-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .separator {
      border: none;
      border-top: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
      margin: 8px 0;
    }

    .empty-state {
      text-align: center;
      padding: 20px;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div id="root">
    <div class="title">Just Recipes</div>
    <div id="stage-cli"></div>
    <div id="stage-justfile"></div>
    <div id="stage-recipes"></div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function updateStage(stageId, html) {
      const el = document.getElementById('stage-' + stageId);
      if (el) {
        el.innerHTML = html;
        bindListenersIn(el);
      }
    }

    function bindListenersIn(container) {
      // Per-stage action buttons (refresh / recheck / retry)
      container.querySelectorAll('.stage-action-btn[data-stage]').forEach(btn => {
        btn.addEventListener('click', () => {
          vscode.postMessage({ command: 'refresh', stage: btn.dataset.stage });
        });
      });

      // Imports toggle
      container.querySelectorAll('.imports-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const list = container.querySelector('.imports-list');
          if (list) {
            list.classList.toggle('collapsed');
            btn.classList.toggle('expanded');
          }
        });
      });

      // Group toggles
      container.querySelectorAll('.group-header').forEach(header => {
        header.addEventListener('click', () => {
          const groupIndex = header.dataset.group;
          const body = document.getElementById('group-' + groupIndex);
          const toggle = header.querySelector('.group-toggle');
          if (body) body.classList.toggle('collapsed');
          if (toggle) toggle.classList.toggle('collapsed');
        });
      });

      // Version update links
      container.querySelectorAll('.version-link').forEach(link => {
        link.addEventListener('click', () => {
          vscode.postMessage({ command: 'openUrl', url: link.dataset.url });
        });
      });

      // Open file buttons
      container.querySelectorAll('.open-file-btn[data-path]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          vscode.postMessage({ command: 'openFile', path: btn.dataset.path });
        });
      });

      // Run recipe buttons
      container.querySelectorAll('.run-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const card = btn.closest('.recipe-card');
          const recipeName = btn.dataset.recipe;
          const inputs = card.querySelectorAll('input[data-param]');
          const args = [];
          inputs.forEach(input => {
            if (input.value.trim()) {
              args.push(input.value.trim());
            }
          });
          vscode.postMessage({
            command: 'run',
            name: recipeName,
            args: args.join(' ')
          });
        });
      });
    }

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.command === 'update') {
        updateStage(msg.stage, msg.html);
      }
    });

    vscode.postMessage({ command: 'ready' });
  </script>
</body>
</html>`;
};
