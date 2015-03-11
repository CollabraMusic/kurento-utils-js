/*
 * (C) Copyright 2014-2015 Kurento (http://kurento.org/)
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the GNU Lesser General Public License
 * (LGPL) version 2.1 which accompanies this distribution, and is available at
 * http://www.gnu.org/licenses/lgpl-2.1.html
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 */

var freeice  = require('freeice');
var inherits = require('inherits');

var EventEmitter = require('events').EventEmitter;

var recursive = require('merge').recursive


const MEDIA_CONSTRAINTS =
{
  audio: true,
  video:
  {
    mandatory:
    {
      maxWidth: 640,
      maxFrameRate: 15,
      minFrameRate: 15
    }
  }
}


function noop(error)
{
  if(error) return console.trace(error)
}

function trackStop(track)
{
  track.stop && track.stop()
}

function streamStop(stream)
{
  stream.getTracks().forEach(trackStop)
}


/**
 * Wrapper object of an RTCPeerConnection. This object is aimed to simplify the
 * development of WebRTC-based applications.
 *
 * @constructor module:kurentoUtils.WebRtcPeer
 *
 * @param {String} mode Mode in which the PeerConnection will be configured.
 *  Valid values are: 'recv', 'send', and 'sendRecv'
 * @param localVideo Video tag for the local stream
 * @param remoteVideo Video tag for the remote stream
 * @param {MediaStream} videoStream Stream to be used as primary source
 *  (typically video and audio, or only video if combined with audioStream) for
 *  localVideo and to be added as stream to the RTCPeerConnection
 * @param {MediaStream} audioStream Stream to be used as second source
 *  (typically for audio) for localVideo and to be added as stream to the
 *  RTCPeerConnection
 */
function WebRtcPeer(mode, options, callback)
{
  if(!(this instanceof WebRtcPeer))
    return new WebRtcPeer(mode, options, callback)

  WebRtcPeer.super_.call(this)

  var self = this;


  switch(mode)
  {
    case 'recv': mode = 'recvonly'; break
    case 'send': mode = 'sendonly'; break
  }

  if(options instanceof Function)
  {
    callback = options
    options = undefined
  }

  options = options || {}
  callback = (callback || noop).bind(this)

  var localVideo       = options.localVideo;
  var remoteVideo      = options.remoteVideo;
  var videoStream      = options.videoStream;
  var audioStream      = options.audioStream;
  var mediaConstraints = options.mediaConstraints;

  var connectionConstraints = options.connectionConstraints;
  var pc                    = options.peerConnection
  var sendSource            = options.sendSource || 'webcam'

  var configuration = recursive(
  {
    iceServers: freeice()
  },
  options.configuration);

  var onicecandidate = options.onicecandidate;
  if(onicecandidate) this.on('icecandidate', onicecandidate);

  var oncandidategatheringdone = options.oncandidategatheringdone;
  if(oncandidategatheringdone) this.on('candidategatheringdone', oncandidategatheringdone);


  // Init PeerConnection

  if(!pc) pc = new RTCPeerConnection(configuration);

  Object.defineProperty(this, 'peerConnection', {get: function(){return pc;}});

  var candidategatheringdone = false
  pc.addEventListener('icecandidate', function(event)
  {
    if(event.candidate)
    {
      self.emit('icecandidate', event.candidate);
      candidategatheringdone = false
    }
    else if(!candidategatheringdone)
    {
      self.emit('candidategatheringdone');
      candidategatheringdone = true
    }
  });


  /**
   * Callback function invoked when a SDP answer is received. Developers are
   * expected to invoke this function in order to complete the SDP negotiation.
   *
   * @function module:kurentoUtils.WebRtcPeer.prototype.processSdpAnswer
   *
   * @param sdpAnswer - Description of sdpAnswer
   * @param callback - Called when the remote description has been set
   *  successfully.
   */
  function processSdpAnswer(sdpAnswer, callback)
  {
    callback = (callback || noop).bind(self)

    var answer = new RTCSessionDescription(
    {
      type : 'answer',
      sdp : sdpAnswer,
    });

    console.log('SDP answer received, setting remote description');

    if(pc.signalingState == 'closed')
      return callback('PeerConnection is closed')

    pc.setRemoteDescription(answer, function()
    {
      var stream = pc.getRemoteStreams()[0]

      var url = stream ? URL.createObjectURL(stream) : "";

      if(remoteVideo)
      {
        remoteVideo.src = url;

        console.log('Remote URL:', url)
      }

      callback();
    },
    callback);
  }

  /**
  * This function creates the RTCPeerConnection object taking into account the
  * properties received in the constructor. It starts the SDP negotiation
  * process: generates the SDP offer and invokes the onsdpoffer callback. This
  * callback is expected to send the SDP offer, in order to obtain an SDP
  * answer from another peer.
  */
  function start(constraints)
  {
    if(videoStream && localVideo)
    {
      localVideo.src = URL.createObjectURL(videoStream);
      localVideo.muted = true;
    }

    if(videoStream) pc.addStream(videoStream);
    if(audioStream) pc.addStream(audioStream);

    // [Hack] https://code.google.com/p/chromium/issues/detail?id=443558
    if(mode == 'sendonly') mode = 'sendrecv';

    constraints = recursive(
    {
      mandatory:
      {
        OfferToReceiveAudio: (mode !== 'sendonly'),
        OfferToReceiveVideo: (mode !== 'sendonly')
      },
      optional:
      [
        {DtlsSrtpKeyAgreement: true}
      ]
    }, constraints);

    console.log('constraints: '+JSON.stringify(constraints));


    // Create the offer with the required constraints

    pc.createOffer(function(offer)
    {
      console.log('Created SDP offer');

      pc.setLocalDescription(offer, function()
      {
        console.log('Local description set', offer);

        callback(null, offer.sdp, processSdpAnswer);
      },
      callback);
    },
    callback, constraints);
  }


  if(mode !== 'recvonly' && !videoStream && !audioStream)
  {
    function getMedia(constraints)
    {
      getUserMedia(recursive(MEDIA_CONSTRAINTS, constraints), function(stream)
      {
        videoStream = stream;

        start(connectionConstraints)
      },
      callback);
    }

    if(sendSource && sendSource != 'webcam' && !mediaConstraints)
      getScreenConstraints(sendMode, function(error, constraints)
      {
        if(error) return callback(error)

        getMedia(constraints)
      })

    else
      getMedia(mediaConstraints)
  }
  else
    start(connectionConstraints)


  this.on('_dispose', function()
  {
    if(localVideo)  localVideo.src  = '';
    if(remoteVideo) remoteVideo.src = '';
  })
}
inherits(WebRtcPeer, EventEmitter)


Object.defineProperty(WebRtcPeer.prototype, 'enabled',
{
  enumerable: true,
  get: function()
  {
    return this.audioEnabled && this.videoEnabled;
  },
  set: function(value)
  {
    this.audioEnabled = this.videoEnabled = value
  }
})

function createEnableDescriptor(type)
{
  var method = 'get'+type+'Tracks'

  return {
    enumerable: true,
    get: function()
    {
      // [ToDo] Should return undefined if not all tracks have the same value?

      if(!this.peerConnection) return;

      var streams = this.peerConnection.getLocalStreams();
      if(!streams.length) return;

      for(var i=0,stream; stream=streams[i]; i++)
      {
        var tracks = stream[method]()
        for(var j=0,track; track=tracks[j]; j++)
          if(!track.enabled)
            return false;
      }

      return true;
    },
    set: function(value)
    {
      function trackSetEnable(track)
      {
        track.enabled = value;
      }

      this.peerConnection.getLocalStreams().forEach(function(stream)
      {
        stream[method]().forEach(trackSetEnable)
      })
    }
  }
}

Object.defineProperty(WebRtcPeer.prototype, 'audioEnabled', createEnableDescriptor('Audio'))
Object.defineProperty(WebRtcPeer.prototype, 'videoEnabled', createEnableDescriptor('Video'))


/**
 * Callback function invoked when an ICE candidate is received. Developers are
 * expected to invoke this function in order to complete the SDP negotiation.
 *
 * @function module:kurentoUtils.WebRtcPeer.prototype.addIceCandidate
 *
 * @param iceCandidate - Literal object with the ICE candidate description
 * @param callback - Called when the ICE candidate has been added.
 */
WebRtcPeer.prototype.addIceCandidate = function(iceCandidate, callback)
{
	var candidate = new RTCIceCandidate(iceCandidate);

	console.log('ICE candidate received');

	callback = (callback || noop).bind(this)

	this.peerConnection.addIceCandidate(candidate, callback, callback);
}

WebRtcPeer.prototype.getLocalStream = function(index)
{
  if(this.peerConnection)
    return this.peerConnection.getLocalStreams()[index || 0]
}

WebRtcPeer.prototype.getRemoteStream = function(index)
{
  if(this.peerConnection)
    return this.peerConnection.getRemoteStreams()[index || 0]
}

/**
* @description This method frees the resources used by WebRtcPeer.
*
* @function module:kurentoUtils.WebRtcPeer.prototype.dispose
*/
WebRtcPeer.prototype.dispose = function()
{
  console.log('Disposing WebRtcPeer');

  var pc = this.peerConnection;
  if(pc)
  {
    if(pc.signalingState == 'closed') return

    pc.getLocalStreams().forEach(streamStop)

    // FIXME This is not yet implemented in firefox
    // if(videoStream) pc.removeStream(videoStream);
    // if(audioStream) pc.removeStream(audioStream);

    pc.close();
  }

  this.emit('_dispose');
};


//
// Specialized child classes
//

function WebRtcPeerRecvonly(options, callback)
{
  if(!(this instanceof WebRtcPeerRecvonly))
    return new WebRtcPeerRecvonly(options, callback)

  WebRtcPeerRecvonly.super_.call(this, 'recvonly', options, callback)
}
inherits(WebRtcPeerRecvonly, WebRtcPeer)

function WebRtcPeerSendonly(options, callback)
{
  if(!(this instanceof WebRtcPeerSendonly))
    return new WebRtcPeerSendonly(options, callback)

  WebRtcPeerSendonly.super_.call(this, 'sendonly', options,callback)
}
inherits(WebRtcPeerSendonly, WebRtcPeer)

function WebRtcPeerSendrecv(options, callback)
{
  if(!(this instanceof WebRtcPeerSendrecv))
    return new WebRtcPeerSendrecv(options, callback)

  WebRtcPeerSendrecv.super_.call(this, 'sendrecv', options, callback)
}
inherits(WebRtcPeerSendrecv, WebRtcPeer)


module.exports = WebRtcPeer;

WebRtcPeer.WebRtcPeer         = WebRtcPeer;
WebRtcPeer.WebRtcPeerRecvonly = WebRtcPeerRecvonly;
WebRtcPeer.WebRtcPeerSendonly = WebRtcPeerSendonly;
WebRtcPeer.WebRtcPeerSendrecv = WebRtcPeerSendrecv;
