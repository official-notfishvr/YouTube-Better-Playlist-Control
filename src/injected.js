async function sha1(str) {
    const buffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

async function getAuthHeader() {
    const sapisid = getCookie('SAPISID') || getCookie('__Secure-3PAPISID');
    if (!sapisid) return {};

    const timestamp = Math.floor(Date.now() / 1000);
    const origin = window.location.origin;
    const hash = await sha1(`${timestamp} ${sapisid} ${origin}`);

    return {
        'Authorization': `SAPISIDHASH ${timestamp}_${hash}`,
        'X-Origin': origin,
        'Origin': origin
    };
}

function getClientData() {
    try {
        const cfg = window.ytcfg;
        return {
            apiKey: cfg?.get('INNERTUBE_API_KEY'),
            context: cfg?.get('INNERTUBE_CONTEXT'),
            context: cfg?.get('INNERTUBE_CONTEXT'),
            clientVersion: cfg?.get('INNERTUBE_CONTEXT')?.client?.clientVersion,
            visitorData: cfg?.get('VISITOR_DATA'),
            playlistId: new URLSearchParams(window.location.search).get('list')
        };
    } catch (e) {
        console.error('[BYP] Failed to get ytcfg', e);
        return null;
    }
}

async function moveVideo(triggerVideoId, predecessorVideoId) {
    const data = getClientData();
    if (!data || !data.apiKey || !data.playlistId) return;

    const items = Array.from(document.querySelectorAll('ytd-playlist-panel-video-renderer'));
    const triggerItem = items.find(i => i.data?.videoId === triggerVideoId);
    if (!triggerItem) return;

    const triggerSetInfo = triggerItem.data?.playlistSetVideoId;

    let predecessorSetInfo = null;
    if (predecessorVideoId) {
        const predItem = items.find(i => i.data?.videoId === predecessorVideoId);
        predecessorSetInfo = predItem?.data?.playlistSetVideoId;
    }

    if (!triggerSetInfo) return;

    const payload = {
        context: data.context,
        actions: [
            {
                action: "ACTION_MOVE_VIDEO_AFTER",
                setVideoId: triggerSetInfo,
                movedSetVideoIdPredecessor: predecessorSetInfo
            }
        ],
        playlistId: data.playlistId
    };

    try {
        const authHeaders = await getAuthHeader();
        await fetch(`/youtubei/v1/browse/edit_playlist?key=${data.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders,
                'X-Youtube-Client-Name': '1',
                'X-Youtube-Client-Version': data.clientVersion,
                'X-Goog-AuthUser': window.ytcfg?.get('SESSION_INDEX') || '0'
            },
            body: JSON.stringify(payload)
        });
    } catch (e) {
        console.error('[BYP] Move API Fail', e);
    }
}

async function removeVideo(uid) {
    const data = getClientData();
    if (!data || !data.apiKey || !data.playlistId) return;

    const items = Array.from(document.querySelectorAll('ytd-playlist-panel-video-renderer'));
    const item = items.find(i => i.dataset.bypUid === uid);
    if (!item) {
        console.warn('[BYP] Could not find item to remove via UID', uid);
        return;
    }

    const setVideoId = item.data?.playlistSetVideoId;
    if (!setVideoId) return;

    const payload = {
        context: data.context,
        actions: [
            {
                action: "ACTION_REMOVE_VIDEO",
                setVideoId: setVideoId
            }
        ],
        playlistId: data.playlistId
    };

    try {
        const authHeaders = await getAuthHeader();
        await fetch(`/youtubei/v1/browse/edit_playlist?key=${data.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders,
                'X-Youtube-Client-Name': '1',
                'X-Youtube-Client-Version': data.clientVersion,
                'X-Goog-AuthUser': window.ytcfg?.get('SESSION_INDEX') || '0'
            },
            body: JSON.stringify(payload)
        });
    } catch (e) {
        console.error('[BYP] Remove API Fail', e);
    }
}

window.addEventListener('message', (event) => {
    if (event.data.type === 'BYP_MOVE') {
        moveVideo(event.data.videoId, event.data.afterVideoId);
    } else if (event.data.type === 'BYP_REMOVE') {
        removeVideo(event.data.uid);
    }
});
