#!/usr/bin/env node
// A quick unlock (fingerprint, PIN, FIDO2) that `bw unlock` fails for a reason
// other than the password keeps the stored secret and shows the error. Run
// against a stand-in vault with Service.qml's onUnlockOutput().
//
//   node tests/unlock-failure.test.js

const { createSuite, functionBody, loadModule, read } = require("./harness")

const Model = loadModule()
const service = read("Service.qml")
const { check, eq, done } = createSuite("unlock-failure")

const backfillCrash = [
  "ERROR bitwarden_user_crypto_management::key_id_backfill: Failed to post the user key id: Response(ResponseContent { status: 404 })",
  "[Encrypted Migrator] Error running migrations for user: 00000000-0000-0000-0000-000000000000 Error [KeyIdBackfillError]: API call failed during user key id backfill",
  "    at __wbg_new_98e187f8aa8916fe (/home/me/.npm-global/lib/node_modules/@bitwarden/cli/build/bw.js:8760:21)",
  "    at wasm://wasm/01d73652:wasm-function[10158]:0x56f45f",
  "  variant: 'Api'",
  "}",
  "node:internal/process/promises:394",
  "    triggerUncaughtException(err, true /* fromPromise */);",
  "Error [KeyIdBackfillError]: API call failed during user key id backfill",
  "Node.js v22.23.5"
].join("\n")

function makeVault(from, fromEnvelope) {
  const v = {
    Model, Qt: { callLater: f => f() },
    isUnlocking: true, pinentryMasterName: "", status: "locked", currentScreen: "unlock", errorMessage: "",
    pendingUnlockFrom: from, pendingUnlockPassword: Model.heldSecretRef("pw1"), pendingPinForMigration: "",
    fingerprintFromEnvelope: from === "fingerprint" && fromEnvelope, pinFromEnvelope: from === "pin" && fromEnvelope,
    fidoFromEnvelope: from === "fido" && fromEnvelope, rotationOldPassword: "",
    fingerprintMessage: "", fingerprintStored: true, pinUnlockError: "",
    cleared: [], forgotten: [],
    fidoUnlocker: { failure: "", forget(reason) { v.cleared.push("fido"); this.failure = reason } },
    forgetVaultSecret(name) { this.forgotten.push(name) },
    requestMasterCredentialClear() { this.cleared.push("fingerprint") },
    clearPin() { this.cleared.push("pin") },
    prepareUnlock() {}, focusAppropriateField() {}, followVaultClosedInSshAgent() {}, onUnlockSuccess() {},
    unlockWithPinentry() {}
  }
  const names = ["onUnlockOutput", "forgetHeldPassword"]
  const make = new Function("root", "with (root) {\n" + names.map(n => functionBody(service, n)).join("\n")
    + "\nreturn {" + names.map(n => `${n}: ${n}`).join(", ") + "} }")
  Object.assign(v, make(v))
  return v
}

for (const from of ["fingerprint", "pin", "fido"]) {
  for (const fromEnvelope of [true, false]) {
    const label = `${from}${fromEnvelope ? " (envelope)" : " (legacy)"}`
    const v = makeVault(from, fromEnvelope)
    v.onUnlockOutput("", "Network request failed.", 1)
    check(`${label}: a failure that is not the password keeps the stored secret`,
      v.cleared.length === 0 && v.fingerprintStored && v.rotationOldPassword === "", JSON.stringify(v.cleared))
    check(`${label}: and says nothing about a changed password`,
      !/changed|no longer/i.test(v.fingerprintMessage + v.pinUnlockError + v.fidoUnlocker.failure),
      v.fingerprintMessage + v.pinUnlockError + v.fidoUnlocker.failure)
    eq(`${label}: the error is shown`, v.errorMessage, "Network request failed.")
    check(`${label}: the password it produced is forgotten`,
      v.forgotten.includes("pw1") && v.pendingUnlockPassword === "" && v.pendingUnlockFrom === "", v.forgotten.join())

    const w = makeVault(from, fromEnvelope)
    w.onUnlockOutput("", "Invalid master password.", 1)
    check(`${label}: a wrong password still marks the method stale`,
      fromEnvelope ? w.cleared.length === 0 && w.rotationOldPassword !== ""
        : w.cleared.join() === from && w.rotationOldPassword === "",
      JSON.stringify({ cleared: w.cleared, rotation: w.rotationOldPassword }))
  }
}

for (const stderr of ["", "ERROR bitwarden_core::x: noise"]) {
  const v = makeVault("fingerprint", true)
  v.onUnlockOutput("", stderr, 1)
  check(`a failure with no message (${JSON.stringify(stderr)}) does not blame the password`,
    v.errorMessage !== "" && !/master password/i.test(v.errorMessage), v.errorMessage)
}

{
  const v = makeVault("fingerprint", true)
  v.onUnlockOutput("", backfillCrash, 1)
  check("bw's key id backfill crash is one short line, not its stack trace",
    !/\n|wasm|Node\.js/.test(v.errorMessage) && /try again/i.test(v.errorMessage), v.errorMessage)
  check("and keeps fingerprint unlock", v.cleared.length === 0 && v.rotationOldPassword === "", "")
  eq("bwErrorText names the crash the same way", Model.bwErrorText(backfillCrash), v.errorMessage)
}

done()
