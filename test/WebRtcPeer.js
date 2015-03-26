/*
 * (C) Copyright 2015 Kurento (http://kurento.org/)
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
 *
 */

/**
 * {@link WebRtcPeer} test suite.
 *
 * <p>
 * Methods tested:
 * <ul>
 * <li>{@link WebRtcEndpoint#getLocalSessionDescriptor()}
 * </ul>
 * <p>
 * Events tested:
 * <ul>
 * <li>{@link WebRtcEndpoint#addMediaSessionStartListener(MediaEventListener)}
 * <li>
 * {@link HttpEndpoint#addMediaSessionTerminatedListener(MediaEventListener)}
 * </ul>
 *
 *
 * @author Jesús Leganés Combarro "piranna" (piranna@gmail.com)
 * @since 4.2.4
 *
 */

if (typeof QUnit == 'undefined') {
  QUnit = require('qunit-cli');
  QUnit.load();

  kurentoUtils = require('..');

  require('./_common');
};

var WebRtcPeer = kurentoUtils.WebRtcPeer;

var WebRtcPeerRecvonly = WebRtcPeer.WebRtcPeerRecvonly;
var WebRtcPeerSendonly = WebRtcPeer.WebRtcPeerSendonly;
var WebRtcPeerSendrecv = WebRtcPeer.WebRtcPeerSendrecv;

function getOscillatorMedia() {
  var ac = new AudioContext();
  var osc = ac.createOscillator();
  var dest = ac.createMediaStreamDestination();
  osc.connect(dest);

  return dest.stream;
}

QUnit.module('WebRtcPeer');

QUnit.test('WebRtcPeerRecvonly', function (assert) {
  var done = assert.async();

  assert.expect(1);

  var options = {
    configuration: {
      iceServers: []
    }
  }

  WebRtcPeerRecvonly(options, function (error) {
    var self = this

    function onerror(error) {
      self.dispose()

      _onerror(error)
      done()
    }

    if (error) return onerror(error)

    this.generateOffer(function (error, sdpOffer, processAnswer) {
      if (error) return onerror(error)

      var offer = new RTCSessionDescription({
        type: 'offer',
        sdp: sdpOffer
      });

      var peerConnection = new RTCPeerConnection()

      peerConnection.setRemoteDescription(offer, function () {
          var stream = getOscillatorMedia()

          peerConnection.addStream(stream)

          peerConnection.createAnswer(function (answer) {
              peerConnection.setLocalDescription(answer,
                function () {
                  processAnswer(answer.sdp, function (error) {
                    if (error) return onerror(error)

                    var stream = this.getRemoteStream()
                    assert.notEqual(stream, undefined,
                      'remote stream')

                    this.dispose()
                    done()
                  })
                },
                onerror);
            },
            onerror);
        },
        onerror)
    })
  })
});

QUnit.test('WebRtcPeerSendonly', function (assert) {
  var done = assert.async();

  assert.expect(2);

  var options = {
    audioStream: getOscillatorMedia(),
    configuration: {
      iceServers: []
    }
  }

  WebRtcPeerSendonly(options, function (error) {
    var self = this

    function onerror(error) {
      self.dispose()

      _onerror(error)
      done()
    }

    if (error) return onerror(error)

    this.generateOffer(function (error, sdpOffer, processAnswer) {
      if (error) return onerror(error)

      var stream = this.getLocalStream()
      assert.notEqual(stream, undefined, 'local stream')

      var offer = new RTCSessionDescription({
        type: 'offer',
        sdp: sdpOffer
      });

      var peerConnection = new RTCPeerConnection()

      peerConnection.setRemoteDescription(offer, function () {
          var stream = peerConnection.getRemoteStreams()[0]
          assert.notEqual(stream, undefined, 'peer remote stream')

          peerConnection.createAnswer(function (answer) {
              peerConnection.setLocalDescription(answer,
                function () {
                  processAnswer(answer.sdp, function (error) {
                    if (error) return onerror(error)

                    this.dispose()
                    done()
                  })
                },
                onerror);
            },
            onerror);
        },
        onerror)
    })
  })
});

QUnit.test('WebRtcPeerSendrecv', function (assert) {
  var done = assert.async();

  assert.expect(3);

  var options = {
    audioStream: getOscillatorMedia(),
    configuration: {
      iceServers: []
    }
  }

  WebRtcPeerSendrecv(options, function (error) {
    var self = this

    function onerror(error) {
      self.dispose()

      _onerror(error)
      done()
    }

    if (error) return onerror(error)

    this.generateOffer(function (error, sdpOffer, processAnswer) {
      if (error) return onerror(error)

      var stream = this.getLocalStream()
      assert.notEqual(stream, undefined, 'local stream')

      var offer = new RTCSessionDescription({
        type: 'offer',
        sdp: sdpOffer
      });

      var peerConnection = new RTCPeerConnection()

      peerConnection.setRemoteDescription(offer, function () {
          var stream = peerConnection.getRemoteStreams()[0]
          assert.notEqual(stream, undefined, 'peer remote stream')

          var stream = getOscillatorMedia();

          peerConnection.addStream(stream)

          peerConnection.createAnswer(function (answer) {
              peerConnection.setLocalDescription(answer,
                function () {
                  processAnswer(answer.sdp, function (error) {
                    if (error) return onerror(error)

                    var stream = this.getRemoteStream()
                    assert.notEqual(stream, undefined,
                      'remote stream')

                    this.dispose()
                    done()
                  })
                },
                onerror);
            },
            onerror);
        },
        onerror)
    })
  })
});

QUnit.test('processOffer', function (assert) {
  var done = assert.async();

  assert.expect(1);

  WebRtcPeerRecvonly(function (error) {
    var self = this

    function onerror(error) {
      self.dispose()

      _onerror(error)
      done()
    }

    if (error) return onerror(error)

    var peerConnection = new RTCPeerConnection()

    var stream = getOscillatorMedia()
    peerConnection.addStream(stream)

    peerConnection.createOffer(function (offer) {
        peerConnection.setLocalDescription(offer, function () {
            self.processOffer(offer.sdp, function (error, sdpAnswer) {
              if (error) return onerror(error)

              var answer = new RTCSessionDescription({
                type: 'answer',
                sdp: sdpAnswer
              });

              peerConnection.setRemoteDescription(answer,
                function () {
                  var stream = self.getRemoteStream()
                  assert.notEqual(stream, undefined,
                    'remote stream')

                  self.dispose()
                  done()
                },
                onerror)
            })
          },
          onerror);
      },
      onerror);
  })
});

QUnit.test('enabled', function (assert) {
  var done = assert.async();

  assert.expect(4);

  var options = {
    audioStream: getOscillatorMedia(),
    configuration: {
      iceServers: []
    }
  }

  WebRtcPeerSendonly(options, function (error, sdpoffer, processAnswer) {
    var self = this

    function onerror(error) {
      self.dispose()

      _onerror(error)
      done()
    }

    if (error) return onerror(error)

    assert.ok(this.audioEnabled, 'enabled')

    this.enabled = false
    assert.ok(!this.audioEnabled, 'disabled')

    this.enabled = true
    assert.ok(this.audioEnabled, 'enabled again')

    this.audioEnabled = false
    assert.ok(!this.enabled, 'audio disable global')

    this.dispose()
    done()
  })
});

QUnit.test('audioEnabled', function (assert) {
  var done = assert.async();

  assert.expect(3);

  var options = {
    audioStream: getOscillatorMedia(),
    configuration: {
      iceServers: []
    }
  }

  WebRtcPeerSendonly(options, function (error, sdpoffer, processAnswer) {
    var self = this

    function onerror(error) {
      self.dispose()

      _onerror(error)
      done()
    }

    if (error) return onerror(error)

    var stream = this.getLocalStream()
    var track = stream.getAudioTracks()[0]

    assert.ok(track.enabled, 'enabled')

    this.audioEnabled = false
    assert.ok(!track.enabled, 'disabled')

    this.audioEnabled = true
    assert.ok(track.enabled, 'enabled again')

    this.dispose()
    done()
  })
});

QUnit.test('videoEnabled', function (assert) {
  var done = assert.async();

  assert.expect(3);

  const TIMEOUT = 50; // ms

  var video = document.getElementById('localVideo')
  var canvas = document.getElementById('canvas')
  var context = canvas.getContext('2d');

  var options = {
    configuration: {
      iceServers: []
    },
    localVideo: video,
    mediaConstraints: {
      audio: false,
      fake: true
    }
  }

  WebRtcPeerSendonly(options, function (error, sdpoffer, processAnswer) {
    var self = this

    function onerror(error) {
      self.dispose()

      _onerror(error)
      done()
    }

    if (error) return onerror(error)

    function onplaying() {
      video.removeEventListener('playing', onplaying)

      setTimeout(function () {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        var x = video.videoWidth / 2
        var y = video.videoHeight / 2

        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight)
        assert.notPixelEqual(canvas, x, y, 0, 0, 0, 0, 'enabled');

        self.videoEnabled = false

        setTimeout(function () {
          context.drawImage(video, 0, 0, video.videoWidth,
            video.videoHeight)
          assert.pixelEqual(canvas, x, y, 0, 0, 0, 255,
            'disabled');

          self.videoEnabled = true

          setTimeout(function () {
            context.drawImage(video, 0, 0, video.videoWidth,
              video.videoHeight)
            assert.notPixelEqual(canvas, x, y, 0, 0, 0,
              255, 'enabled again');

            self.dispose()
            done()
          }, TIMEOUT)
        }, TIMEOUT)
      }, TIMEOUT)
    }

    video.addEventListener('playing', onplaying)
  })
});
