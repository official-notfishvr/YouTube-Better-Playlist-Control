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
    save: '<svg viewBox="0 0 24 24"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>'
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
    if (IsOwner()) {
        const vid = getVideoId(item);
        if (vid) {
            window.postMessage({
                type: 'BYP_REMOVE',
                videoId: vid
            }, '*');
        }
    }
    item.remove();
}

async function processSave() {
    const btn = document.querySelector('.byp-save-btn');
    if (!btn || pendingMoves.length === 0) return;

    btn.innerHTML = '<span>Saving...</span>';
    btn.style.opacity = '0.7';
    btn.style.pointerEvents = 'none';

    for (const move of pendingMoves) {
        window.postMessage({
            type: 'BYP_MOVE',
            videoId: move.videoId,
            afterVideoId: move.afterVideoId
        }, '*');
        await new Promise(r => setTimeout(r, 400));
    }

    pendingMoves.length = 0;

    const panel = document.querySelector('ytd-playlist-panel-renderer');
    if (panel) updateBulkToolbar(panel);
}

function calculateDuration(container) {
    const items = container.querySelectorAll('ytd-playlist-panel-video-renderer:not(.byp-hidden)');
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
        const countSpan = document.createElement('span');
        countSpan.className = 'byp-bulk-count';
        countSpan.textContent = `${selectedItems.size} Selected`;
        bulkToolbar.appendChild(countSpan);

        const delBtn = createButton('Delete', ICONS.delete, () => {
            selectedItems.forEach(item => {
                syncRemove(item);
                toggleSelection(item, false);
            });
            updateBulkToolbar(panel);
            const dur = panel.querySelector('.byp-duration');
            if (dur) dur.click();
        });
        bulkToolbar.appendChild(delBtn);

        const moveTopBtn = createButton('Top', ICONS.top, () => {
            const list = panel.querySelector('#items');
            if (list) {
                const sorted = Array.from(selectedItems).sort((a, b) => Array.from(list.children).indexOf(a) - Array.from(list.children).indexOf(b));
                sorted.reverse().forEach(item => {
                    list.prepend(item);
                    syncMove(item, null);
                });
            }
        });
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
            }
        });
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
            }
        });
        bulkToolbar.appendChild(moveDownBtn);

        const moveBottomBtn = createButton('Bottom', ICONS.bottom, () => {
            const list = panel.querySelector('#items');
            if (list) {
                const sorted = Array.from(selectedItems).sort((a, b) => Array.from(list.children).indexOf(a) - Array.from(list.children).indexOf(b));
                sorted.forEach(item => {
                    list.appendChild(item);
                    syncMove(item, item.previousElementSibling);
                });
            }
        });
        bulkToolbar.appendChild(moveBottomBtn);

        const clearBtn = createButton('Cancel', null, () => {
            selectedItems.forEach(item => toggleSelection(item, false));
            updateBulkToolbar(panel);
        });
        bulkToolbar.appendChild(clearBtn);
    }

    if (pendingMoves.length > 0) {
        if (selectedItems.size > 0) {
            const sep = document.createElement('div');
            sep.style.width = '1px';
            sep.style.height = '24px';
            sep.style.background = 'rgba(255,255,255,0.2)';
            sep.style.margin = '0 8px';
            bulkToolbar.appendChild(sep);
        }

        const saveBtn = createButton(`Save Order (${pendingMoves.length})`, ICONS.save, () => processSave());
        saveBtn.classList.add('byp-save-btn');
        saveBtn.style.backgroundColor = '#cc0000';
        saveBtn.style.border = 'none';
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

function createButton(text, iconHtml, onClick) {
    const btn = document.createElement('button');
    btn.innerHTML = (iconHtml || '') + (text ? `<span>${text}</span>` : '');
    btn.className = 'byp-button';
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
        });

        const filterBtn = createButton('Filter', ICONS.filter, () => {
            isFiltered = !isFiltered;
            if (isFiltered) {
                const count = toggleWatched(panel, false);
                filterBtn.innerHTML = ICONS.filter + `<span>Show All</span>`;
            } else {
                toggleWatched(panel, true);
                filterBtn.innerHTML = ICONS.filter + `<span>Filter Watched</span>`;
            }
            updateDuration();
        });

        controlsDiv.appendChild(durSpan);
        controlsDiv.appendChild(filterBtn);
        controlsDiv.appendChild(reverseBtn);

        if (target) {
            target.parentElement.insertBefore(controlsDiv, target.nextSibling);
        } else {
            injectionPoint.appendChild(controlsDiv);
        }

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
