// ============================================================================
// TASKMDA TEAM - MODULE EDITEUR PROJET
// Extrait de taskmda-team.js pour alleger le fichier principal
// ============================================================================

    function insertHtmlAtCursor(html) {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return false;
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const tpl = document.createElement('template');
      tpl.innerHTML = html;
      const fragment = tpl.content;
      const lastNode = fragment.lastChild;
      range.insertNode(fragment);
      if (lastNode) {
        range.setStartAfter(lastNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      return true;
    }

    function findSelectedImageWithinEditor(editor) {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return null;
      let node = selection.anchorNode;
      if (!node) return null;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      if (!(node instanceof Element)) return null;
      const img = node.closest('img');
      if (img && editor.contains(img)) return img;
      if (activeProjectEditorImage && editor.contains(activeProjectEditorImage)) return activeProjectEditorImage;
      return null;
    }

    function ensureProjectEditorImageOverlay(editor) {
      if (!editor) return null;
      let overlay = editor.querySelector('.project-editor-image-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'project-editor-image-overlay hidden';
        overlay.innerHTML = `
          <div class="project-editor-image-overlay-panel">
            <input type="range" min="15" max="100" step="1" value="100" class="project-editor-image-width-range" aria-label="Largeur image en pourcentage">
            <span class="project-editor-image-width-value">100%</span>
          </div>
          <button type="button" class="project-editor-image-resize-handle" title="Redimensionnement glisser-déposer" aria-label="Redimensionner l'image en glissant">
            <span class="material-symbols-outlined">open_with</span>
          </button>
        `;
        editor.appendChild(overlay);
      }
      if (overlay.dataset.bound !== '1') {
        overlay.dataset.bound = '1';
        const panel = overlay.querySelector('.project-editor-image-overlay-panel');
        const range = overlay.querySelector('.project-editor-image-width-range');
        const value = overlay.querySelector('.project-editor-image-width-value');
        const handle = overlay.querySelector('.project-editor-image-resize-handle');
        let sliderRafId = null;
        const applyWidthFromControl = (nextWidth) => {
          if (!activeProjectEditorImage || !editor.contains(activeProjectEditorImage)) return;
          const width = normalizeProjectImageWidthPercent(nextWidth, 100);
          applyProjectImageWidth(activeProjectEditorImage, width);
          if (value) value.textContent = `${width}%`;
          if (range && String(range.value) !== String(width)) {
            range.value = String(width);
          }
          if (sliderRafId) cancelAnimationFrame(sliderRafId);
          sliderRafId = requestAnimationFrame(() => {
            updateProjectEditorImageOverlayPosition(editor);
          });
        };
        const setSliderDragging = (on) => {
          overlay.dataset.sliderDragging = on ? '1' : '0';
        };
        range?.addEventListener('pointerdown', () => setSliderDragging(true));
        range?.addEventListener('pointerup', () => setSliderDragging(false));
        range?.addEventListener('pointercancel', () => setSliderDragging(false));
        range?.addEventListener('blur', () => setSliderDragging(false));
        range?.addEventListener('input', () => {
          applyWidthFromControl(range.value);
        });
        handle?.addEventListener('pointerdown', (event) => {
          if (!activeProjectEditorImage || !editor.contains(activeProjectEditorImage)) return;
          event.preventDefault();
          event.stopPropagation();
          const editorRect = editor.getBoundingClientRect();
          const startClientX = Number(event.clientX || 0);
          const startWidth = getProjectImageWidthPercent(activeProjectEditorImage);
          projectImageResizeDragState = {
            editorId: editor.id || '',
            startClientX,
            startWidth,
            editorWidth: Math.max(1, editorRect.width)
          };
          overlay.classList.add('is-resizing');
          const move = (moveEvent) => {
            if (!projectImageResizeDragState || projectImageResizeDragState.editorId !== (editor.id || '')) return;
            const deltaX = Number(moveEvent.clientX || 0) - projectImageResizeDragState.startClientX;
            const percentDelta = (deltaX / projectImageResizeDragState.editorWidth) * 100;
            const nextWidth = projectImageResizeDragState.startWidth + percentDelta;
            applyWidthFromControl(nextWidth);
          };
          const stop = () => {
            overlay.classList.remove('is-resizing');
            projectImageResizeDragState = null;
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', stop);
            window.removeEventListener('pointercancel', stop);
          };
          window.addEventListener('pointermove', move, { passive: true });
          window.addEventListener('pointerup', stop, { passive: true });
          window.addEventListener('pointercancel', stop, { passive: true });
        });
      }
      return overlay;
    }

    function removeProjectEditorImageOverlay(editor) {
      if (!editor) return;
      editor.querySelectorAll('.project-editor-image-overlay').forEach((el) => el.remove());
      editor.querySelectorAll('.project-editor-image-overlay-panel').forEach((el) => el.remove());
      editor.querySelectorAll('.project-editor-image-overlay-btn').forEach((el) => el.remove());
      editor.querySelectorAll('.project-editor-image-resize-handle').forEach((el) => el.remove());
    }

    function clearProjectEditorImageSelection() {
      if (activeProjectEditorImage) {
        activeProjectEditorImage.classList.remove('desc-img-selected');
      }
      const editor = activeProjectEditorId ? document.getElementById(activeProjectEditorId) : null;
      if (editor) {
        const overlay = editor.querySelector('.project-editor-image-overlay');
        overlay?.classList.add('hidden');
      }
      activeProjectEditorImage = null;
      activeProjectEditorId = '';
    }

    function updateProjectEditorImageOverlayPosition(editor = null) {
      const targetEditor = editor || (activeProjectEditorId ? document.getElementById(activeProjectEditorId) : null);
      if (!targetEditor || !activeProjectEditorImage || !targetEditor.contains(activeProjectEditorImage)) return;
      const overlay = ensureProjectEditorImageOverlay(targetEditor);
      if (!overlay) return;
      const panel = overlay.querySelector('.project-editor-image-overlay-panel');
      const range = overlay.querySelector('.project-editor-image-width-range');
      const value = overlay.querySelector('.project-editor-image-width-value');
      const handle = overlay.querySelector('.project-editor-image-resize-handle');
      const width = getProjectImageWidthPercent(activeProjectEditorImage);
      if (range && overlay.dataset.sliderDragging !== '1') range.value = String(width);
      if (value) value.textContent = `${width}%`;
      const editorRect = targetEditor.getBoundingClientRect();
      const imageRect = activeProjectEditorImage.getBoundingClientRect();
      const left = imageRect.right - editorRect.left + targetEditor.scrollLeft - 34;
      const top = imageRect.top - editorRect.top + targetEditor.scrollTop + 8;
      overlay.style.left = `${Math.max(8, left)}px`;
      overlay.style.top = `${Math.max(8, top)}px`;
      overlay.classList.remove('hidden');
      if (!panel || panel.classList.contains('hidden')) return;
      const panelRect = panel.getBoundingClientRect();
      if (panelRect.right > window.innerWidth - 8) {
        panel.style.transform = 'translateX(-100%)';
      } else {
        panel.style.transform = 'none';
      }
      if (handle) {
        const rawHandleLeft = imageRect.right - editorRect.left + targetEditor.scrollLeft - 12;
        const rawHandleTop = imageRect.bottom - editorRect.top + targetEditor.scrollTop - 12;
        const maxLeft = Math.max(8, targetEditor.scrollWidth - 30);
        const maxTop = Math.max(8, targetEditor.scrollHeight - 30);
        const handleLeft = Math.max(8, Math.min(rawHandleLeft, maxLeft));
        const handleTop = Math.max(8, Math.min(rawHandleTop, maxTop));
        handle.style.left = `${handleLeft}px`;
        handle.style.top = `${handleTop}px`;
      }
    }

    function setProjectEditorImageSelection(editor, img, options = {}) {
      if (!editor || !img || !editor.contains(img)) return;
      if (activeProjectEditorImage && activeProjectEditorImage !== img) {
        activeProjectEditorImage.classList.remove('desc-img-selected');
      }
      activeProjectEditorImage = img;
      activeProjectEditorId = editor.id || '';
      img.classList.add('desc-img-selected');
      img.setAttribute('draggable', 'false');
      ensureProjectEditorImageOverlay(editor);
      const overlay = editor.querySelector('.project-editor-image-overlay');
      const panel = overlay?.querySelector('.project-editor-image-overlay-panel');
      if (options.openPanel) {
        panel?.classList.remove('hidden');
      }
      updateProjectEditorImageOverlayPosition(editor);
    }

    function normalizeProjectImageWidthPercent(value, fallback = 100) {
      const raw = Number.parseFloat(String(value ?? '').replace(',', '.').replace('%', '').trim());
      if (!Number.isFinite(raw)) return fallback;
      return Math.max(15, Math.min(100, Math.round(raw)));
    }

    function parseImageWidthPercentFromStyle(styleValue) {
      const raw = String(styleValue || '');
      const match = raw.match(/width\s*:\s*([0-9.]+)\s*%/i);
      if (!match) return null;
      return normalizeProjectImageWidthPercent(match[1], 100);
    }

    function getProjectImageWidthPercent(img) {
      if (!(img instanceof Element)) return 100;
      const fromData = img.getAttribute('data-desc-image-width');
      if (fromData) return normalizeProjectImageWidthPercent(fromData, 100);
      const fromStyle = parseImageWidthPercentFromStyle(img.getAttribute('style'));
      if (fromStyle) return fromStyle;
      const fromWidthAttr = img.getAttribute('width');
      if (fromWidthAttr) return normalizeProjectImageWidthPercent(fromWidthAttr, 100);
      return 100;
    }

    function applyProjectImageWidth(img, widthPercent) {
      if (!(img instanceof Element)) return;
      const width = normalizeProjectImageWidthPercent(widthPercent, 100);
      img.setAttribute('data-desc-image-width', String(width));
      img.style.width = `${width}%`;
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
    }

    function applyProjectEditorImageSize(editor) {
      const selectedImg = findSelectedImageWithinEditor(editor) || (activeProjectEditorImage && editor?.contains(activeProjectEditorImage) ? activeProjectEditorImage : null);
      if (!selectedImg) {
        showToast("Sélectionnez d'abord une image dans la description");
        return;
      }
      setProjectEditorImageSelection(editor, selectedImg, { openPanel: true });
    }

    function applyProjectEditorAlignment(editor, alignClass) {
      const selectedImg = findSelectedImageWithinEditor(editor);
      if (selectedImg) {
        selectedImg.classList.remove('desc-img-align-left', 'desc-img-align-center', 'desc-img-align-right');
        selectedImg.classList.add(alignClass);
        return;
      }
      const command = alignClass === 'desc-img-align-left'
        ? 'justifyLeft'
        : alignClass === 'desc-img-align-right'
          ? 'justifyRight'
          : 'justifyCenter';
      document.execCommand(command, false, null);
    }

    async function handleProjectEditorImageInsert(editor, fileInputId) {
      const input = document.getElementById(fileInputId);
      if (!input) return;
      const files = Array.from(input.files || []);
      if (!files.length) return;
      const quill = projectDescriptionQuillEditors.get(editor?.id || '');
      for (const file of files) {
        if (!String(file.type || '').startsWith('image/')) continue;
        if (file.size > 8 * 1024 * 1024) {
          showToast(`Image trop lourde: ${file.name} (max 8 Mo)`);
          continue;
        }
        const imageWidth = 100;
        const imageId = uuidv4();
        const dataUrl = await fileToDataUrl(file);
        const safeAlt = escapeHtml(file.name || 'image');
        const html = `<figure><img src="${dataUrl}" alt="${safeAlt}" class="desc-img-align-center" data-desc-image-id="${imageId}" data-desc-image-width="${imageWidth}" style="width:${imageWidth}%;max-width:100%;height:auto"></figure><p><br></p>`;
        if (quill) {
          const selection = quill.getSelection(true) || { index: quill.getLength(), length: 0 };
          quill.clipboard.dangerouslyPasteHTML(selection.index, html, 'user');
          quill.setSelection(selection.index + 1, 0, 'user');
        } else {
          editor.focus();
          insertHtmlAtCursor(html);
        }
        const insertedImage = editor.querySelector(`img[data-desc-image-id="${imageId}"]`);
        if (insertedImage && !quill) {
          insertedImage.setAttribute('draggable', 'false');
          setProjectEditorImageSelection(editor, insertedImage, { openPanel: true });
        }
      }
      input.value = '';
    }

    function pickProjectEditorEmoji() {
      const projectEmojiPalette = [
        '\u{1F600}', '\u{1F604}', '\u{1F642}', '\u{1F609}', '\u{1F60A}', '\u{1F60D}', '\u{1F60E}', '\u{1F91D}',
        '\u{1F44D}', '\u{1F44F}', '\u{1F64C}', '\u{1F64F}', '\u{1F4A1}', '\u{2705}', '\u{26A0}\u{FE0F}', '\u{1F680}',
        '\u{1F4CC}', '\u{1F4C5}', '\u{1F4CE}', '\u{1F4DD}', '\u{1F4E3}', '\u{1F3AF}', '\u{1F525}', '\u{1F4AC}',
        '\u{1F389}', '\u{1F4AA}', '\u{1F4A5}', '\u{1F64B}', '\u{1F3C1}', '\u{1F6A7}', '\u{1F3C6}', '\u{1F9E0}'
      ];
      const choices = projectEmojiPalette.map((emoji, index) => `${index + 1}:${emoji}`).join('   ');
      const raw = window.prompt(`Choisir un emoji (numero ou emoji direct)\n${choices}`, '1');
      if (!raw) return '';
      const value = String(raw).trim();
      const index = Number.parseInt(value, 10);
      if (Number.isInteger(index) && index >= 1 && index <= projectEmojiPalette.length) {
        return projectEmojiPalette[index - 1];
      }
      return value;
    }

    function normalizeProjectVideoEmbedUrl(rawValue) {
      const raw = String(rawValue || '').trim();
      if (!raw) return '';
      let url;
      try {
        url = new URL(raw);
      } catch {
        return '';
      }
      const protocol = String(url.protocol || '').toLowerCase();
      if (protocol !== 'https:' && protocol !== 'http:') return '';
      const hostname = String(url.hostname || '').toLowerCase().replace(/^www\./, '');
      const path = String(url.pathname || '');

      if (hostname === 'youtu.be') {
        const id = path.split('/').filter(Boolean)[0];
        return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : '';
      }
      if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
        if (path.startsWith('/watch')) {
          const id = url.searchParams.get('v');
          return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : '';
        }
        if (path.startsWith('/embed/')) {
          const id = path.split('/').filter(Boolean)[1];
          return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : '';
        }
        if (path.startsWith('/shorts/')) {
          const id = path.split('/').filter(Boolean)[1];
          return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : '';
        }
      }
      if (hostname === 'vimeo.com') {
        const id = path.split('/').filter(Boolean)[0];
        return id ? `https://player.vimeo.com/video/${encodeURIComponent(id)}` : '';
      }
      if (hostname === 'player.vimeo.com' && path.startsWith('/video/')) {
        const id = path.split('/').filter(Boolean)[1];
        return id ? `https://player.vimeo.com/video/${encodeURIComponent(id)}` : '';
      }
      if (hostname === 'dai.ly') {
        const id = path.split('/').filter(Boolean)[0];
        return id ? `https://www.dailymotion.com/embed/video/${encodeURIComponent(id)}` : '';
      }
      if (hostname === 'dailymotion.com' && path.includes('/video/')) {
        const id = path.split('/video/')[1]?.split(/[/?#]/)[0];
        return id ? `https://www.dailymotion.com/embed/video/${encodeURIComponent(id)}` : '';
      }
      if (hostname === 'loom.com' && path.startsWith('/share/')) {
        const id = path.split('/').filter(Boolean)[1];
        return id ? `https://www.loom.com/embed/${encodeURIComponent(id)}` : '';
      }
      if (hostname === 'loom.com' && path.startsWith('/embed/')) {
        const id = path.split('/').filter(Boolean)[1];
        return id ? `https://www.loom.com/embed/${encodeURIComponent(id)}` : '';
      }
      return '';
    }

    function pickProjectEditorVideoUrl() {
      const raw = window.prompt(
        'URL vidéo (YouTube, Vimeo, Dailymotion, Loom)',
        'https://www.youtube.com/watch?v='
      );
      if (!raw) return '';
      const embedUrl = normalizeProjectVideoEmbedUrl(raw);
      if (!embedUrl) {
        showToast('URL vidéo non reconnue (YouTube/Vimeo/Dailymotion/Loom uniquement)');
        return '';
      }
      return embedUrl;
    }

    function placeCaretAtEnd(node) {
      if (!(node instanceof Element)) return;
      const selection = window.getSelection?.();
      if (!selection) return;
      const range = document.createRange();
      range.selectNodeContents(node);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    function applyProjectEditorHeadingFormat(editor, tagName) {
      if (!editor || !tagName) return;
      const normalized = String(tagName).toLowerCase();
      let applied = false;
      try {
        applied = document.execCommand('formatBlock', false, `<${normalized}>`);
      } catch {
        applied = false;
      }
      if (!applied) {
        try {
          applied = document.execCommand('formatBlock', false, normalized);
        } catch {
          applied = false;
        }
      }
      if (applied) return;

      const selection = window.getSelection?.();
      if (!selection || !selection.rangeCount) return;
      const anchorNode = selection.anchorNode;
      const anchorElement = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;
      if (!anchorElement || !editor.contains(anchorElement)) return;
      const block = anchorElement.closest('p,div,h1,h2,h3,h4,h5,h6,blockquote');
      if (!block || !editor.contains(block)) return;
      if (block.tagName.toLowerCase() === normalized) return;
      const replacement = document.createElement(normalized);
      replacement.innerHTML = block.innerHTML;
      block.replaceWith(replacement);
      placeCaretAtEnd(replacement);
    }

    function applyProjectDescriptionEditorAction(action, editor, fileInputId = '') {
      if (!editor) return;
      const quill = projectDescriptionQuillEditors.get(editor.id || '');
      if (quill) {
        quill.focus();
        const selection = quill.getSelection(true) || { index: quill.getLength(), length: 0 };
        const currentFormats = quill.getFormat(selection.index, selection.length || 1);
        switch (action) {
          case 'bold':
            quill.format('bold', !currentFormats.bold);
            return;
          case 'italic':
            quill.format('italic', !currentFormats.italic);
            return;
          case 'h1':
            quill.format('header', currentFormats.header === 1 ? false : 1);
            return;
          case 'h2':
            quill.format('header', currentFormats.header === 2 ? false : 2);
            return;
          case 'h3':
            quill.format('header', currentFormats.header === 3 ? false : 3);
            return;
          case 'ul':
            quill.format('list', currentFormats.list === 'bullet' ? false : 'bullet');
            return;
          case 'ol':
            quill.format('list', currentFormats.list === 'ordered' ? false : 'ordered');
            return;
          case 'emoji': {
            const emoji = pickProjectEditorEmoji();
            if (emoji) {
              quill.insertText(selection.index, emoji, 'user');
              quill.setSelection(selection.index + emoji.length, 0, 'user');
            }
            return;
          }
          case 'image':
            document.getElementById(fileInputId)?.click();
            return;
          case 'video': {
            const videoUrl = pickProjectEditorVideoUrl();
            if (!videoUrl) return;
            quill.insertEmbed(selection.index, 'video', videoUrl, 'user');
            quill.insertText(selection.index + 1, '\n', 'user');
            quill.setSelection(selection.index + 2, 0, 'user');
            return;
          }
          case 'image-size':
            showToast("Redimensionnement Quill actif: cliquez l'image puis utilisez les poignées.");
            return;
          case 'align-left':
            applyProjectEditorAlignment(editor, 'desc-img-align-left');
            return;
          case 'align-center':
            applyProjectEditorAlignment(editor, 'desc-img-align-center');
            return;
          case 'align-right':
            applyProjectEditorAlignment(editor, 'desc-img-align-right');
            return;
          default:
            return;
        }
      }
      editor.focus();
      switch (action) {
        case 'bold':
          document.execCommand('bold', false, null);
          break;
        case 'italic':
          document.execCommand('italic', false, null);
          break;
        case 'h1':
          applyProjectEditorHeadingFormat(editor, 'h1');
          break;
        case 'h2':
          applyProjectEditorHeadingFormat(editor, 'h2');
          break;
        case 'h3':
          applyProjectEditorHeadingFormat(editor, 'h3');
          break;
        case 'ul':
          document.execCommand('insertUnorderedList', false, null);
          break;
        case 'ol':
          document.execCommand('insertOrderedList', false, null);
          break;
        case 'emoji': {
          const emoji = pickProjectEditorEmoji();
          if (emoji) {
            document.execCommand('insertText', false, emoji);
          }
          break;
        }
        case 'emoji': {
          const emoji = window.prompt('Emoji à insérer', '😊');
          if (emoji) {
            document.execCommand('insertText', false, emoji);
          }
          break;
        }
        case 'image':
          document.getElementById(fileInputId)?.click();
          break;
        case 'video': {
          const videoUrl = pickProjectEditorVideoUrl();
          if (!videoUrl) break;
          const html = `<p><iframe src="${escapeHtml(videoUrl)}" class="desc-video-embed" frameborder="0" allowfullscreen loading="lazy"></iframe></p><p><br></p>`;
          insertHtmlAtCursor(html);
          break;
        }
        case 'image-size':
          applyProjectEditorImageSize(editor);
          break;
        case 'align-left':
          applyProjectEditorAlignment(editor, 'desc-img-align-left');
          break;
        case 'align-center':
          applyProjectEditorAlignment(editor, 'desc-img-align-center');
          break;
        case 'align-right':
          applyProjectEditorAlignment(editor, 'desc-img-align-right');
          break;
      }
    }

    function ensureProjectDescriptionQuillEditor(editorId) {
      if (!window.Quill) return null;
      if (projectDescriptionQuillEditors.has(editorId)) {
        return projectDescriptionQuillEditors.get(editorId);
      }
      const host = document.getElementById(editorId);
      if (!host) return null;
      host.removeAttribute('contenteditable');
      const quillCtor = window.Quill;
      if (!quillCtor.imports?.['modules/imageResize'] && window.ImageResize) {
        quillCtor.register('modules/imageResize', window.ImageResize);
      }
      const modules = {
        toolbar: {
          container: [
            [{ header: [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'blockquote'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            [{ align: [] }],
            [{ background: [] }],
            ['link', 'image', 'video', 'emoji', 'clean']
          ],
          handlers: {
            emoji() {
              const emoji = pickProjectEditorEmoji();
              if (!emoji) return;
              const selection = this.quill.getSelection(true) || { index: this.quill.getLength(), length: 0 };
              this.quill.insertText(selection.index, emoji, 'user');
              this.quill.setSelection(selection.index + emoji.length, 0, 'user');
            }
          }
        },
        history: {
          delay: 600,
          maxStack: 100,
          userOnly: true
        }
      };
      if (quillCtor.imports?.['modules/imageResize']) {
        modules.imageResize = {
          modules: ['Resize', 'DisplaySize', 'Toolbar']
        };
      }
      const quill = new window.Quill(host, {
        theme: 'snow',
        modules
      });
      const emojiButton = host.parentElement?.querySelector('.ql-emoji');
      if (emojiButton) {
        emojiButton.setAttribute('aria-label', 'Inserer un emoji');
        emojiButton.setAttribute('title', 'Inserer un emoji');
      }
      projectDescriptionQuillEditors.set(editorId, quill);
      return quill;
    }

    function initProjectDescriptionEditors() {
      ['project-description-editor', 'edit-project-description-editor', 'task-description-editor', 'global-feed-editor'].forEach((editorId) => {
        const quill = ensureProjectDescriptionQuillEditor(editorId);
        const fallbackToolbar = document.querySelector(`.project-editor-toolbar-fallback [data-editor-target="${editorId}"]`)?.closest('.project-editor-toolbar-fallback');
        if (fallbackToolbar) {
          fallbackToolbar.classList.toggle('is-hidden-by-quill', Boolean(quill));
        }
      });
      document.querySelectorAll('.project-editor-btn[data-editor-action]').forEach((btn) => {
        if (btn.dataset.boundEditorAction === '1') return;
        btn.dataset.boundEditorAction = '1';
        btn.addEventListener('click', () => {
          const editorId = btn.getAttribute('data-editor-target');
          const action = btn.getAttribute('data-editor-action');
          const inputId = btn.getAttribute('data-editor-file-input') || '';
          if (!editorId || !action) return;
          const editor = document.getElementById(editorId);
          if (!btn.id) btn.id = `project-editor-btn-${uuidv4()}`;
          applyProjectDescriptionEditorAction(action, editor, inputId, btn);
        });
      });

      const imageBindings = [
        { editorId: 'project-description-editor', inputId: 'project-description-image-input' },
        { editorId: 'edit-project-description-editor', inputId: 'edit-project-description-image-input' },
        { editorId: 'task-description-editor', inputId: 'task-description-image-input' },
        { editorId: 'global-feed-editor', inputId: 'global-feed-image-input' }
      ];
      imageBindings.forEach(({ editorId, inputId }) => {
        const editor = document.getElementById(editorId);
        const hasQuill = Boolean(projectDescriptionQuillEditors.get(editorId));
        if (editor && !hasQuill && editor.dataset.boundDescriptionImageSelection !== '1') {
          editor.dataset.boundDescriptionImageSelection = '1';
          ensureProjectEditorImageOverlay(editor);
          editor.addEventListener('click', (event) => {
            const target = event.target instanceof Element ? event.target : null;
            const image = target?.closest('img');
            if (image && editor.contains(image)) {
              setProjectEditorImageSelection(editor, image, { openPanel: false });
              return;
            }
            if (activeProjectEditorImage && editor.contains(activeProjectEditorImage)) {
              clearProjectEditorImageSelection();
            }
          });
          editor.addEventListener('mouseup', () => {
            const selectedImage = findSelectedImageWithinEditor(editor);
            if (selectedImage) {
              setProjectEditorImageSelection(editor, selectedImage, { openPanel: false });
            }
          });
          editor.addEventListener('keyup', () => {
            const selectedImage = findSelectedImageWithinEditor(editor);
            if (selectedImage) {
              setProjectEditorImageSelection(editor, selectedImage, { openPanel: false });
            }
          });
          editor.addEventListener('scroll', () => {
            if (activeProjectEditorImage && editor.contains(activeProjectEditorImage)) {
              updateProjectEditorImageOverlayPosition(editor);
            }
          });
          editor.addEventListener('input', () => {
            if (activeProjectEditorImage && !editor.contains(activeProjectEditorImage)) {
              clearProjectEditorImageSelection();
              return;
            }
            if (activeProjectEditorImage && editor.contains(activeProjectEditorImage)) {
              updateProjectEditorImageOverlayPosition(editor);
            }
          });
        } else if (editor && hasQuill) {
          clearProjectEditorImageSelection();
          removeProjectEditorImageOverlay(editor);
        }
        const input = document.getElementById(inputId);
        if (!input || input.dataset.boundDescriptionImage === '1') return;
        input.dataset.boundDescriptionImage = '1';
        input.addEventListener('change', async () => {
          const editor = document.getElementById(editorId);
          if (!editor) return;
          await handleProjectEditorImageInsert(editor, inputId);
        });
      });
    }

    function ensureProjectEditorEmojiPanel() {
      let panel = document.getElementById('project-editor-emoji-panel');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'project-editor-emoji-panel';
        panel.className = 'emoji-picker-panel project-editor-emoji-panel hidden';
        panel.setAttribute('aria-label', "Sélecteur d'émojis");
        document.body.appendChild(panel);
      }
      if (panel.dataset.ready !== '1') {
        panel.innerHTML = extendedEmojiPalette
          .map((emoji) => `<button type="button" class="emoji-picker-btn" data-emoji="${emoji}" aria-label="Insérer ${emoji}">${emoji}</button>`)
          .join('');
        panel.dataset.ready = '1';
      }
      return panel;
    }

    function toggleProjectEditorEmojiPicker(editor, triggerEl, forceOpen = null) {
      const panel = ensureProjectEditorEmojiPanel();
      const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !projectEditorEmojiPickerOpen;
      if (!shouldOpen || !editor || !triggerEl) {
        projectEditorEmojiPickerOpen = false;
        projectEditorEmojiTarget = '';
        projectEditorEmojiAnchorId = '';
        panel.classList.add('hidden');
        return;
      }
      if (!triggerEl.id) triggerEl.id = `project-editor-btn-${uuidv4()}`;
      projectEditorEmojiPickerOpen = true;
      projectEditorEmojiTarget = editor.id || '';
      projectEditorEmojiAnchorId = triggerEl.id || '';
      const rect = triggerEl.getBoundingClientRect();
      panel.style.position = 'fixed';
      panel.style.left = `${Math.max(12, Math.min(window.innerWidth - 320, rect.left))}px`;
      panel.style.top = `${Math.min(window.innerHeight - 220, rect.bottom + 8)}px`;
      panel.classList.remove('hidden');
    }

    const applyProjectDescriptionEditorActionBase = applyProjectDescriptionEditorAction;
    applyProjectDescriptionEditorAction = function applyProjectDescriptionEditorActionEnhanced(action, editor, fileInputId = '', triggerEl = null) {
      if (action === 'emoji') {
        toggleProjectEditorEmojiPicker(editor, triggerEl || document.activeElement || null);
        return;
      }
      applyProjectDescriptionEditorActionBase(action, editor, fileInputId);
    };


