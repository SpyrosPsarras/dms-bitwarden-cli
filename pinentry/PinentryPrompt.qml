import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Wayland

// The window of the plugin's pinentry: one prompt, in a Quickshell of
// its own that omarchy-pinentry starts for a GETPIN and that quits once it
// has answered. Never loaded by the shell itself.
//
// QSBW_PINENTRY_DIR is the run's private directory (0700): prompt.json holds
// what to show, and answer.sock is where omarchy-pinentry waits for one line,
// `D <answer, percent-encoded>` or `CANCEL`. This side keeps nothing: the
// field is emptied as the answer is sent, and the process quits. Losing the
// socket (omarchy-pinentry gone) closes the prompt without an answer.
Scope {
  id: root

  readonly property string dir: Quickshell.env("QSBW_PINENTRY_DIR") || ""
  // Read at once (blockLoading): omarchy-pinentry wrote it before starting this.
  readonly property var ask: {
    if (root.dir === "") return null
    try {
      var parsed = JSON.parse(askFile.text())
      return parsed && typeof parsed === "object" ? parsed : null
    } catch (e) {
      return null
    }
  }
  property bool finished: false
  property bool wasConnected: false

  // The monitor focused when the prompt was asked for, else the first.
  readonly property var targetScreen: {
    var wanted = root.ask ? String(root.ask.monitor || "") : ""
    var screens = Quickshell.screens
    for (var i = 0; wanted && i < screens.length; i++) {
      if (screens[i].name === wanted) return screens[i]
    }
    return screens.length > 0 ? screens[0] : null
  }

  function finish(line) {
    if (finished) return
    finished = true
    if (line && channel.connected) {
      channel.write(line)
      channel.flush()
    }
    Qt.callLater(function() { Qt.quit() })
  }

  function submit() {
    var text = card.takeText()
    var encoded = ""
    try {
      encoded = encodeURIComponent(text)
    } catch (e) {
      // A lone surrogate: nothing that could be sent as typed.
      finish("")
      return
    }
    text = ""
    finish("D " + encoded + "\n")
    encoded = ""
  }

  FileView {
    id: askFile
    path: root.dir ? root.dir + "/prompt.json" : ""
    blockLoading: true
    printErrors: false
    onLoadFailed: root.finish("")
  }

  Socket {
    id: channel
    path: root.dir ? root.dir + "/answer.sock" : ""
    // Connected from Component.onCompleted, once the path is set.
    onConnectedChanged: {
      if (connected) root.wasConnected = true
      else if (root.wasConnected) root.finish("")
    }
    onError: root.finish("")
  }

  // omarchy-pinentry answers the timeout itself; this only makes sure a
  // prompt it lost track of does not stay up.
  Timer {
    running: root.ask !== null && Number(root.ask.timeout) > 0
    interval: (Number(root.ask ? root.ask.timeout : 0) + 15) * 1000
    onTriggered: root.finish("")
  }

  PanelWindow {
    id: panel
    screen: root.targetScreen
    visible: root.ask !== null && !root.finished
    anchors { top: true; bottom: true; left: true; right: true }
    color: "transparent"
    WlrLayershell.namespace: "qsbw-pinentry"
    WlrLayershell.layer: WlrLayer.Overlay
    WlrLayershell.keyboardFocus: WlrKeyboardFocus.Exclusive
    exclusionMode: ExclusionMode.Ignore

    PinentryCard {
      id: card
      anchors.fill: parent
      description: root.ask ? String(root.ask.description || "") : ""
      prompt: root.ask ? String(root.ask.prompt || "") : ""
      error: root.ask ? String(root.ask.error || "") : ""
      onAccepted: root.submit()
      onRejected: root.finish("CANCEL\n")
    }
  }

  Component.onCompleted: {
    if (root.dir === "" || root.ask === null) {
      root.finish("")
      return
    }
    channel.connected = true
    card.open()
  }
}
