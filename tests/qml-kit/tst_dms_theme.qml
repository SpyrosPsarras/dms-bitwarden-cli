import QtQuick
import QtQuick.Controls
import QtQuick.Controls.Material
import QtTest
import qs.Common
import "../.."
import "../../DmsUi"

TestCase {
    name: "DmsTheme"
    when: windowShown
    width: 420; height: 300
    visible: true
    property bool initialLight: Theme.isLightMode
    LineField { id: field; width: 300 }
    NumberEntry { id: number; y: 90 }
    PanelSectionHeader { id: heading; y: 180; text: "Section" }

    function textArea(item) {
        if (item instanceof TextArea) return item
        for (let child of item.children) {
            let found = textArea(child)
            if (found) return found
        }
        return null
    }
    function cleanup() { Theme.isLightMode = initialLight }
    function test_palette_follows_live_dms_mode_changes() {
        const editor = textArea(field)
        verify(editor !== null)
        for (const light of [true, false, true]) {
            Theme.isLightMode = light
            const mode = light ? Material.Light : Material.Dark
            tryCompare(editor.Material, "theme", mode)
            tryCompare(number.field.Material, "theme", mode)
            tryCompare(editor.Material, "accent", Theme.primary)
            tryCompare(number.field.Material, "accent", Theme.primary)
            tryCompare(editor, "color", Theme.surfaceText)
            tryCompare(heading, "color", Theme.surfaceVariantText)
            compare(editor.palette.highlight, Theme.primary)
            compare(number.field.palette.buttonText, Theme.surfaceText)
        }
    }
}
