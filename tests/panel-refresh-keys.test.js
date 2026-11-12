#!/usr/bin/env node
// A key load ends every SSH approval grant. Opening the panel refreshes a stale
// list, but `bw list` then only re-reads the local cache, so it must not hand
// the agent keys it already has. Every read that can change the keys still does.
const vm = require("vm")
const { createSuite, functionBody, loadModule, read } = require("./harness")
const { eq, done } = createSuite("panel-refresh-keys")
const Model = loadModule()
const source = read("Service.qml")
const functions = ["ensureItemsFresh", "beginInitialVaultLoad", "loadPendingMetadata", "loadItems",
  "abandonSyncReload", "startVaultListRead", "vaultListEnv", "onListFinished", "onListProcessExited",
  "endSshAgentLoad", "maybeStartupLoad", "beginVaultRead", "vaultReadIsStale", "beginEpochOperation",
  "epochOperationIsStale", "autoSyncIdle", "maybeAutoSync", "syncVault", "onSyncFinished",
  "onSaveItemFinished"]
const loadId = "0123456789abcdef0123456789abcdef"

function fixture() {
  const c = {
    now: 1000000, live: true, session: "test-session", status: "unlocked", opened: true,
    pinentryActive: false, currentScreen: "main", items: [{ id: "a" }], itemsLoadedAt: 1,
    itemsFreshMs: 60000, activeWindowData: null, vaultEpoch: 3, readEpochs: {},
    dependencies: Model.parseDependencies("bw=1\njq=1\nomarchy=1", null, {}),
    isLoading: false, isUnlocking: false, logoutPending: false, isSyncing: false,
    syncReloadPending: false, backgroundSync: false, autoSyncReloadPending: false,
    autoSyncMinutes: 15, lastSyncAttemptAt: 0, autoSyncError: "", errorMessage: "",
    autoLockMinutes: 0, autoLockArmedAt: 0, suspendLockPending: false,
    metadataLoadPending: false, metadataForceRefresh: false, statusRefreshAfterItems: false,
    creatingFolder: false, repromptBusy: false, sendBusy: false, sshTotalPendingCount: 0, sshGrants: [],
    listReadEarly: false, listReadMode: "", listAgentBranchActive: false, listRetriedWithoutAgent: false,
    sshAgentGateOpen: true, sshAgentEpoch: 14, sshAgentLoadId: "", sshAgentNextLoadId: loadId,
    sshAgentLoadActive: false, sshAgentLoadedForVaultEpoch: 3, sshCapability: null,
    pendingSave: null, itemPayloadJson: "", failedSave: null, written: [],
    Model, Tr: { text: s => s }, authAttemptInFlight: () => false,
    sshAgentProc: { running: true, stdinEnabled: true, write: line => c.written.push(line) },
    bwEnv: () => ({}), primeSshAgentLoadId() {}, applySshAgentLifecycle() {},
    loadOrganizations() {}, loadFolders() {}, loadCollections() {}, rebuildFilter() {},
    handleActiveWindowDetected() {}, refreshDerivedFromItems() {}, flashNotification() {},
    closeFilterGroup() {}, finishScrubRun: () => false, deferredMetadataTimer: { restart() {} }
  }
  c.root = c
  for (const proc of ["listProc", "listOrgsProc", "listFoldersProc", "createItemProc",
    "editItemProc", "deleteItemProc", "createFolderProc", "syncProc"])
    c[proc] = { running: false, command: [], environment: {} }
  c.Date = { now: () => c.now }
  vm.createContext(c)
  vm.runInContext(functions.map(n => functionBody(source, n)).join("\n"), c)
  c.listExits = code => { c.listProc.running = false; c.onListProcessExited(code, "[]", "") }
  return c
}

const tookAgentBranch = c => c.sshAgentEpoch === 15
  && c.written.some(line => line.indexOf("key_load_begin") !== -1)
  && c.listProc.environment[Model.loadIdEnvVar()] === loadId
const leftAgentAlone = c => c.sshAgentEpoch === 14 && c.written.length === 0
  && c.sshAgentNextLoadId === loadId && c.listProc.environment[Model.loadIdEnvVar()] == null

{
  const c = fixture(); c.ensureItemsFresh()
  eq("opening the panel on a stale list still reads it", c.listProc.running, true)
  eq("but does not reload keys the agent has for this vault", leftAgentAlone(c), true)
}
{
  const c = fixture(); c.items = []; c.ensureItemsFresh()
  eq("an empty list read on panel open leaves loaded keys alone too", leftAgentAlone(c), true)
}
{
  const c = fixture(); c.vaultEpoch = 4; c.ensureItemsFresh()
  eq("the first panel read after an unlock reloads keys", tookAgentBranch(c), true)
}
{
  const c = fixture(); c.sshAgentLoadedForVaultEpoch = -1; c.ensureItemsFresh()
  eq("a panel read when keys never loaded for this vault reloads them", tookAgentBranch(c), true)
}
{
  const c = fixture(); c.vaultEpoch = 4; c.beginInitialVaultLoad(true, false)
  eq("the read an unlock or account switch starts reloads keys", tookAgentBranch(c), true)
}
{
  const c = fixture(); c.syncVault(); c.syncProc.running = false; c.onSyncFinished(0)
  eq("a manual sync's reload reloads keys", tookAgentBranch(c), true)
}
{
  const c = fixture(); c.opened = false; c.syncVault(true); c.syncProc.running = false; c.onSyncFinished(0)
  eq("an automatic sync's reload reloads keys", tookAgentBranch(c), true)
}
{
  const c = fixture(); c.syncVault(true); c.currentScreen = "edit"; c.syncProc.running = false
  c.onSyncFinished(0)
  eq("an automatic sync during an edit leaves its reload pending", c.autoSyncReloadPending, true)
  c.currentScreen = "main"; c.ensureItemsFresh()
  eq("a panel read owed a sync's reload reloads keys", tookAgentBranch(c), true)
}
{
  const c = fixture(); c.beginVaultRead("itemSave")
  c.onSaveItemFinished(0, Model.savedUnsanitizedMarker(), "")
  eq("an item save the list must be re-read for reloads keys", tookAgentBranch(c), true)
}
{
  const c = fixture(); c.beginInitialVaultLoad(true, false); c.listExits(1)
  eq("a failed key load retries without the branch", c.listProc.running, true)
  eq("and the retry starts no second load", c.sshAgentEpoch, 15)
}
{
  const c = fixture(); c.lifecycle = []; c.applySshAgentLifecycle = event => c.lifecycle.push(event)
  c.beginInitialVaultLoad(true, false); c.listExits(1)
  c.sshAgentNextLoadId = loadId; c.listExits(0)
  eq("the successful retry after a failed key load does not reload keys by itself", c.lifecycle.length, 0)
  c.now += 120000; c.ensureItemsFresh()
  eq("the next panel read reloads the keys the failed load dropped",
    c.sshAgentEpoch === 16 && c.listProc.environment[Model.loadIdEnvVar()] === loadId, true)
}
{
  const c = fixture(); c.status = "locked"; c.vaultEpoch = 4; c.ensureItemsFresh()
  c.status = "unlocked"; c.listExits(1)
  eq("an early read that failed is read again with keys", tookAgentBranch(c), true)
}

done()
