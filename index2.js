const thumbnaildiv = document.getElementsByClassName('video-banner');
const titlediv = document.getElementsByClassName('videoname');
const link = document.getElementsByClassName('videolink');

let popupPort;

function handleBackgroundMessage(message) {
  if(message.popupMessage) return;
  if(!message.stream){
        thumbnaildiv[0].src = message.video.snippet.thumbnails.high.url;
        titlediv[0].innerHTML = message.video.snippet.title;
        link[0].href = `https://youtube.com/watch?v=${message.video.id.videoId}`;
  }
}

function connectToBackground() {
  popupPort = chrome.runtime.connect({ name: 'popup' });
  popupPort.onMessage.addListener(handleBackgroundMessage);

  popupPort.postMessage({ action: 'checkNewVideo' });
}

connectToBackground();

window.addEventListener('DOMContentLoaded', connectToBackground);

window.addEventListener('beforeunload', () => {
  popupPort.disconnect();
});