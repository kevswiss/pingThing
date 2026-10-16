/*
 * Debug - Dump nodeState
 * Next-generation Scripted Decision node script
 * Outcomes: true
 *
 * Renders every key in nodeState, plus every property of the user's
 * existing session (if there is one), as its own TextOutputCallback,
 * then continues along "true" when the user clicks Next.
 *
 * WARNING: transient state can contain passwords and other secrets in
 * plain text. Use in dev/sandbox tenants only and remove before promoting.
 */

var MESSAGE_TYPE = 0;    // TextOutputCallback types: 0 = INFORMATION, 1 = WARNING, 2 = ERROR
var MAX_LENGTH = 2000;   // truncate very long values (tokens, JWTs) so the page stays readable
var ALSO_LOG = false;    // set true to also write each line to the debug log (secrets included!)

// nodeState.keys() can come back as a Java Set rather than a JS array
function toJsArray(collection) {
  if (collection == null) return [];
  if (Array.isArray(collection)) {
    return collection.map(function (k) { return String(k); });
  }
  var arr = [];
  var it = collection.iterator();
  while (it.hasNext()) {
    arr.push(String(it.next()));
  }
  return arr;
}

// existingSession is a Map<String, String>. Calling keySet() is blocked by the
// Java class allowlist, so read the keys the JavaScript way instead.
function getMapKeys(map) {
  if (map == null) return [];
  var keys = [];
  try {
    keys = Object.keys(map);
  } catch (e) {
    for (var k in map) {
      keys.push(k);
    }
  }
  return keys
    .map(function (k) { return String(k); })
    .filter(function (k) { return typeof map[k] !== "function"; });
}

function hasExistingSession() {
  return typeof existingSession !== "undefined" && existingSession !== null;
}

function addLine(line) {
  callbacksBuilder.textOutputCallback(MESSAGE_TYPE, line);
  if (ALSO_LOG) {
    logger.debug("[state dump] " + line);
  }
}

// Adds a header line plus one "key = value" line per key
function addSection(title, keys, getValue) {
  addLine("===== " + title + " (" + keys.length + ") =====");
  keys.sort().forEach(function (key) {
    var line;
    try {
      line = key + " = " + formatValue(getValue(key));
    } catch (e) {
      line = key + " = <error reading value: " + e + ">";
    }
    addLine(line);
  });
}

function formatValue(value) {
  if (value === null || value === undefined) return String(value);

  var text;
  try {
    text = JSON.stringify(value);
  } catch (e) {
    text = undefined;
  }

  // Java objects (maps, lists) can stringify to "{}" or fail; fall back to toString()
  if (text === undefined || (text === "{}" && String(value) !== "[object Object]")) {
    text = String(value);
  }

  if (text.length > MAX_LENGTH) {
    text = text.substring(0, MAX_LENGTH) + "... [truncated, " + text.length + " chars total]";
  }
  return text;
}

if (callbacks.isEmpty()) {
  // ---- Section 1: nodeState ----
  addSection("nodeState", toJsArray(nodeState.keys()), function (key) {
    return nodeState.get(key);
  });

  // ---- Section 2: existing session properties ----
  if (hasExistingSession()) {
    addSection("existingSession", getMapKeys(existingSession), function (key) {
      return existingSession.get(key);
    });
  } else {
    addLine("===== existingSession =====");
    addLine("No existing session (user had no valid session when this journey started)");
  }
} else {
  // User clicked Next on the debug page
  action.goTo("true");
}
