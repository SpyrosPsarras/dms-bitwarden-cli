const assert = require('node:assert/strict')
const { test } = require('node:test')
const { loadModule, functionBody, readPluginSource } = require('./harness')
const Model = loadModule()

test('missing clipboard blocks side effects and a refreshed installation permits retry', () => {
  const scope = {
    Model, Tr: { text: x => x }, depsChecked: true,
    dependencies: Model.parseDependencies('wlcopy=0'), errorMessage: '', probes: 0,
    checkDependencies() { this.probes++ },
    resetAutoLockTimer() { throw Error('must not reset timer') },
    detachWithEnvironment() { throw Error('must not spawn copy') },
    flashNotification() { throw Error('must not announce success') },
    copyPasswordNow() { throw Error('must not copy or close from smartCopy') }
  }
  for (const name of ['clipboardMissing', 'copyToClipboard', 'smartCopy']) {
    scope[name] = new Function('scope', 'with(scope){' + functionBody(readPluginSource('Service.qml'), name) + '; return ' + name + '}')(scope)
  }
  scope.copyToClipboard('fixture-only', 'Password')
  scope.smartCopy({hasTotp:true})
  assert.equal(scope.probes, 2)
  assert.match(scope.errorMessage, /wl-copy or wl-paste/)
  assert.ok(Model.missingPackages(scope.dependencies).includes('wl-clipboard'))
  scope.dependencies = Model.parseDependencies('wlcopy=1')
  assert.equal(scope.clipboardMissing(), false)
  assert.equal(scope.probes, 2)
})
