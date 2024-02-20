const youtubeChannelId = 'UCK83g4hM3uP19k-1e9TsTZw';

const youtubeapiKey = 'AIzaSyDJWyNoFtBCz4_RkPkR1pYiOLC0mPKcgvo';

const youtubeapiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${youtubeChannelId}&maxResults=1&order=date&type=video&key=${youtubeapiKey}`;

let popupPort;
let isLiveFound = false;

chrome.notifications.onClicked.addListener(function (notificationId) {
  if (notificationId === 'live') {
    chrome.tabs.create({ url: 'https://www.twitch.tv/shinystaar_' });
  }else if (notificationId === 'newVideo') {
    chrome.tabs.create({ url: `https://www.youtube.com/watch?v=${lastVideoId}` });
  }
});

async function getStoredVideoId() {
  return new Promise((resolve) => {
      chrome.storage.local.get('videoId', (result) => {
          resolve(result || null);
      });
  });
}

async function setStoredVideoId(videoId) {
  return new Promise((resolve) => {
      chrome.storage.local.set({ videoId }, () => {
          resolve();
      });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ isLiveFound: false });
});

chrome.runtime.onConnect.addListener((port) => {
  popupPort = port;

  port.onDisconnect.addListener(() => {
    popupPort = null;
  });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.onClicked.addListener(() => {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: checkStreamStatus()
    });
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: checkNewVideo()
    });
  });

  chrome.alarms.create('checkStreamStatus', { periodInMinutes: 0.5, delayInMinutes: 1 });
  chrome.alarms.create('checkNewVideo', { periodInMinutes: 2, delayInMinutes: 3 });
});
chrome.runtime.onConnect.addListener((port) => {
  popupPort = port;

  port.onMessage.addListener((msg) => {
    if (msg.action === 'getStreamStatus') {
      checkStreamStatus();
    } if (msg.action === 'checkNewVideo') {
      checkNewVideo();
    }
  });

  port.onDisconnect.addListener(() => {
    popupPort = null;
  });
});
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkStreamStatus') {
    await checkStreamStatus();
  }else if (alarm.name === 'checkNewVideo') {
    checkNewVideo();
  }
});

async function checkNewVideo() {
    try {
        const response = await fetch(youtubeapiUrl);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        if (popupPort) {
            const data = await response.json();
            const video = data.items[0];
            const storedStreamId = await getStoredVideoId();
            popupPort.postMessage({ stream: false, video });

            if (video.id.videoId !== storedStreamId) {
                await setStoredVideoId(video.id.videoId);
                chrome.notifications.create('newVideo', {
                    type: 'basic',
                    iconUrl: 'images/logos/staar128.png',
                    title: 'StaaR a publié une nouvelle vidéo !',
                    message: `${video.snippet.title}`,
                });
            }
        }
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            // Si vous obtenez une erreur de type "Failed to fetch", c'est peut-être dû à la limite de quota.
            console.error('Failed to fetch. Possible quota limit reached.');
        } else {
            console.error('Error checking new video:', error.message || error);
        }
    }
}

async function getUserInfo(accessToken, userId) {
  try {
    const response = await fetch(`https://api.twitch.tv/helix/users?id=${userId}`, {
      method: 'GET',
      headers: {
        'Client-ID': 't7sfbjbofz7a5dywsdqwabdg4mxgfb',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data.data[0];
  } catch (error) {
    console.error('Error fetching user info:', error);
    throw error;
  }
}

async function getProfileImage(accessToken, userId) {
  try {
    const userInfo = await getUserInfo(accessToken, userId);
    if (userInfo) {
      return userInfo.profile_image_url;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting profile image:', error);
    throw error;
  }
}

async function checkStreamStatus() {
    try {
        const accessToken = await getAccessToken();
        const streamerId = await getTwitchStreamerId('shinystaar_', accessToken);
        const streamInfo = await getStreamInfo(accessToken, streamerId);
        const profileImage = await getProfileImage(accessToken, streamerId)

        if (streamInfo && popupPort) {
            const storedStreamId = await getStoredStreamId();
            popupPort.postMessage({ stream: true, isLive: true, streamInfo });
            updatePopupUI(streamInfo);
            
            if (storedStreamId !== streamInfo.id) {
                isLiveFound = true;
                await setStoredStreamId(streamInfo.id);
                chrome.notifications.create('live', {
                    type: 'basic',
                    iconUrl: `${profileImage}`,
                    title: 'StaaR est en live',
                    message: `${streamInfo.title} ( ${streamInfo.game_name} )`,
                });
            } else {
                if (!isLiveFound) {
                    isLiveFound = true;
                    chrome.notifications.create('live', {
                        type: 'basic',
                        iconUrl: `${profileImage}`,
                        title: 'StaaR est en live',
                        message: `${streamInfo.title} ( ${streamInfo.game_name} )`,
                    });
                }
            }
        } else {
            if (popupPort) {
                popupPort.postMessage({ stream: true, isLive: false });
                updatePopupUI(null);
            }
        }
    } catch (error) {
        console.error('Une erreur est survenue lors de la vérification du statut du flux:', error.message);
        if (popupPort) {
            popupPort.postMessage({ error: error.message });
            updatePopupUI(null);
        }
    }
}

function updatePopupUI(streamInfo) {
    const popupMessage = streamInfo ? `StaaR est en live (${streamInfo.title})` : `StaaR n'est pas en live`;

    if (popupPort) {
        popupPort.postMessage({ popupMessage });
    }
}

async function getStoredStreamId() {
    return new Promise((resolve) => {
        chrome.storage.local.get('streamId', (result) => {
            resolve(result.streamId || null);
        });
    });
}

async function setStoredStreamId(streamId) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ streamId }, () => {
            resolve();
        });
    });
}

async function getAccessToken() {
  const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
          client_id: 't7sfbjbofz7a5dywsdqwabdg4mxgfb',
          client_secret: '1x78u7xsmtsb2zljla03c1n4ldvn1s',
          grant_type: 'client_credentials'
      })
  });

  const data = await response.json();
  return data.access_token;
}

async function getStreamInfo(accessToken, userId) {
  const response = await fetch(`https://api.twitch.tv/helix/streams?user_id=${userId}`, {
      headers: {
          'Client-ID': 't7sfbjbofz7a5dywsdqwabdg4mxgfb',
          'Authorization': `Bearer ${accessToken}`
      }
  });

  const data = await response.json();
  return data.data[0];
}

async function getTwitchStreamerId(username, accessToken) {
  try {
      const clientId = 't7sfbjbofz7a5dywsdqwabdg4mxgfb';
      const twitchApiUrl = `https://api.twitch.tv/helix/users?login=${username}`;

      const response = await fetch(twitchApiUrl, {
          headers: {
              'Client-ID': clientId,
              'Authorization': `Bearer ${accessToken}`
          }
      });

      const data = await response.json();
      const user = data.data[0];
      return user ? user.id : null;
  } catch (error) {
      console.error('Erreur lors de la récupération de l\'ID du streamer:', error.message);
      throw error;
  }
}