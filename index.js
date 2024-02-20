const onlinediv = document.getElementsByClassName('onlinediv');
const offlinediv = document.getElementsByClassName('offlinediv');
const thumbnaildiv = document.getElementsByClassName('onlinebanner');
const titlediv = document.getElementsByClassName('streamname');
const viewersdiv = document.getElementsByClassName('infoviewer');
const gamediv = document.getElementsByClassName('infogame');

let popupPort;

function handleBackgroundMessage(message) {
  if(message.stream){
    if (message.isLive !== undefined) {
      console.log(message);
      if (message.isLive) {
        offlinediv[0].style.display = 'none';
        onlinediv[0].style.display = 'block';
        thumbnaildiv[0].src = "https://static-cdn.jtvnw.net/previews-ttv/live_user_shinystaar_-1920x1080.jpg";
        titlediv[0].innerHTML = message.streamInfo.title;
        viewersdiv[0].innerHTML = message.streamInfo.viewer_count;
        gamediv[0].innerHTML = message.streamInfo.game_name;
      } else {
        offlinediv[0].style.display = 'block';
        onlinediv[0].style.display = 'none';
      }
    }
  }
}

function connectToBackground() {
  popupPort = chrome.runtime.connect({ name: 'popup' });
  popupPort.onMessage.addListener(handleBackgroundMessage);

  popupPort.postMessage({ action: 'getStreamStatus' });
}

connectToBackground();

window.addEventListener('DOMContentLoaded', connectToBackground);

window.addEventListener('beforeunload', () => {
  popupPort.disconnect();
});