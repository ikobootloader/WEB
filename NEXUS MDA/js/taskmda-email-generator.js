(function initTaskMdaEmailGeneratorModule(global) {
  'use strict';

  function createModule(options) {
    const opts = options || {};
    const actions = opts.actions || {};
    const helpers = opts.helpers || {};
    let bound = false;
    let state = null;
    let savedEditorRange = null;

    const DEFAULT_TEMPLATE = {
      id: 'default',
      name: 'Template par defaut',
      to: '',
      cc: '',
      bcc: '',
      subject: 'Information {{app_name}} - {{date}}',
      bodyHtml: '<p>Bonjour,</p><p>Message a personnaliser.</p><p>Cordialement,<br>{{user_name}}</p>'
    };

    function normalizeState(raw) {
      const source = raw && typeof raw === 'object' ? raw : {};
      const templates = Array.isArray(source.templates) && source.templates.length
        ? source.templates
        : [DEFAULT_TEMPLATE];
      const selectedTemplateId = String(source.selectedTemplateId || templates[0]?.id || DEFAULT_TEMPLATE.id).trim();
      return {
        templates: templates.map((tpl, index) => ({
          id: String(tpl?.id || `tpl-${Date.now()}-${index}`),
          name: String(tpl?.name || `Template ${index + 1}`),
          to: String(tpl?.to || ''),
          cc: String(tpl?.cc || ''),
          bcc: String(tpl?.bcc || ''),
          subject: String(tpl?.subject || ''),
          bodyHtml: String(tpl?.bodyHtml || '<p></p>')
        })),
        selectedTemplateId
      };
    }

    async function loadState() {
      const raw = await actions.load?.();
      state = normalizeState(raw);
    }

    async function saveState() {
      await actions.save?.(state);
    }

    function getDom() {
      return {
        select: document.getElementById('email-generator-template-select'),
        name: document.getElementById('email-generator-template-name'),
        to: document.getElementById('email-generator-to'),
        cc: document.getElementById('email-generator-cc'),
        bcc: document.getElementById('email-generator-bcc'),
        subject: document.getElementById('email-generator-subject'),
        editor: document.getElementById('email-generator-editor'),
        preview: document.getElementById('email-generator-preview')
      };
    }

    function currentTemplate() {
      if (!state) return null;
      const current = state.templates.find((tpl) => tpl.id === state.selectedTemplateId);
      if (current) return current;
      state.selectedTemplateId = state.templates[0]?.id || DEFAULT_TEMPLATE.id;
      return state.templates[0] || null;
    }

    function computeVars() {
      const date = new Date();
      return {
        app_name: String(helpers.getAppName?.() || 'NEXUS MDA'),
        user_name: String(helpers.getUserName?.() || 'Utilisateur'),
        date: date.toLocaleDateString('fr-FR'),
        project_name: String(helpers.getProjectName?.() || ''),
        task_title: String(helpers.getTaskTitle?.() || ''),
        status: String(helpers.getStatus?.() || '')
      };
    }

    function applyVars(text, vars) {
      return String(text || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, key) => {
        const value = vars[String(key || '').toLowerCase()];
        return value == null ? m : String(value);
      });
    }

    function templateToDom(tpl) {
      const dom = getDom();
      if (!dom.editor) return;
      dom.name.value = tpl?.name || '';
      dom.to.value = tpl?.to || '';
      dom.cc.value = tpl?.cc || '';
      dom.bcc.value = tpl?.bcc || '';
      dom.subject.value = tpl?.subject || '';
      dom.editor.innerHTML = tpl?.bodyHtml || '<p></p>';
    }

    function domToTemplate() {
      const tpl = currentTemplate();
      if (!tpl) return;
      const dom = getDom();
      tpl.name = String(dom.name?.value || '').trim() || tpl.name;
      tpl.to = String(dom.to?.value || '').trim();
      tpl.cc = String(dom.cc?.value || '').trim();
      tpl.bcc = String(dom.bcc?.value || '').trim();
      tpl.subject = String(dom.subject?.value || '').trim();
      tpl.bodyHtml = String(dom.editor?.innerHTML || '').trim() || '<p></p>';
    }

    function renderTemplateSelect() {
      const dom = getDom();
      if (!dom.select) return;
      dom.select.innerHTML = state.templates
        .map((tpl) => `<option value="${helpers.escapeHtml?.(tpl.id) || tpl.id}">${helpers.escapeHtml?.(tpl.name) || tpl.name}</option>`)
        .join('');
      dom.select.value = state.selectedTemplateId;
    }

    function renderPreview() {
      const dom = getDom();
      if (!dom.preview) return;
      domToTemplate();
      const tpl = currentTemplate();
      const vars = computeVars();
      const subject = applyVars(tpl?.subject || '', vars);
      const body = applyVars(tpl?.bodyHtml || '', vars);
      dom.preview.innerHTML = `<p><strong>Objet:</strong> ${helpers.escapeHtml?.(subject) || subject}</p>${body}`;
    }

    async function render() {
      if (!state) await loadState();
      const tpl = currentTemplate();
      renderTemplateSelect();
      templateToDom(tpl);
      renderPreview();
    }

    async function createTemplate() {
      if (!state) await loadState();
      const next = {
        id: `tpl-${Date.now()}`,
        name: `Template ${state.templates.length + 1}`,
        to: '',
        cc: '',
        bcc: '',
        subject: '',
        bodyHtml: '<p></p>'
      };
      state.templates.push(next);
      state.selectedTemplateId = next.id;
      await saveState();
      await render();
      helpers.showToast?.('Template cree');
    }

    async function saveTemplate() {
      domToTemplate();
      const tpl = currentTemplate();
      if (tpl) tpl.name = String(getDom().name?.value || '').trim() || tpl.name;
      await saveState();
      renderTemplateSelect();
      renderPreview();
      helpers.showToast?.('Template enregistre');
    }

    async function deleteTemplate() {
      if (!state || state.templates.length <= 1) {
        helpers.showToast?.('Conservez au moins un template');
        return;
      }
      const id = state.selectedTemplateId;
      state.templates = state.templates.filter((tpl) => tpl.id !== id);
      state.selectedTemplateId = state.templates[0]?.id || DEFAULT_TEMPLATE.id;
      await saveState();
      await render();
      helpers.showToast?.('Template supprime');
    }

    function applyEditorCommand(cmd) {
      const editor = document.getElementById('email-generator-editor');
      if (editor && savedEditorRange) {
        const selection = global.getSelection?.();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(savedEditorRange);
        }
      }
      if (editor) editor.focus();
      if (cmd === 'createLink') {
        const url = prompt('URL du lien');
        if (!url) return;
        document.execCommand('createLink', false, url);
        return;
      }
      document.execCommand(cmd, false, null);
    }

    function insertVariableToken() {
      const token = prompt('Variable (ex: {{user_name}})', '{{user_name}}');
      if (!token) return;
      document.execCommand('insertText', false, token);
      renderPreview();
    }

    async function copyHtml() {
      domToTemplate();
      const tpl = currentTemplate();
      const html = applyVars(tpl?.bodyHtml || '', computeVars());
      await navigator.clipboard.writeText(html);
      helpers.showToast?.('HTML copie');
    }

    async function copyText() {
      domToTemplate();
      const tmp = document.createElement('div');
      tmp.innerHTML = applyVars(currentTemplate()?.bodyHtml || '', computeVars());
      const text = (tmp.textContent || tmp.innerText || '').trim();
      await navigator.clipboard.writeText(text);
      helpers.showToast?.('Texte copie');
    }

    function openMailto() {
      domToTemplate();
      const tpl = currentTemplate();
      const vars = computeVars();
      const subject = applyVars(tpl?.subject || '', vars);
      const tmp = document.createElement('div');
      tmp.innerHTML = applyVars(tpl?.bodyHtml || '', vars);
      tmp.querySelectorAll('br').forEach((node) => node.replaceWith('\n'));
      tmp.querySelectorAll('p,div,li').forEach((node) => {
        if (node && node.textContent && !/\n$/.test(node.textContent)) node.append('\n');
      });
      const body = String(tmp.textContent || tmp.innerText || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      const enc = (value) => encodeURIComponent(String(value || ''));
      const pairs = [];
      if (tpl?.cc) pairs.push(`cc=${enc(applyVars(tpl.cc, vars).replace(/;/g, ','))}`);
      if (tpl?.bcc) pairs.push(`bcc=${enc(applyVars(tpl.bcc, vars).replace(/;/g, ','))}`);
      if (subject) pairs.push(`subject=${enc(subject)}`);
      if (body) pairs.push(`body=${enc(body)}`);
      const to = enc(applyVars(tpl?.to || '', vars).replace(/;/g, ','));
      const query = pairs.join('&');
      global.location.href = `mailto:${to}${query ? `?${query}` : ''}`;
    }

    function bindDom() {
      if (bound) return;
      bound = true;

      document.getElementById('email-generator-template-select')?.addEventListener('change', async (e) => {
        if (!state) await loadState();
        state.selectedTemplateId = String(e?.target?.value || '').trim();
        await saveState();
        await render();
      });
      document.getElementById('btn-email-generator-new-template')?.addEventListener('click', async () => {
        await createTemplate();
      });
      document.getElementById('btn-email-generator-save-template')?.addEventListener('click', async () => {
        await saveTemplate();
      });
      document.getElementById('btn-email-generator-delete-template')?.addEventListener('click', async () => {
        await deleteTemplate();
      });
      document.getElementById('email-generator-toolbar')?.addEventListener('mousedown', (e) => {
        e.preventDefault();
      });
      document.getElementById('email-generator-toolbar')?.addEventListener('click', (e) => {
        const button = e?.target instanceof Element ? e.target.closest('[data-email-cmd]') : null;
        if (!button) return;
        const cmd = String(button.getAttribute('data-email-cmd') || '').trim();
        if (!cmd) return;
        applyEditorCommand(cmd);
        renderPreview();
      });
      document.getElementById('btn-email-generator-insert-var')?.addEventListener('click', () => {
        insertVariableToken();
      });
      ['email-generator-template-name', 'email-generator-to', 'email-generator-cc', 'email-generator-bcc', 'email-generator-subject']
        .forEach((id) => {
          document.getElementById(id)?.addEventListener('input', () => {
            renderPreview();
          });
        });
      document.getElementById('email-generator-editor')?.addEventListener('input', () => {
        renderPreview();
      });
      const persistEditorRange = () => {
        const editor = document.getElementById('email-generator-editor');
        const selection = global.getSelection?.();
        if (!editor || !selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        if (!editor.contains(range.commonAncestorContainer)) return;
        savedEditorRange = range.cloneRange();
      };
      document.getElementById('email-generator-editor')?.addEventListener('keyup', persistEditorRange);
      document.getElementById('email-generator-editor')?.addEventListener('mouseup', persistEditorRange);
      document.getElementById('email-generator-editor')?.addEventListener('focus', persistEditorRange);
      document.getElementById('btn-email-generator-copy-html')?.addEventListener('click', async () => {
        await copyHtml();
      });
      document.getElementById('btn-email-generator-copy-text')?.addEventListener('click', async () => {
        await copyText();
      });
      document.getElementById('btn-email-generator-open-mailto')?.addEventListener('click', () => {
        openMailto();
      });
    }

    return {
      bindDom,
      render
    };
  }

  global.TaskMDAEmailGenerator = {
    createModule
  };
}(window));
