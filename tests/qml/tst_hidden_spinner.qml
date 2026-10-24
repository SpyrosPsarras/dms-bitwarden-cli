// A Button's spinner must stop when nobody can see it. Item.visible stays
// true inside a hidden window, and the panel keeps hidden copies of its
// buttons alive (the unlock button spins whenever the vault is unlocked).
// One endless animation keeps every shell window repainting each frame.
//
// This takes the `running:` binding from DmsUi/Button.qml as written and
// runs it on a stand-in, so it needs the QML sources readable from QML:
//
//   QML_XHR_ALLOW_FILE_READ=1 QT_QPA_PLATFORM=offscreen \
//     /usr/lib/qt6/bin/qmltestrunner -input tests/qml
//
import QtQuick
import QtTest

TestCase {
  id: tc
  name: "HiddenSpinner"
  when: windowShown
  width: 100; height: 100
  visible: true

  Window {
    id: otherWindow
    width: 50; height: 50
    visible: false
    Item { id: insideHidden }
  }

  // Never placed in a window.
  property Item detached: Item {}

  function spinBinding() {
    var xhr = new XMLHttpRequest()
    xhr.open("GET", Qt.resolvedUrl("../../DmsUi/Button.qml"), false)
    xhr.send()
    var source = xhr.responseText || ""
    var block = source.match(/RotationAnimation on rotation \{[^}]*\}/)
    verify(block, "Button.qml has a RotationAnimation on rotation")
    var running = block[0].match(/running:\s*([^\n]+)/)
    verify(running, "the spinner has a running: binding")
    return running[1].trim()
  }

  function spinner(parentItem, spinning) {
    return Qt.createQmlObject(
      "import QtQuick\n" +
      "Item {\n" +
      "  id: root\n" +
      "  width: 10; height: 10\n" +
      "  property bool iconSpinning: " + spinning + "\n" +
      "  readonly property bool spinning: anim.running\n" +
      "  Item {\n" +
      "    RotationAnimation on rotation {\n" +
      "      id: anim\n" +
      "      from: 0; to: 360; duration: 900\n" +
      "      loops: Animation.Infinite\n" +
      "      running: " + spinBinding() + "\n" +
      "    }\n" +
      "  }\n" +
      "}", parentItem, "spinner")
  }

  function cleanup() {
    otherWindow.visible = false
  }

  function test_item_visible_stays_true_inside_a_hidden_window() {
    // The trap: checking root.visible alone is not enough.
    verify(insideHidden.visible)
  }

  function test_spins_on_screen() {
    var s = spinner(tc, true)
    tryVerify(function() { return s.spinning })
    s.destroy()
  }

  function test_does_not_spin_when_not_asked() {
    var s = spinner(tc, false)
    wait(50)
    verify(!s.spinning)
    s.destroy()
  }

  function test_follows_its_window() {
    var s = spinner(otherWindow.contentItem, true)
    wait(50)
    verify(!s.spinning, "hidden window: no spin")
    otherWindow.visible = true
    tryVerify(function() { return s.spinning }, 1000, "shown window: spins")
    otherWindow.visible = false
    tryVerify(function() { return !s.spinning }, 1000, "hidden again: stops")
    s.destroy()
  }

  function test_hidden_button_does_not_spin() {
    var s = spinner(tc, true)
    tryVerify(function() { return s.spinning })
    s.visible = false
    tryVerify(function() { return !s.spinning })
    s.visible = true
    tryVerify(function() { return s.spinning })
    s.destroy()
  }

  function test_button_outside_any_window_does_not_spin() {
    var s = spinner(detached, true)
    wait(50)
    verify(!s.spinning)
    s.destroy()
  }
}
