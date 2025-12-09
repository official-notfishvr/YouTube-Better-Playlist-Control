function parseDuration(timeStr) {
    if (!timeStr) return 0;
    const cleanStr = timeStr.replace(/[^\d:]/g, '');
    const parts = cleanStr.split(':').map(Number);
    let seconds = 0;
    if (parts.length === 3) {
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        seconds = parts[0] * 60 + parts[1];
    } else {
        seconds = parts[0];
    }
    return seconds;
}

function formatDuration(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
}

const ICONS = {
    clock: '<svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>',
    filter: '<svg viewBox="0 0 24 24"><path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/></svg>',
    sort: '<svg viewBox="0 0 24 24"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg>',
    delete: '<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>',
    top: '<svg viewBox="0 0 24 24"><path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8zM4 4h16v2H4z"/></svg>',
    bottom: '<svg viewBox="0 0 24 24"><path d="M4 12l1.41-1.41L11 16.17V4h2v12.17l5.58-5.59L20 12l-8 8-8-8zM4 20h16v-2H4z"/></svg>',
    save: '<svg viewBox="0 0 24 24"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>',
    search: '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>',
    selectAll: '<svg viewBox="0 0 24 24"><path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/></svg>',
    duplicate: '<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>',
    load: '<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>'
};

function injectScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.onload = function () {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
}

function IsOwner() {
    const item = document.querySelector('ytd-playlist-panel-video-renderer');
    return item && item.hasAttribute('can-reorder');
}

function getVideoId(item) {
    const anchor = item.querySelector('a#wc-endpoint');
    if (anchor && anchor.href) {
        try {
            const url = new URL(anchor.href, window.location.origin);
            return url.searchParams.get('v');
        } catch (e) { return null; }
    }
    return null;
}

const pendingMoves = [];

function queueMove(item, afterItem) {
    if (IsOwner()) {
        const vid = getVideoId(item);
        const afterVid = afterItem ? getVideoId(afterItem) : null;
        if (vid) {
            const existingIdx = pendingMoves.findIndex(m => m.videoId === vid);
            if (existingIdx > -1) {
                pendingMoves.splice(existingIdx, 1);
            }
            pendingMoves.push({ videoId: vid, afterVideoId: afterVid });
            const panel = item.closest('ytd-playlist-panel-renderer');
            if (panel) updateBulkToolbar(panel);
        }
    }
}

function syncMove(item, afterItem) {
    queueMove(item, afterItem);
}

function syncRemove(item) {
    const uid = Date.now().toString(36) + Math.random().toString(36).substr(2);
    item.dataset.bypUid = uid;

    if (IsOwner()) {
        window.postMessage({
            type: 'BYP_REMOVE',
            uid: uid
        }, '*');
    }

    item.classList.add('byp-removing');
    setTimeout(() => item.remove(), 2000);
}

async function processSave() {
    const btn = document.querySelector('.byp-save-btn');
    if (!btn || pendingMoves.length === 0) return;

    btn.innerHTML = '<span>Saving...</span>';
    btn.classList.add('byp-loading');
    btn.disabled = true;

    for (const move of pendingMoves) {
        window.postMessage({
            type: 'BYP_MOVE',
            videoId: move.videoId,
            afterVideoId: move.afterVideoId
        }, '*');
        await new Promise(r => setTimeout(r, 400));
    }

    pendingMoves.length = 0;
    btn.disabled = false;

    const panel = document.querySelector('ytd-playlist-panel-renderer');
    if (panel) updateBulkToolbar(panel);
}

function calculateDuration(container, items) {
    if (!items) {
        items = container.querySelectorAll('ytd-playlist-panel-video-renderer:not(.byp-hidden):not(.byp-removing)');
    }
    let totalSeconds = 0;

    items.forEach(item => {
        const timeSpan = item.querySelector('ytd-thumbnail-overlay-time-status-renderer span#text');
        if (timeSpan) {
            totalSeconds += parseDuration(timeSpan.textContent);
        }
    });

    return formatDuration(totalSeconds);
}

function toggleWatched(container, showAll) {
    const items = container.querySelectorAll('ytd-playlist-panel-video-renderer');
    let hiddenCount = 0;
    items.forEach(item => {
        if (showAll) {
            item.classList.remove('byp-hidden');
        } else {
            const progress = item.querySelector('#progress');
            if (progress) {
                const width = progress.style.width;
                if (width && parseInt(width) > 90) {
                    item.classList.add('byp-hidden');
                    hiddenCount++;
                }
            }
        }
    });
    return hiddenCount;
}

function reverseOrder(container) {
    const list = container.querySelector('#items');
    if (list) {
        const children = Array.from(list.children);
        children.forEach(child => child.remove());
        children.reverse().forEach(child => list.appendChild(child));
        enableSelection(container);
        enableDragAndDrop(container);
    }
}

const selectedItems = new Set();
let bulkToolbar = null;
let isConfirmingDelete = false;
let deleteConfirmTimer = null;

function updateBulkToolbar(panel) {
    const existing = document.querySelector('.byp-bulk-actions');

    if (selectedItems.size === 0 && pendingMoves.length === 0) {
        if (existing) existing.remove();
        bulkToolbar = null;
        return;
    }

    if (!existing) {
        bulkToolbar = document.createElement('div');
        bulkToolbar.className = 'byp-bulk-actions';
        document.body.appendChild(bulkToolbar);
    } else {
        bulkToolbar = existing;
    }

    bulkToolbar.innerHTML = '';

    if (selectedItems.size > 0) {
        const selectedArr = Array.from(selectedItems);
        const selectedDuration = calculateDuration(panel, selectedArr);

        const countSpan = document.createElement('span');
        countSpan.className = 'byp-bulk-count';
        countSpan.innerHTML = `${selectedItems.size} Selected <span style="opacity:0.7; font-weight:400; margin-left:4px;">(${selectedDuration})</span>`;
        bulkToolbar.appendChild(countSpan);

        const delBtnText = isConfirmingDelete ? 'Are you sure?' : 'Delete';
        const delBtn = createButton(delBtnText, ICONS.delete, () => {
            if (!isConfirmingDelete) {
                isConfirmingDelete = true;
                if (deleteConfirmTimer) clearTimeout(deleteConfirmTimer);
                updateBulkToolbar(panel);
                deleteConfirmTimer = setTimeout(() => {
                    if (isConfirmingDelete) {
                        isConfirmingDelete = false;
                        updateBulkToolbar(panel);
                    }
                }, 3000);
                return;
            }

            isConfirmingDelete = false;
            if (deleteConfirmTimer) clearTimeout(deleteConfirmTimer);
            selectedItems.forEach(item => {
                syncRemove(item);
                toggleSelection(item, false);
            });
            updateBulkToolbar(panel);
            const dur = panel.querySelector('.byp-duration');
            if (dur) {
                const time = calculateDuration(panel);
                dur.innerHTML = ICONS.clock + `<span>${time}</span>`;
            }
        }, isConfirmingDelete ? 'Click again to confirm deletion' : 'Remove selected videos from playlist');

        if (isConfirmingDelete) {
            delBtn.classList.add('byp-btn-danger');
        }

        bulkToolbar.appendChild(delBtn);

        const moveTopBtn = createButton('Top', ICONS.top, () => {
            const list = panel.querySelector('#items');
            if (list) {
                const sorted = Array.from(selectedItems).sort((a, b) => Array.from(list.children).indexOf(a) - Array.from(list.children).indexOf(b));
                sorted.reverse().forEach(item => {
                    list.prepend(item);
                    syncMove(item, null);
                });
                updateBulkToolbar(panel);
            }
        }, 'Move selected to top');
        bulkToolbar.appendChild(moveTopBtn);

        const moveUpBtn = createButton(null, ICONS.up, () => {
            const list = panel.querySelector('#items');
            if (list) {
                const sorted = Array.from(selectedItems).sort((a, b) => Array.from(list.children).indexOf(a) - Array.from(list.children).indexOf(b));
                sorted.forEach(item => {
                    const prev = item.previousElementSibling;
                    if (prev) {
                        list.insertBefore(item, prev);
                        syncMove(item, item.previousElementSibling);
                    }
                });
                updateBulkToolbar(panel);
            }
        }, 'Move up');
        bulkToolbar.appendChild(moveUpBtn);

        const moveDownBtn = createButton(null, ICONS.down, () => {
            const list = panel.querySelector('#items');
            if (list) {
                const sorted = Array.from(selectedItems).sort((a, b) => Array.from(list.children).indexOf(b) - Array.from(list.children).indexOf(a));
                sorted.forEach(item => {
                    const next = item.nextElementSibling;
                    if (next) {
                        list.insertBefore(item, next.nextSibling);
                        syncMove(item, item.previousElementSibling);
                    }
                });
                updateBulkToolbar(panel);
            }
        }, 'Move down');
        bulkToolbar.appendChild(moveDownBtn);

        const moveBottomBtn = createButton('Bottom', ICONS.bottom, () => {
            const list = panel.querySelector('#items');
            if (list) {
                const sorted = Array.from(selectedItems).sort((a, b) => Array.from(list.children).indexOf(a) - Array.from(list.children).indexOf(b));
                sorted.forEach(item => {
                    list.appendChild(item);
                    syncMove(item, item.previousElementSibling);
                });
                updateBulkToolbar(panel);
            }
        }, 'Move selected to bottom');
        bulkToolbar.appendChild(moveBottomBtn);

        const clearBtn = createButton(null, ICONS.close, () => {
            isConfirmingDelete = false;
            if (deleteConfirmTimer) clearTimeout(deleteConfirmTimer);
            selectedItems.forEach(item => toggleSelection(item, false));
            updateBulkToolbar(panel);
        }, 'Clear selection');
        bulkToolbar.appendChild(clearBtn);
    }

    if (pendingMoves.length > 0) {
        if (selectedItems.size > 0) {
            const sep = document.createElement('div');
            sep.className = 'sep';
            bulkToolbar.appendChild(sep);
        }

        const saveBtn = createButton(`Save Order (${pendingMoves.length})`, ICONS.save, () => processSave(), 'Save changes to YouTube');
        saveBtn.classList.add('byp-save-btn');
        bulkToolbar.appendChild(saveBtn);
    }

    bulkToolbar.style.display = 'flex';
}

function toggleSelection(item, forceState) {
    const isSelected = forceState !== undefined ? forceState : !selectedItems.has(item);

    if (isSelected) {
        selectedItems.add(item);
        item.classList.add('byp-selected');
    } else {
        selectedItems.delete(item);
        item.classList.remove('byp-selected');
    }
}

function enableSelection(container) {
    const items = container.querySelectorAll('ytd-playlist-panel-video-renderer');
    items.forEach(item => {
        if (!item.querySelector('.byp-check-container')) {
            const checkContainer = document.createElement('div');
            checkContainer.className = 'byp-check-container';
            checkContainer.innerHTML = '<div class="byp-checkbox"></div>';

            checkContainer.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                toggleSelection(item);
                updateBulkToolbar(container);
            };

            item.insertBefore(checkContainer, item.firstChild);
        }
    });
}

let dragSrcEl = null;

function handleDragStart(e) {
    const handle = e.target.closest('#reorder, #index-container');
    if (!handle) {
        e.preventDefault();
        return;
    }
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    this.classList.add('byp-dragging');
}

let lastDragOver = 0;
function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';

    const now = Date.now();
    if (now - lastDragOver < 16) return false;
    lastDragOver = now;

    const rect = this.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const height = rect.height;

    const isTop = relY <= height / 2;

    if (isTop) {
        if (!this.classList.contains('byp-drag-over-top')) {
            this.classList.remove('byp-drag-over-bottom');
            this.classList.add('byp-drag-over-top');
        }
    } else {
        if (!this.classList.contains('byp-drag-over-bottom')) {
            this.classList.remove('byp-drag-over-top');
            this.classList.add('byp-drag-over-bottom');
        }
    }
    return false;
}

function handleDragLeave(e) {
    this.classList.remove('byp-drag-over-top', 'byp-drag-over-bottom');
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    if (dragSrcEl !== this && dragSrcEl) {
        if (this.classList.contains('byp-drag-over-top')) {
            this.parentNode.insertBefore(dragSrcEl, this);
        } else {
            this.parentNode.insertBefore(dragSrcEl, this.nextSibling);
        }

        syncMove(dragSrcEl, dragSrcEl.previousElementSibling);
    }

    const items = document.querySelectorAll('ytd-playlist-panel-video-renderer');
    items.forEach(item => item.classList.remove('byp-drag-over-top', 'byp-drag-over-bottom', 'byp-dragging'));

    return false;
}

function handleDragEnd(e) {
    this.classList.remove('byp-dragging');
    const items = document.querySelectorAll('ytd-playlist-panel-video-renderer');
    items.forEach(item => item.classList.remove('byp-drag-over-top', 'byp-drag-over-bottom'));
}

function enableDragAndDrop(container) {
    const items = container.querySelectorAll('ytd-playlist-panel-video-renderer:not(.byp-draggable)');
    items.forEach(item => {
        item.setAttribute('draggable', 'true');
        item.classList.add('byp-draggable');
        item.addEventListener('dragstart', handleDragStart, false);
        item.addEventListener('dragover', handleDragOver, false);
        item.addEventListener('dragleave', handleDragLeave, false);
        item.addEventListener('drop', handleDrop, false);
        item.addEventListener('dragend', handleDragEnd, false);
    });
}

function createButton(text, iconHtml, onClick, title) {
    const btn = document.createElement('button');
    btn.innerHTML = (iconHtml || '') + (text ? `<span>${text}</span>` : '');
    btn.className = 'byp-button';
    if (title || text) {
        btn.title = title || text;
    }
    btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick(btn);
    };
    return btn;
}

function injectControls(panel) {
    if (panel.querySelector('.byp-controls')) return;

    const target = panel.querySelector('#publisher-container');
    const injectionPoint = target ? target.parentElement : panel.querySelector('.header');

    if (injectionPoint) {
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'byp-controls';

        const durSpan = document.createElement('span');
        durSpan.className = 'byp-duration';
        durSpan.innerHTML = ICONS.clock + "<span>...</span>";

        const updateDuration = () => {
            const time = calculateDuration(panel);
            durSpan.innerHTML = ICONS.clock + `<span>${time}</span>`;
        };
        setTimeout(updateDuration, 1000);
        setInterval(updateDuration, 5000);

        let isFiltered = false;

        const reverseBtn = createButton('Reverse', ICONS.sort, () => {
            reverseOrder(panel);
            updateDuration();
        }, 'Reverse playlist order');

        const filterBtn = createButton('Filter', ICONS.filter, () => {
            isFiltered = !isFiltered;
            if (isFiltered) {
                const count = toggleWatched(panel, false);
                filterBtn.innerHTML = ICONS.filter + `<span>Show All</span>`;
                filterBtn.title = "Show all videos";
            } else {
                toggleWatched(panel, true);
                filterBtn.innerHTML = ICONS.filter + `<span>Filter Watched</span>`;
                filterBtn.title = "Hide watched videos";
            }
            updateDuration();
        }, 'Hide watched videos');

        controlsDiv.appendChild(durSpan);
        controlsDiv.appendChild(filterBtn);
        controlsDiv.appendChild(reverseBtn);

        if (target) {
            target.parentElement.insertBefore(controlsDiv, target.nextSibling);
        } else {
            injectionPoint.appendChild(controlsDiv);
        }

        const searchContainer = document.createElement('div');
        searchContainer.className = 'byp-search-container';
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'byp-search-input';
        searchInput.placeholder = 'Search playlist...';

        const searchIcon = document.createElement('div');
        searchIcon.innerHTML = ICONS.search.replace('viewBox', 'class="byp-search-icon" viewBox');

        searchContainer.appendChild(searchIcon);
        searchContainer.appendChild(searchInput);

        searchContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
        });

        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            e.stopPropagation();
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const query = e.target.value.toLowerCase();
                const items = panel.querySelectorAll('ytd-playlist-panel-video-renderer');
                let visibleCount = 0;
                items.forEach(item => {
                    const titleEl = item.querySelector('#video-title');
                    if (titleEl) {
                        const title = titleEl.textContent.trim().toLowerCase();
                        if (query === '' || title.includes(query)) {
                            item.classList.remove('byp-hidden');
                            visibleCount++;
                        } else {
                            item.classList.add('byp-hidden');
                        }
                    }
                });
                updateDuration();
            }, 300);
        });

        controlsDiv.parentNode.insertBefore(searchContainer, controlsDiv);

        const selectAllBtn = createButton(null, ICONS.selectAll, () => {
            const visibleItems = panel.querySelectorAll('ytd-playlist-panel-video-renderer:not(.byp-hidden):not(.byp-removing)');
            const allSelected = Array.from(visibleItems).every(i => selectedItems.has(i));

            visibleItems.forEach(item => toggleSelection(item, !allSelected));
            updateBulkToolbar(panel);
        }, 'Select All');
        controlsDiv.appendChild(selectAllBtn);

        enableDragAndDrop(panel);
        enableSelection(panel);
    }
}

let timeout;
function init() {
    injectScript();

    const observer = new MutationObserver((mutations) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            const panel = document.querySelector('ytd-playlist-panel-renderer');
            if (panel) {
                injectControls(panel);
                enableDragAndDrop(panel);
                enableSelection(panel);
            }
        }, 300);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const panel = document.querySelector('ytd-playlist-panel-renderer');
    if (panel) {
        injectControls(panel);
        enableDragAndDrop(panel);
        enableSelection(panel);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}