// AutoTypeKeybind.qml, the auto-type key screen, loads with the DMS
// controls and no Omarchy or Hyprland module, as it does on niri where no
// Hyprland config exists: the reason is shown, Register Keybinding is not,
// and Copy Line still offers the line.
//
//   tests/qml-kit/run.sh tests/qml-kit/tst_auto_type_keybind.qml
//
import QtQuick
import QtTest
import "../.."
import "../../BitwardenModel.js" as Model

TestCase {
  id: tc
  name: "AutoTypeKeybind"
  when: windowShown
  width: 520; height: 400
  visible: true

  QtObject {
    id: fakePanel
    property string fontFamily: "monospace"
    property color fg: "white"
    property color dim: "gray"
    property color urgent: "red"
  }

  QtObject {
    id: fakeVault
    property var autoTypeKeybind: Model.autoTypeKeybindState(
      Model.parseAutoTypeKeybindInspection("home=1\nbinds=\nrequires=0\nfile=absent\n---\n"))
    property string autoTypeChordText: "SUPER + ALT + A"
    property var autoTypeChordCheck: Model.autoTypeChordCheck(autoTypeChordText, autoTypeKeybind)
    property bool autoTypeKeybindBusy: false
    property var autoTypeKeybindResult: null
    property int copies: 0
    function registerAutoTypeKeybind() {}
    function removeAutoTypeKeybind() {}
    function copyAutoTypeBindLine() { copies++ }
    function restoreScreenFocus() {}
  }

  AutoTypeKeybind {
    id: screen
    panel: fakePanel
    vault: fakeVault
  }

  function buttonWith(text) {
    for (var stack = [screen]; stack.length > 0;) {
      var item = stack.pop()
      if (item.text === text && item.visible !== undefined && typeof item.clicked === "function") return item
      for (var i = 0; i < item.children.length; i++) stack.push(item.children[i])
    }
    return null
  }

  function test_without_a_hyprland_config_it_writes_nothing() {
    verify(fakeVault.autoTypeKeybind.blocked !== "", "no reason is given")
    var register = buttonWith("Register Keybinding")
    verify(register !== null && !register.visible, "Register Keybinding is offered with nowhere to write")
    var copy = buttonWith("Copy Line")
    verify(copy !== null && copy.visible && copy.enabled, "Copy Line is not offered")
    mouseClick(copy)
    compare(fakeVault.copies, 1)
    verify(Model.autoTypeBindLine("SUPER + ALT + A").indexOf("dms ipc call bitwarden autoType") >= 0,
      "the line does not run the DMS IPC")
  }
}
