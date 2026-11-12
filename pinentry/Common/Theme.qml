pragma Singleton
import QtQuick
import Quickshell

// DMS's Theme as the prompt's DmsUi reads it, from the values the panel
// passed in QSBW_PE_THEME (Model.pinentryTheme()). Only omarchy-pinentry's
// Quickshell loads this; the shell's own Common is never started twice.
QtObject {
  readonly property var values: {
    try {
      var parsed = JSON.parse(Quickshell.env("QSBW_PE_THEME") || "{}")
      return parsed && typeof parsed === "object" ? parsed : ({})
    } catch (e) {
      return ({})
    }
  }

  function pick(key, fallback) {
    var value = values[key]
    return typeof value === typeof fallback ? value : fallback
  }

  readonly property bool isLightMode: pick("isLightMode", false)
  readonly property color surface: pick("surface", "#141219")
  readonly property color surfaceText: pick("surfaceText", "#e9e0f1")
  readonly property color surfaceVariantText: pick("surfaceVariantText", "#cac4d0")
  readonly property color surfaceContainer: pick("surfaceContainer", "#201c28")
  readonly property color surfaceContainerHigh: pick("surfaceContainerHigh", "#302939")
  readonly property color primary: pick("primary", "#cbb7ff")
  readonly property color outline: pick("outline", "#53495f")
  readonly property color error: pick("error", "#f2b8b5")
  readonly property string fontFamily: pick("fontFamily", "sans-serif")
  readonly property real cornerRadius: pick("cornerRadius", 12)
  readonly property real spacingS: pick("spacingS", 8)
  readonly property real spacingM: pick("spacingM", 12)
  readonly property real spacingL: pick("spacingL", 16)
  readonly property real fontSizeSmall: pick("fontSizeSmall", 12)
  readonly property real fontSizeMedium: pick("fontSizeMedium", 14)
  readonly property real fontSizeLarge: pick("fontSizeLarge", 16)
  readonly property real fontSizeXLarge: pick("fontSizeXLarge", 20)
  readonly property real iconSize: pick("iconSize", 24)

  function withAlpha(c, a) {
    return Qt.rgba(c.r, c.g, c.b, a)
  }
}
